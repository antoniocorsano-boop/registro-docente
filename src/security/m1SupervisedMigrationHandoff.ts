/**
 * M1-B3.4 — isolated supervised handoff of an authenticated encrypted V6 copy.
 *
 * This composes the existing file/session authority with the existing
 * one-use, sealed-queue DB1 migration boundary. It has NO production caller,
 * DOES NOT create a DB or bypass the Android security/release hold.
 * The owner must provide its actual session epoch/revision and file authority.
 */
import type {DurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import type {AndroidBackupRuntime} from './androidBackupExport';
import {createRecoveryCopyHandoff,type RecoveryHandoffOwner,type RecoverySessionStamp} from './migrationRecoveryHandoff';
import {createMigrationSessionBoundary,type MigrationSessionPorts,type MigrationSessionResult} from './migrationSessionBoundary';

export interface SupervisedMigrationPorts {
  owner: RecoveryHandoffOwner;
  /** Pass the currently active durable coordinator; do NOT construct a spare queue. */
  queue: Pick<DurableMutationCoordinator,'sealAndDrain'>;
  classify: MigrationSessionPorts['classify'];
  confirm: MigrationSessionPorts['confirm'];
  retireDb1: MigrationSessionPorts['retireDb1'];
  migration: MigrationSessionPorts['migration'];
}

/** Owner-facing laboratory adapter. Selection occurs before irrevocable sealing.
 * A consumed ticket seals admission synchronously within begin(), before an await.
 * No credentials or plaintext archive contents are retained in this adapter. */
export function createSupervisedMigrationHandoff(ports:SupervisedMigrationPorts) {
  const selected=createRecoveryCopyHandoff(ports.owner);
  let closed=false,started=false;
  let active:ReturnType<typeof createMigrationSessionBoundary>|null=null;
  const isCurrent=(stamp:RecoverySessionStamp)=>{
    try{return !closed&&ports.owner.isOwner()===true&&ports.owner.isCurrent(stamp)===true;}
    catch{return false;}
  };
  function revoke(){
    closed=true;
    selected.invalidate();
    active?.revoke();
  }
  return {
    revoke,
    /** Native picker must use the existing authenticated bridge and post-chooser epoch. */
    selectAndroid(runtime?:AndroidBackupRuntime):Promise<boolean>{
      return closed||started?Promise.resolve(false):selected.selectAndroid(runtime);
    },
    /** Caller is responsible for providing a real, user-selected local file. */
    selectWeb(file:Blob):Promise<boolean>{
      return closed||started?Promise.resolve(false):selected.selectWeb(file);
    },
    async begin(vaultPassword:string,backupPassword:string):Promise<MigrationSessionResult>{
      if(closed||started)return 'not-started';
      // consume() transfers bytes once and invokes the callback SYNCHRONOUSLY.
      // The underlying boundary seals the actual queue before its first await.
      const attempt=selected.consume((copy,stamp)=>{
        started=true;
        const boundary=createMigrationSessionBoundary({
          queue:ports.queue,
          isCurrent:()=>isCurrent(stamp),
          classify:ports.classify,
          readLocalCopy:async signal=>!signal.aborted&&isCurrent(stamp)?copy:null,
          confirm:ports.confirm,
          retireDb1:ports.retireDb1,
          migration:ports.migration
        });
        active=boundary;
        return boundary.run(vaultPassword,backupPassword);
      });
      if(attempt===null)return 'not-started';
      try{return await attempt;}
      finally{active=null;selected.invalidate();}
    }
  };
}
