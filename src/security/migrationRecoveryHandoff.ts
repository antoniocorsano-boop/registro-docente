/**
 * VAL-01/D1b.4b.2b — recovery copy handoff, before permanently sealing
 * the mutation queue. Only ciphertext is retained, only in memory.
 * The existing file authority remains responsible for authentication after
 * the native chooser. No migration grant is issued by this module.
 */
import {ANDROID_BACKUP_MAX_BYTES,readEncryptedBackupOnAndroid,type AndroidBackupRuntime} from './androidBackupExport';

export type RecoverySessionStamp=Readonly<{epoch:number|null;revision:number}>;
export interface RecoveryHandoffOwner {
  /** Logical owner survives an ordinary Android suspension, not reset/restore/lock/unmount. */
  isOwner():boolean;
  /** Must consult the actual session authority, not reauthorize automatically. */
  observeAuthenticated():Promise<RecoverySessionStamp|null>;
  /** Synchronous test of the exact authenticated foreground and revision. */
  isCurrent(stamp:RecoverySessionStamp):boolean;
}

export function createRecoveryCopyHandoff(owner:RecoveryHandoffOwner){
  let busy=false,revision=0;
  let ready:{copy:Blob;stamp:RecoverySessionStamp}|null=null;
  const owns=()=>{try{return owner.isOwner()===true;}catch{return false;}};
  function invalidate(){revision++;ready=null;}
  async function select(read:(active:()=>boolean)=>Promise<Blob|null>,native:boolean){
    if(busy||!owns())return false;
    invalidate();
    const generation=revision;
    busy=true;
    const active=()=>generation===revision&&owns();
    try{
      const copy=await read(active);
      if(!active()||!copy||copy.size===0||copy.size>ANDROID_BACKUP_MAX_BYTES)return false;
      const observed=await owner.observeAuthenticated();
      if(!active()||!observed||!Number.isSafeInteger(observed.revision)||observed.revision<0||
         (observed.epoch!==null&&(!Number.isSafeInteger(observed.epoch)||observed.epoch<0))||
         (native&&observed.epoch===null))return false;
      const stamp=Object.freeze({epoch:observed.epoch,revision:observed.revision});
      if(!owner.isCurrent(stamp)||!active())return false;
      ready={copy,stamp};return true;
    }catch{return false;}
    finally{busy=false;}
  }
  return {
    invalidate,
    selectAndroid(runtime?:AndroidBackupRuntime){
      return select(async active=>{
        const text=await readEncryptedBackupOnAndroid(active,runtime);
        return text===null?null:new Blob([text]);
      },true);
    },
    /** Owner must supply the file selected locally, not a generated export. */
    selectWeb(file:Blob){
      return select(async active=>active()&&file instanceof Blob?file:null,false);
    },
    /** Synchronous, single-use transfer to the owner; do not retain the copy
     * beyond the new attempt. The caller must seal admission in this callback. */
    consume<T>(begin:(copy:Blob,stamp:RecoverySessionStamp)=>T):T|null{
      const entry=ready;
      invalidate();
      if(!entry||!owns())return null;
      try{if(!owner.isCurrent(entry.stamp))return null;}catch{return null;}
      return begin(entry.copy,entry.stamp);
    }
  };
}
