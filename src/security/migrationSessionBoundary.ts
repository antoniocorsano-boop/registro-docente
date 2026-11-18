/**
 * VAL-01/D1b.4b.1: isolated owner-facing migration boundary.
 * No UI/runtime caller. The future root must bind lifecycle revocation,
 * draft guard, native file authority and database retirement to this port.
 * A sealed session is never resumed, even on cancellation.
 */
import type { DurableMutationCoordinator } from '../persistence/durableMutationCoordinator';
import type { ArchivePreflightResult } from './archivePreflight';
import { createAuthorizedVaultMigration } from './authorizedVaultMigration';
import { classifyArchivePreflight } from './archivePreflight';

type Migration = ReturnType<typeof createAuthorizedVaultMigration>;
export interface MigrationSessionPorts {
  queue: Pick<DurableMutationCoordinator,'sealAndDrain'>;
  /** Synchronous predicate for the exact authenticated generation. */
  isCurrent(): boolean;
  classify(password:string,signal:AbortSignal):Promise<ArchivePreflightResult>;
  /** Owner-controlled local file readback, not a newly generated blob. */
  readLocalCopy(signal:AbortSignal):Promise<Blob|null>;
  confirm(signal:AbortSignal):Promise<boolean>;
  /** Close every old session-owned DB1 handle; no reset or rewrite. */
  retireDb1():Promise<void>;
  migration: Migration;
}
export type MigrationSessionResult =
  | 'not-started'
  | 'blocked-reopen-required'
  | 'cancelled-reopen-required'
  | 'migrated-reopen-required'
  | 'inspect-reopen-required';

export function createMigrationSessionBoundary(ports:MigrationSessionPorts) {
  const controller=new AbortController();
  let used=false;
  function current():boolean {
    try{return !controller.signal.aborted && ports.isCurrent()===true;}
    catch{return false;}
  }
  function revoke():void {
    controller.abort();
    ports.migration.invalidate();
  }
  function assertCurrent():void {
    if(!current()) {revoke();throw Error('Sessione non attuale.');}
  }
  return {
    revoke,
    async run(vaultPassword:string,backupPassword:string):Promise<MigrationSessionResult> {
      if(used||!current())return 'not-started';
      used=true;
      let invoked=false;
      try {
        // Permanent closure is synchronous, before the first await.
        // A fresh authenticated runtime is needed for every terminal result.
        await ports.queue.sealAndDrain();
        assertCurrent();
        const classification=await ports.classify(vaultPassword,controller.signal);
        assertCurrent();
        if(classification!=='complete')return 'blocked-reopen-required';
        const copy=await ports.readLocalCopy(controller.signal);
        assertCurrent();
        if(copy===null)return 'cancelled-reopen-required';
        const grant=await ports.migration.prepare(vaultPassword,copy,backupPassword);
        assertCurrent();
        const confirmed=await ports.confirm(controller.signal);
        assertCurrent();
        if(confirmed!==true)return 'cancelled-reopen-required';
        await ports.retireDb1();
        assertCurrent();
        // No await between final generation check and invocation. The actual
        // migration service rechecks the physical ciphertext in its transaction.
        invoked=true;
        await ports.migration.migrate(grant,true);
        assertCurrent();
        return 'migrated-reopen-required';
      }catch{
        // An error after invoking the transaction is not proof of rollback.
        // Owner must inspect durable version under a protected surface.
        if(invoked)return 'inspect-reopen-required';
        return current()?'blocked-reopen-required':'cancelled-reopen-required';
      }finally{
        revoke();
      }
    }
  };
}

/** Real service adapter, still unused by production. Owner must supply
 * its existing queue and lifecycle/file/retirement authorities. */
export function createLocalMigrationSessionBoundary(
  owner:Omit<MigrationSessionPorts,'classify'|'migration'>,
  factory:IDBFactory|undefined=globalThis.indexedDB
) {
  return createMigrationSessionBoundary({
    ...owner,
    classify:(password,signal)=>classifyArchivePreflight(password,signal,factory),
    migration:createAuthorizedVaultMigration(factory)
  });
}
