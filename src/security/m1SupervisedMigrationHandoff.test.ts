import {describe,expect,test} from 'bun:test';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import type {AndroidBackupRuntime} from './androidBackupExport';
import {createSupervisedMigrationHandoff,type SupervisedMigrationPorts} from './m1SupervisedMigrationHandoff';

function deferred<T>() {
  let resolve!:(value:T)=>void;
  const promise=new Promise<T>(r=>{resolve=r;});
  return {promise,resolve};
}
function fixture(){
  const queue=createDurableMutationCoordinator();
  let epoch=1,revision=0,owner=true,authenticated=true;
  const events:string[]=[];
  const grant=Object.freeze({bytes:17,sha256:'synthetic-receipt',payloadVersion:6 as const});
  const ports:SupervisedMigrationPorts={
    owner:{
      isOwner:()=>owner,
      observeAuthenticated:async()=>owner&&authenticated?{epoch,revision}:null,
      isCurrent:stamp=>owner&&authenticated&&stamp.epoch===epoch&&stamp.revision===revision
    },
    queue,
    classify:async()=>{events.push('classify');return 'complete';},
    confirm:async()=>{events.push('confirm');return true;},
    retireDb1:async()=>{events.push('retire');},
    migration:{
      invalidate:()=>{events.push('invalidate');},
      prepare:async(_password,file)=>{events.push('prepare:'+await file.text());return grant;},
      migrate:async(g,confirmed)=>{expect(g).toBe(grant);expect(confirmed).toBe(true);events.push('migrate');}
    }
  };
  return {queue,ports,events,
    change:()=>{epoch++;revision++;},
    endOwner:()=>{owner=false;},
    lock:()=>{authenticated=false;},
    renew:()=>{owner=true;authenticated=true;revision++;},
    nativeEpoch:()=>{epoch++;revision++;authenticated=true;},
  };
}
const pass=(s:ReturnType<typeof createSupervisedMigrationHandoff>)=>s.begin('vault-synthetic','copy-synthetic');
async function receipt(text:string){
  const bytes=new TextEncoder().encode(text);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return {status:'read',encryptedText:text,bytes:bytes.length,
    sha256:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};
}

describe('M1-B3.4 isolated supervised migration handoff',()=>{
  test('no authenticated selected ticket does not seal the real queue or admit migration',async()=>{
    const f=fixture(),s=createSupervisedMigrationHandoff(f.ports);
    expect(await pass(s)).toBe('not-started');
    expect(await f.queue.enqueueTask(()=>7)).toBe(7);
    expect(f.events).toEqual([]);
  });

  test('consumes the latest selected ciphertext once and seals the real queue before the first await',async()=>{
    const f=fixture(),gate=deferred<void>();
    const admitted=f.queue.enqueueTask(async()=>{await gate.promise;f.events.push('admitted');});
    const s=createSupervisedMigrationHandoff(f.ports);
    expect(await s.selectWeb(new Blob(['first']))).toBe(true);
    expect(await s.selectWeb(new Blob(['last']))).toBe(true);
    const running=pass(s);
    await expect(f.queue.enqueueTask(()=>1)).rejects.toThrow();
    expect(await pass(s)).toBe('not-started');
    expect(await s.selectWeb(new Blob(['replay']))).toBe(false);
    gate.resolve(undefined);await admitted;
    expect(await running).toBe('migrated-reopen-required');
    expect(f.events).toEqual(['admitted','classify','prepare:last','confirm','retire','migrate','invalidate']);
    await expect(f.queue.enqueueTask(()=>2)).rejects.toThrow();
    expect(await pass(s)).toBe('not-started');
  });

  test('session epoch changes before ticket consumption forbid migration without sealing',async()=>{
    const f=fixture(),s=createSupervisedMigrationHandoff(f.ports);
    expect(await s.selectWeb(new Blob(['encrypted']))).toBe(true);
    f.change();
    expect(await pass(s)).toBe('not-started');
    expect(await f.queue.enqueueTask(()=>3)).toBe(3);
    expect(f.events).toEqual([]);
    expect(await pass(s)).toBe('not-started');
  });

  test('Android authenticated chooser may change epoch, but a new observed epoch is required',async()=>{
    const f=fixture(),s=createSupervisedMigrationHandoff(f.ports);
    const plugin={
      chooseBackupDestination:async()=>{throw Error('Unexpected export');},
      writeEncryptedBackup:async()=>{throw Error('Unexpected export');},
      chooseBackupSource:async()=>{f.nativeEpoch();return {status:'selected' as const,token:'local'};},
      readEncryptedBackup:async (token:unknown)=>{expect(token).toEqual({token:'local'});return receipt('native-encrypted');}
    };
    const runtime:AndroidBackupRuntime={androidBridge:{},
      sessionAccess:async active=>active()&&f.ports.owner.isOwner(),
      Capacitor:{getPlatform:()=> 'android',Plugins:{RegistroBackupFiles:plugin}}
    };
    expect(await s.selectAndroid(runtime)).toBe(true);
    expect(await pass(s)).toBe('migrated-reopen-required');
    expect(f.events).toContain('prepare:native-encrypted');
    expect(await s.selectAndroid(runtime)).toBe(false);
  });

  test('cancelled, empty, corrupt-digest and stale native selections do not seal or migrate',async()=>{
    for(const issue of ['cancel','empty','digest','stale']){
      const f=fixture(),s=createSupervisedMigrationHandoff(f.ports);
      const plugin={
        chooseBackupDestination:async()=>{throw Error('Unexpected export');},
        writeEncryptedBackup:async()=>{throw Error('Unexpected export');},
        chooseBackupSource:async()=>issue==='cancel'?{status:'cancelled' as const}:{status:'selected' as const,token:'local'},
        readEncryptedBackup:async()=>issue==='empty'?receipt(''):issue==='digest'?{...await receipt('encrypted'),sha256:'bad'}:receipt('encrypted')
      };
      const runtime:AndroidBackupRuntime={androidBridge:{},
        sessionAccess:async active=>active()&&f.ports.owner.isOwner(),
        Capacitor:{getPlatform:()=> 'android',Plugins:{RegistroBackupFiles:plugin}}
      };
      if(issue==='stale')plugin.chooseBackupSource=async()=>{f.endOwner();return {status:'selected' as const,token:'local'};};
      expect(await s.selectAndroid(runtime)).toBe(false);
      expect(await pass(s)).toBe('not-started');
      expect(await f.queue.enqueueTask(()=>5)).toBe(5);
      expect(f.events).toEqual([]);
    }
  });

  test('explicit revocation before begin invalidates copy and leaves queue open',async()=>{
    const f=fixture(),s=createSupervisedMigrationHandoff(f.ports);
    expect(await s.selectWeb(new Blob(['encrypted']))).toBe(true);
    s.revoke();
    expect(await pass(s)).toBe('not-started');
    expect(await s.selectWeb(new Blob(['new']))).toBe(false);
    expect(await f.queue.enqueueTask(()=>6)).toBe(6);
    expect(f.events).toEqual([]);
  });

  test('revocation during classify, confirmation or DB1 retirement prevents migration',async()=>{
    for(const stage of ['classify','confirm','retire'] as const){
      const f=fixture(),entered=deferred<void>(),release=deferred<void>();
      const hold=async()=>{entered.resolve(undefined);await release.promise;};
      if(stage==='classify')f.ports.classify=async()=>{await hold();return 'complete';};
      if(stage==='confirm')f.ports.confirm=async()=>{await hold();return true;};
      if(stage==='retire')f.ports.retireDb1=hold;
      const s=createSupervisedMigrationHandoff(f.ports);
      expect(await s.selectWeb(new Blob(['encrypted']))).toBe(true);
      const pending=pass(s);
      await entered.promise;
      f.change();s.revoke();release.resolve(undefined);
      expect(await pending).toBe('cancelled-reopen-required');
      expect(f.events).not.toContain('migrate');
      await expect(f.queue.enqueueTask(()=>9)).rejects.toThrow();
    }
  });

  test('declined confirmation seals once, never migrates and requires a new owner',async()=>{
    const f=fixture();f.ports.confirm=async()=>false;
    const s=createSupervisedMigrationHandoff(f.ports);
    expect(await s.selectWeb(new Blob(['encrypted']))).toBe(true);
    expect(await pass(s)).toBe('cancelled-reopen-required');
    expect(f.events).not.toContain('migrate');
    await expect(f.queue.enqueueTask(()=>9)).rejects.toThrow();
    const fresh=fixture(),next=createSupervisedMigrationHandoff(fresh.ports);
    expect(await next.selectWeb(new Blob(['encrypted']))).toBe(true);
    expect(await pass(next)).toBe('migrated-reopen-required');
  });

  test('M1-C/3 selection loses authority on lock or owner retirement before consuming ciphertext',async()=>{
    for(const lost of ['lock','retire'] as const){
      const f=fixture(),s=createSupervisedMigrationHandoff(f.ports);
      expect(await s.selectWeb(new Blob(['protected-ciphertext']))).toBe(true);
      if(lost==='lock')f.lock();else f.endOwner();
      expect(await pass(s)).toBe('not-started');
      expect(await f.queue.enqueueTask(()=>17)).toBe(17);
      expect(f.events).toEqual([]);
      f.renew();
      expect(await pass(s)).toBe('not-started');
      expect(f.events).toEqual([]);
    }
  });

  test('M1-C/3 consent refusal consumes the selected copy and permanently seals the actual mutation queue',async()=>{
    const f=fixture();
    f.ports.confirm=async()=>{f.events.push('confirm');return false;};
    const s=createSupervisedMigrationHandoff(f.ports);
    expect(await s.selectWeb(new Blob(['local-encrypted-copy']))).toBe(true);
    expect(await pass(s)).toBe('cancelled-reopen-required');
    expect(f.events).toEqual(['classify','prepare:local-encrypted-copy','confirm','invalidate']);
    expect(await pass(s)).toBe('not-started');
    expect(await s.selectWeb(new Blob(['new-copy']))).toBe(false);
    await expect(f.queue.enqueueTask(()=>18)).rejects.toThrow();
  });

  test('revocation or exception after migration invocation requires inspection, never assumed rollback',async()=>{
    for(const revoke of [true,false]){
      const f=fixture(),entered=deferred<void>(),release=deferred<void>();
      f.ports.migration.migrate=async()=>{entered.resolve(undefined);await release.promise;if(!revoke)throw Error('post-invocation synthetic');};
      const s=createSupervisedMigrationHandoff(f.ports);
      expect(await s.selectWeb(new Blob(['encrypted']))).toBe(true);
      const pending=pass(s);
      await entered.promise;
      if(revoke)s.revoke();
      release.resolve(undefined);
      expect(await pending).toBe('inspect-reopen-required');
      expect(await pass(s)).toBe('not-started');
      await expect(f.queue.enqueueTask(()=>9)).rejects.toThrow();
    }
  });
});
