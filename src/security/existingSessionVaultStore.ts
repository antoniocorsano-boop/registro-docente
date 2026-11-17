/**
 * VAL-01/D1b.4b.2a — existing-only connection for a future authenticated
 * migration session. No production caller. Never creates or upgrades a DB.
 * The owner must seal and drain mutation admission before retiring a handle.
 */
import {IndexedDbVaultStore} from './vaultStore';
import {validMeta,validRecords} from './versionFencedVaultStore';
import {deriveKeyEncryptionKey,unwrapDataEncryptionKey,decryptJsonRecord} from './cryptoPrimitives';
import type {VaultMetadataV1,EncryptedVaultRecord} from './vaultTypes';

const NAME='registro-docente-secure-vault';
const refused=()=>Error('Archivio esistente non verificabile.');
type Inventory={metadata:VaultMetadataV1;records:EncryptedVaultRecord[]};

function inventory(db:IDBDatabase):Promise<Inventory>{
  return new Promise((resolve,reject)=>{
    try{
      if(db.objectStoreNames.length!==2||!db.objectStoreNames.contains('metadata')||
        !db.objectStoreNames.contains('records'))throw refused();
      const tx=db.transaction(['metadata','records'],'readonly');
      const m=tx.objectStore('metadata'),r=tx.objectStore('records');
      if(m.keyPath!==null||m.autoIncrement||m.indexNames.length!==0||
        r.keyPath!=='recordKey'||r.autoIncrement||r.indexNames.length!==0){
        tx.abort();throw refused();
      }
      const mk=m.getAllKeys(),mv=m.get('current'),rk=r.getAllKeys(),rv=r.getAll();
      tx.onabort=tx.onerror=()=>reject(refused());
      tx.oncomplete=()=>{
        try{
          if(mk.result.length!==1||mk.result[0]!=='current'||!validMeta(mv.result)||
            !validRecords(rv.result)||rk.result.length!==rv.result.length||
            !rk.result.every((key,i)=>key===rv.result[i].recordKey))throw refused();
          resolve({metadata:mv.result as VaultMetadataV1,records:rv.result as EncryptedVaultRecord[]});
        }catch{reject(refused());}
      };
    }catch{reject(refused());}
  });
}

export class ExistingSessionVaultStore extends IndexedDbVaultStore{
  private readonly sessionFactory:IDBFactory;
  private retired=false;
  private connection:IDBDatabase|null=null;
  private opening:Promise<IDBDatabase>|null=null;
  private cancelOpening:(()=>void)|null=null;
  constructor(private readonly expectedVersion:1|2,factory:IDBFactory|undefined=globalThis.indexedDB){
    super(factory);
    if(!factory||(expectedVersion!==1&&expectedVersion!==2))throw refused();
    this.sessionFactory=factory;
  }
  /** Permanent retirement, including an open request that has not resolved.
   * IDB close waits for existing transactions: owner must drain first. */
  override async retireConnection():Promise<void>{
    this.retired=true;
    this.cancelOpening?.();
    this.connection?.close();
    this.connection=null;
  }
  protected override openDatabase():Promise<IDBDatabase>{
    if(this.retired)return Promise.reject(refused());
    if(this.opening)return this.opening;
    this.opening=new Promise<IDBDatabase>((resolve,reject)=>{
      let settled=false;
      let db:IDBDatabase|null=null;
      const cleanup=()=>{clearTimeout(timer);this.cancelOpening=null;};
      const fail=()=>{
        if(settled)return;
        settled=true;cleanup();
        db?.close();
        reject(refused());
      };
      const timer=setTimeout(fail,5000);
      this.cancelOpening=fail;
      try{
        const request=this.sessionFactory.open(NAME,this.expectedVersion);
        request.onblocked=fail;
        request.onerror=fail;
        // Abort even when this request was already rejected or retired.
        request.onupgradeneeded=()=>{request.transaction?.abort();};
        request.onsuccess=()=>{
          db=request.result;
          if(settled||this.retired){db.close();fail();return;}
          if(db.version!==this.expectedVersion){fail();return;}
          db.onversionchange=()=>{void this.retireConnection();};
          db.onclose=()=>{void this.retireConnection();};
          const opened=db;
          void inventory(opened).then(()=>{
            if(settled||this.retired){opened.close();fail();return;}
            settled=true;cleanup();this.connection=opened;resolve(opened);
          },fail);
        };
      }catch{fail();}
    });
    // No retry on the same instance: a fresh owner must explicitly reopen.
    return this.opening;
  }
  /** Authenticate every physical record, including those for which the
   * application normally substitutes defaults. Point-in-time evidence only.
   * No normalization, writes, grants or exposure of decrypted values. */
  async verifyAuthenticatedRecords(password:string,signal?:AbortSignal):Promise<void>{
    const check=()=>{if(this.retired||signal?.aborted)throw refused();};
    try{
      check();
      const db=await this.openDatabase();check();
      const raw=await inventory(db);check();
      const kek=await deriveKeyEncryptionKey(password,raw.metadata.salt);check();
      const dek=await unwrapDataEncryptionKey(raw.metadata.wrappedDek,raw.metadata.wrapIv,kek);check();
      for(const r of raw.records){await decryptJsonRecord<unknown>(r,dek);check();}
    }catch{
      await this.retireConnection();
      throw refused();
    }
  }
}
