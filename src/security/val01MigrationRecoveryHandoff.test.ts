import {describe,expect,test} from 'bun:test';
import {createRecoveryCopyHandoff, type RecoverySessionStamp} from './migrationRecoveryHandoff';
import type {AndroidBackupRuntime} from './androidBackupExport';

function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}
async function receipt(text:string){
  const bytes=new TextEncoder().encode(text);
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  return {status:'read',encryptedText:text,bytes:bytes.length,sha256};
}
function fixture(){
  let owner=true,epoch=1,revision=0,authenticated=true;
  const stamp=():RecoverySessionStamp=>({epoch,revision});
  const events:string[]=[];
  const runtime:AndroidBackupRuntime={
    androidBridge:{},sessionAccess:async active=>{events.push('access');return active()&&authenticated;},
    Capacitor:{getPlatform:()=> 'android',Plugins:{RegistroBackupFiles:{
      chooseBackupDestination:async()=>{throw Error('unexpected');},
      writeEncryptedBackup:async()=>{throw Error('unexpected');},
      chooseBackupSource:async()=>{events.push('choose');epoch++;revision++;authenticated=true;return {status:'selected',token:'local'};},
      readEncryptedBackup:async token=>{expect(token).toEqual({token:'local'});events.push('read');return receipt('synthetic ciphertext');}
    }}}
  };
  const ports={
    isOwner:()=>owner,
    observeAuthenticated:async()=>authenticated&&owner?stamp():null,
    isCurrent:(s:RecoverySessionStamp)=>owner&&authenticated&&s.epoch===epoch&&s.revision===revision
  };
  return {ports,runtime,events,expire:()=>{owner=false;},change:()=>{epoch++;revision++;},
    lock:()=>{authenticated=false;},plugin:runtime.Capacitor!.Plugins!.RegistroBackupFiles!};
}

describe('VAL-01 D1b.4b.2b recovery copy handoff',()=>{
  test('real Android bridge reader allows chooser epoch change, binds only current authenticated epoch, consumes once',async()=>{
    const f=fixture(),h=createRecoveryCopyHandoff(f.ports);
    expect(await h.selectAndroid(f.runtime)).toBe(true);
    expect(f.events).toContain('read');
    let received:Blob|null=null;
    expect(h.consume((copy,stamp)=>{received=copy;expect(stamp.epoch).toBe(2);return 7;})).toBe(7);
    expect(await (received as Blob|null)?.text()).toBe('synthetic ciphertext');
    expect(h.consume(()=>{throw Error('replay');})).toBeNull();
  });
  test('no authentication after chooser, cancelled picker or corrupt digest never offers a copy',async()=>{
    for(const kind of ['lock','cancel','digest']){
      const f=fixture(),h=createRecoveryCopyHandoff(f.ports);
      if(kind==='lock')f.plugin.chooseBackupSource=async()=>{f.lock();return {status:'selected',token:'local'};};
      if(kind==='cancel')f.plugin.chooseBackupSource=async()=>({status:'cancelled'});
      if(kind==='digest')f.plugin.readEncryptedBackup=async()=>({...await receipt('synthetic'),sha256:'wrong'});
      expect(await h.selectAndroid(f.runtime)).toBe(false);
      expect(h.consume(()=>1)).toBeNull();
    }
  });
  test('owner invalidation and duplicate selection while chooser pending never return stale bytes',async()=>{
    const f=fixture(),h=createRecoveryCopyHandoff(f.ports),gate=deferred<unknown>();
    f.plugin.chooseBackupSource=()=>gate.promise;
    const pending=h.selectAndroid(f.runtime);
    expect(await h.selectAndroid(f.runtime)).toBe(false);
    h.invalidate();gate.resolve({status:'selected',token:'local'});
    expect(await pending).toBe(false);
    expect(h.consume(()=>1)).toBeNull();
    expect(f.events).not.toContain('read');
  });
  test('generation or owner changes after verified read invalidate before synchronous handoff',async()=>{
    for(const change of ['generation','owner','lock']){
      const f=fixture(),h=createRecoveryCopyHandoff(f.ports);
      expect(await h.selectAndroid(f.runtime)).toBe(true);
      if(change==='generation')f.change();else if(change==='owner')f.expire();else f.lock();
      expect(h.consume(()=>1)).toBeNull();
      expect(h.consume(()=>1)).toBeNull();
    }
  });
  test('stale observation response cannot become a ticket',async()=>{
    const f=fixture(),h=createRecoveryCopyHandoff(f.ports);
    const original=f.ports.observeAuthenticated;
    f.ports.observeAuthenticated=async()=>{const old=await original();f.change();return old;};
    expect(await h.selectAndroid(f.runtime)).toBe(false);
    expect(h.consume(()=>1)).toBeNull();
  });
  test('web local file is bounded and tied to the authenticated owner; no replay or stale bytes',async()=>{
    const f=fixture(),h=createRecoveryCopyHandoff(f.ports);
    expect(await h.selectWeb(new Blob([]))).toBe(false);
    expect(await h.selectWeb(new Blob(['encrypted']))).toBe(true);
    expect(h.consume((copy)=>copy.size)).toBe(9);
    expect(h.consume(()=>1)).toBeNull();
  });
});
