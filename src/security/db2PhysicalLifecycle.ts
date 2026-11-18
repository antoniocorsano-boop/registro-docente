/** DB2 only. Preserve the downgrade fence even after explicit erasure.
 * No production caller; transaction helpers never create or upgrade a DB. */
import {validMeta,validRecords} from './versionFencedVaultStore';
import type {VaultMetadataV1,EncryptedVaultRecord} from './vaultTypes';
const NAME='registro-docente-secure-vault';
export const db2Failure=()=>Error('Archivio aggiornato non verificabile o sessione non attuale.');
export type ErasedDb2=Readonly<{kind:'ERASED_DB2';nonce:string}>;
export type Db2Inventory=
  | {state:'active';metadata:VaultMetadataV1;records:EncryptedVaultRecord[]}
  | {state:'erased';metadata:ErasedDb2;records:[]};

export function sameDb2Physical(a:unknown,b:unknown):boolean{
  if(a===b)return true;
  if(a instanceof ArrayBuffer&&b instanceof ArrayBuffer)return sameDb2Physical(new Uint8Array(a),new Uint8Array(b));
  if(a instanceof Uint8Array&&b instanceof Uint8Array)return a.length===b.length&&a.every((v,i)=>v===b[i]);
  if(a instanceof ArrayBuffer||b instanceof ArrayBuffer||ArrayBuffer.isView(a)||ArrayBuffer.isView(b))return false;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const x=a as Record<string,unknown>,y=b as Record<string,unknown>;
  const k=Object.keys(x).sort(),l=Object.keys(y).sort();
  return k.length===l.length&&k.every((v,i)=>v===l[i]&&sameDb2Physical(x[v],y[v]));
}
function erased(v:unknown):v is ErasedDb2{
  if(!v||typeof v!=='object')return false;
  const x=v as Record<string,unknown>;
  return Object.keys(x).length===2&&x.kind==='ERASED_DB2'&&typeof x.nonce==='string'&&/^[a-f0-9]{32}$/.test(x.nonce);
}
export function createErasedDb2():ErasedDb2{
  return {kind:'ERASED_DB2',nonce:Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('')};
}
export function openDb2(factory:IDBFactory,signal?:AbortSignal):Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(db2Failure());return;}
    let done=false;
    const fail=()=>{if(done)return;done=true;cleanup();reject(db2Failure());};
    const timer=setTimeout(fail,5000);
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',fail);};
    signal?.addEventListener('abort',fail,{once:true});
    try{
      const request=factory.open(NAME,2);
      request.onupgradeneeded=()=>request.transaction?.abort();
      request.onerror=request.onblocked=fail;
      request.onsuccess=()=>{
        const db=request.result;
        if(done||signal?.aborted||db.version!==2){db.close();fail();return;}
        done=true;cleanup();
        db.onversionchange=()=>db.close();
        resolve(db);
      };
    }catch{fail();}
  });
}
export function db2Stores(tx:IDBTransaction){
  const db=tx.db;
  if(db.version!==2||db.objectStoreNames.length!==2||!db.objectStoreNames.contains('metadata')||!db.objectStoreNames.contains('records'))throw db2Failure();
  const m=tx.objectStore('metadata'),r=tx.objectStore('records');
  if(m.keyPath!==null||m.autoIncrement||m.indexNames.length||r.keyPath!=='recordKey'||r.autoIncrement||r.indexNames.length)throw db2Failure();
  return {m,r};
}
/** Runs callback inside the live transaction, after all reads have resolved.
 * No awaited crypto or UI in the transaction. */
export function readDb2InTransaction(tx:IDBTransaction,receive:(value:Db2Inventory)=>void){
  const {m,r}=db2Stores(tx);
  const mk=m.getAllKeys(),mv=m.get('current'),rk=r.getAllKeys(),rv=r.getAll();
  let remaining=4;
  const finish=()=>{
    if(--remaining!==0)return;
    try{
      if(mk.result.length!==1||mk.result[0]!=='current'||rk.result.length!==rv.result.length||
        !rk.result.every((key,i)=>key===rv.result[i].recordKey))throw db2Failure();
      if(validMeta(mv.result)&&validRecords(rv.result)){
        receive({state:'active',metadata:mv.result,records:rv.result});return;
      }
      if(erased(mv.result)&&rk.result.length===0){receive({state:'erased',metadata:mv.result,records:[]});return;}
      throw db2Failure();
    }catch{try{tx.abort();}catch{}}
  };
  mk.onsuccess=mv.onsuccess=rk.onsuccess=rv.onsuccess=finish;
}
export function readDb2(db:IDBDatabase):Promise<Db2Inventory>{
  return new Promise((resolve,reject)=>{
    try{
      const tx=db.transaction(['metadata','records'],'readonly');
      let value:Db2Inventory|undefined;
      tx.oncomplete=()=>value?resolve(value):reject(db2Failure());
      tx.onabort=tx.onerror=()=>reject(db2Failure());
      readDb2InTransaction(tx,v=>{value=v;});
    }catch{reject(db2Failure());}
  });
}
export async function captureDb2(factory:IDBFactory,signal?:AbortSignal){
  const db=await openDb2(factory,signal);
  try{const value=await readDb2(db);if(signal?.aborted)throw db2Failure();return value;}
  finally{db.close();}
}
/** Atomic compare-and-swap of the entire physical image. All old ciphertext
 * and key metadata disappear together, or none does. Abort is effective only
 * before the transaction commits; callers must inspect after uncertainty. */
export async function replaceDb2(factory:IDBFactory,previous:Db2Inventory,next:Db2Inventory,signal:AbortSignal){
  const db=await openDb2(factory,signal);
  try{
    await new Promise<void>((resolve,reject)=>{
      if(signal.aborted){reject(db2Failure());return;}
      try{
        const tx=db.transaction(['metadata','records'],'readwrite');
        const abort=()=>{try{tx.abort();}catch{}};
        signal.addEventListener('abort',abort,{once:true});
        const cleanup=()=>signal.removeEventListener('abort',abort);
        tx.oncomplete=()=>{cleanup();resolve();};
        tx.onabort=tx.onerror=()=>{cleanup();reject(db2Failure());};
        try{
          const {m,r}=db2Stores(tx);
          readDb2InTransaction(tx,actual=>{
            if(signal.aborted||!sameDb2Physical(actual,previous))throw db2Failure();
            r.clear();m.clear();
            m.put(next.metadata,'current');
            for(const record of next.records)r.put(record);
            if(signal.aborted)abort();
          });
        }catch{abort();}
      }catch{reject(db2Failure());}
    });
  }finally{db.close();}
}
