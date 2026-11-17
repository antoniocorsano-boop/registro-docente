/**
 * VAL-01/D1b.3a — isolated IndexedDB version fence.
 * No production construction or migration authorization. The future session
 * owner must prove a verified recovery copy and authorize upgrade explicitly.
 * Same database, same stores, same encrypted record format: no data rewrite.
 */
import { IndexedDbVaultStore } from './vaultStore';

const DB_NAME='registro-docente-secure-vault';
const DB_VERSION=2;
const META='metadata';
const RECORDS='records';
const KEYS=['appData','settings','udas','customTests','submissions','planning','library','professionalMemory','copilotState','meta'].sort();
const error=()=>new Error('Archivio precedente assente, incompleto o non compatibile.');
const object=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const buffer=(x:unknown,min:number)=>x instanceof ArrayBuffer&&x.byteLength>=min;
const bytes=(x:unknown,length:number)=>x instanceof Uint8Array&&x.byteLength===length;
export function validMeta(m:unknown):boolean{
  return object(m)&&m.vaultVersion===1&&m.state==='ACTIVE'&&object(m.kdf)&&
    m.kdf.name==='PBKDF2'&&m.kdf.hash==='SHA-256'&&m.kdf.iterations===600000&&
    bytes(m.salt,16)&&bytes(m.wrapIv,12)&&buffer(m.wrappedDek,16)&&
    typeof m.createdAt==='string'&&Number.isFinite(Date.parse(m.createdAt))&&
    typeof m.updatedAt==='string'&&Number.isFinite(Date.parse(m.updatedAt));
}
export function validRecords(values:unknown):boolean{
  return Array.isArray(values)&&values.length===KEYS.length&&
    values.every(r=>object(r)&&typeof r.recordKey==='string'&&r.schemaVersion===1&&bytes(r.iv,12)&&buffer(r.ciphertext,16))&&
    values.map(r=>r.recordKey).sort().every((k,i)=>k===KEYS[i]);
}

/** Upgrade is deliberately non-destructive and isolated from v1 runtime.
 * In particular an onblocked notification is NOT cancellation in IndexedDB.
 * An abandoned request must abort on any subsequent upgradeneeded event.
 */
export type MigrationFenceGuard=(metadata:unknown,records:unknown,transaction:IDBTransaction)=>void;

export class VersionFencedVaultStore extends IndexedDbVaultStore {
  private readonly versionFactory:IDBFactory;
  private opening:Promise<IDBDatabase>|null=null;
  private retired=false;
  constructor(factory:IDBFactory|undefined=globalThis.indexedDB,private readonly migrationGuard?:MigrationFenceGuard){
    super(factory);
    if(!factory)throw error();
    this.versionFactory=factory;
  }

  /** Retire a one-shot migration connection; never clear the archive. */
  async close():Promise<void>{
    this.retired=true;
    try{(await this.opening)?.close();}catch{/* An unsuccessful open has no connection. */}
  }

  override async retireConnection():Promise<void>{await this.close();}

  protected override openDatabase():Promise<IDBDatabase>{
    if(this.retired)return Promise.reject(new Error('Sessione archivio non più attuale.'));
    if(this.opening)return this.opening;
    const attempt=new Promise<IDBDatabase>((resolve,reject)=>{
      const request=this.versionFactory.open(DB_NAME,DB_VERSION);
      let abandoned=false;
      let guardedUpgrade=false;
      let failure:Error|null=null;
      const abort=(tx:IDBTransaction,reason:Error)=>{
        failure=reason;
        try{tx.abort();}catch{/* Already aborted or finished. */}
      };
      request.onblocked=()=>{
        abandoned=true;
        failure=new Error('Apertura IndexedDB bloccata da un’altra sessione.');
        reject(failure);
      };
      request.onupgradeneeded=event=>{
        const tx=request.transaction;
        if(!tx)return;
        if(abandoned){abort(tx,failure??error());return;}
        try{
          const db=request.result;
          if(event.oldVersion!==1||db.objectStoreNames.length!==2||
             !db.objectStoreNames.contains(META)||!db.objectStoreNames.contains(RECORDS)){
            abort(tx,error());return;
          }
          const metadata=tx.objectStore(META),records=tx.objectStore(RECORDS);
          if(metadata.keyPath!==null||metadata.autoIncrement||records.keyPath!=='recordKey'||records.autoIncrement){
            abort(tx,error());return;
          }
          // Read all keys and encrypted records inside the upgrade transaction.
          // No put, clear, delete, or schema rewrite is performed.
          const metaKeys=metadata.getAllKeys();
          const meta=metadata.get('current');
          const encrypted=records.getAll();
          let remaining=3;
          const check=()=>{
            if(--remaining!==0)return;
            try{
              if(abandoned||metaKeys.result.length!==1||metaKeys.result[0]!=='current'||
                 !validMeta(meta.result)||!validRecords(encrypted.result)){abort(tx,error());return;}
              if(this.migrationGuard){this.migrationGuard(meta.result,encrypted.result,tx);guardedUpgrade=true;}
            }catch{abort(tx,error());}
          };
          metaKeys.onsuccess=check;meta.onsuccess=check;encrypted.onsuccess=check;
          // Default request error handling aborts the versionchange transaction.
        }catch{abort(tx,error());}
      };
      request.onerror=()=>reject(failure??request.error??error());
      request.onsuccess=()=>{
        const db=request.result;
        if(abandoned||this.retired){db.close();reject(failure??error());return;}
        if((this.migrationGuard&&!guardedUpgrade)||db.version!==DB_VERSION||db.objectStoreNames.length!==2||
           !db.objectStoreNames.contains(META)||!db.objectStoreNames.contains(RECORDS)){
          db.close();reject(error());return;
        }
        db.onversionchange=()=>{this.retired=true;db.close();};
        db.onclose=()=>{this.retired=true;};
        resolve(db);
      };
    });
    this.opening=attempt;
    // A blocked/error request can be retried; the abandoned request retains
    // its own abort handler and cannot upgrade after a successful retry.
    void attempt.catch(()=>{if(this.opening===attempt)this.opening=null;});
    return attempt;
  }
}
