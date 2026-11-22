import {describe,expect,test} from 'bun:test';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import {createMigrationSessionBoundary,type MigrationSessionPorts} from './migrationSessionBoundary';

function deferred<T>() {
  let resolve!:(value:T)=>void;
  const promise=new Promise<T>(r=>{resolve=r;});
  return {promise,resolve};
}
function fixture() {
  const queue=createDurableMutationCoordinator();
  const events:string[]=[];
  let current=true;
  const grant=Object.freeze({bytes:1,sha256:'synthetic',payloadVersion:6 as const});
  const ports:MigrationSessionPorts={
    queue,
    isCurrent:()=>current,
    classify:async()=>{events.push('classify');return 'complete';},
    readLocalCopy:async()=>{events.push('read');return new Blob(['synthetic']);},
    confirm:async()=>{events.push('confirm');return true;},
    retireDb1:async()=>{events.push('retire');},
    migration:{
      prepare:async()=>{events.push('prepare');return grant;},
      migrate:async(g,yes)=>{expect(g).toBe(grant);expect(yes).toBe(true);events.push('migrate');},
      invalidate:()=>{events.push('invalidate');}
    }
  };
  return {queue,events,ports,expire:()=>{current=false;}};
}
const run=(owner:ReturnType<typeof createMigrationSessionBoundary>)=>owner.run('synthetic-vault','synthetic-copy');

describe('VAL-01 D1b.4b isolated migration session boundary',()=>{
  test('seals the real queue synchronously; drains admitted work, then authenticates, reads, confirms, retires and migrates once',async()=>{
    const f=fixture(), gate=deferred<void>();
    const admitted=f.queue.enqueueTask(async()=>{await gate.promise;f.events.push('admitted');});
    const owner=createMigrationSessionBoundary(f.ports);
    const pending=run(owner);
    await expect(f.queue.enqueueTask(()=>1)).rejects.toThrow();
    await expect(run(owner)).resolves.toBe('not-started');
    expect(f.events).toEqual([]);
    gate.resolve();await admitted;
    expect(await pending).toBe('migrated-reopen-required');
    expect(f.events).toEqual(['admitted','classify','read','prepare','confirm','retire','migrate','invalidate']);
    await expect(f.queue.enqueueTask(()=>1)).rejects.toThrow();
    expect(await run(owner)).toBe('not-started');
  });
  test('incomplete or unverifiable never reads a copy or migrates',async()=>{
    for(const result of ['incomplete','unverifiable'] as const){
      const f=fixture();f.ports.classify=async()=>result;
      expect(await run(createMigrationSessionBoundary(f.ports))).toBe('blocked-reopen-required');
      expect(f.events).toEqual(['invalidate']);
      await expect(f.queue.enqueueTask(()=>1)).rejects.toThrow();
    }
  });
  test('cancelled local picker or explicit refusal never migrates',async()=>{
    for(const phase of ['read','confirm']){
      const f=fixture();
      if(phase==='read')f.ports.readLocalCopy=async()=>null;
      else f.ports.confirm=async()=>false;
      expect(await run(createMigrationSessionBoundary(f.ports))).toBe('cancelled-reopen-required');
      expect(f.events).not.toContain('retire');expect(f.events).not.toContain('migrate');
    }
  });
  test('revocation during each awaited precommit stage prevents migration and never reopens admission',async()=>{
    for(const stage of ['drain','classify','read','prepare','confirm','retire'] as const){
      const f=fixture(), entered=deferred<void>(), release=deferred<void>();
      const hold=async()=>{entered.resolve();await release.promise;};
      if(stage==='drain')void f.queue.enqueueTask(hold);
      if(stage==='classify')f.ports.classify=async()=>{await hold();return 'complete';};
      if(stage==='read')f.ports.readLocalCopy=async()=>{await hold();return new Blob(['synthetic']);};
      if(stage==='prepare'){const original=f.ports.migration.prepare;f.ports.migration.prepare=async(...args)=>{await hold();return original(...args);};}
      if(stage==='confirm')f.ports.confirm=async()=>{await hold();return true;};
      if(stage==='retire')f.ports.retireDb1=hold;
      const owner=createMigrationSessionBoundary(f.ports), pending=run(owner);
      await entered.promise;owner.revoke();
      expect(f.events).toContain('invalidate');release.resolve();
      expect(await pending).toBe('cancelled-reopen-required');
      expect(f.events).not.toContain('migrate');
      await expect(f.queue.enqueueTask(()=>1)).rejects.toThrow();
    }
  });
  test('epoch change without explicit callback is detected after await',async()=>{
    const f=fixture();f.ports.confirm=async()=>{f.expire();return true;};
    expect(await run(createMigrationSessionBoundary(f.ports))).toBe('cancelled-reopen-required');
    expect(f.events).not.toContain('migrate');
  });
  test('revocation or exception after migration invocation requires inspection, not assumed rollback',async()=>{
    for(const revoke of [true,false]){
      const f=fixture(), entered=deferred<void>(), release=deferred<void>();
      f.ports.migration.migrate=async()=>{entered.resolve();await release.promise;if(!revoke)throw Error('synthetic');};
      const owner=createMigrationSessionBoundary(f.ports), pending=run(owner);
      await entered.promise;if(revoke)owner.revoke();release.resolve();
      expect(await pending).toBe('inspect-reopen-required');
      await expect(f.queue.enqueueTask(()=>1)).rejects.toThrow();
    }
  });
  test('already stale or revoked owner cannot start; precommit exception is blocked',async()=>{
    const f=fixture();f.expire();
    expect(await run(createMigrationSessionBoundary(f.ports))).toBe('not-started');
    expect(await f.queue.enqueueTask(()=>1)).toBe(1);
    const g=fixture();g.ports.retireDb1=async()=>{throw Error('synthetic');};
    expect(await run(createMigrationSessionBoundary(g.ports))).toBe('blocked-reopen-required');
    expect(g.events).not.toContain('migrate');
  });
});
