// Synthetic CI only. No native authorization or migration API on this page.
// Never import from src/main.tsx.
import {inspectArchiveVersion} from '../../../src/security/inspectArchiveVersion';
import {IndexedDbVaultStore} from '../../../src/security/vaultStore';
import {ExistingSessionVaultStore} from '../../../src/security/existingSessionVaultStore';
import {SecureVault} from '../../../src/security/secureVault';
import {SecureAppStorage,type CompleteSecureAppSnapshot} from '../../../src/security/secureAppStorage';
import {classifyArchivePreflight} from '../../../src/security/archivePreflight';
import {createBackupPayload} from '../../../src/security/backupPayload';
import {withoutLocalBackupVerification} from '../../../src/persistence/backupCheckpoint';
import {encryptDataWithPassword} from '../../../src/cryptoUtils';
const name='registro-docente-secure-vault';
const password='synthetic-archive-compatibility-only';
const copyPassword='synthetic-archive-backup-only';
async function raw(){
  const version=await inspectArchiveVersion();
  if(version===null)throw Error('Synthetic archive absent');
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(name,version);
    request.onupgradeneeded=()=>request.transaction?.abort();
    request.onerror=()=>reject(Error('Read-only open failed'));
    request.onsuccess=()=>resolve(request.result);
  });
  try{
    const value=await new Promise<{metadataKeys:IDBValidKey[];metadata:unknown[];keys:IDBValidKey[];records:unknown[]}>((resolve,reject)=>{
      const tx=db.transaction(['metadata','records'],'readonly');
      const m=tx.objectStore('metadata'),r=tx.objectStore('records');
      const mk=m.getAllKeys(),mv=m.getAll(),rk=r.getAllKeys(),rv=r.getAll();
      tx.oncomplete=()=>resolve({metadataKeys:mk.result,metadata:mv.result,keys:rk.result,records:rv.result});
      tx.onerror=tx.onabort=()=>reject(Error('Read-only inventory failed'));
    });
    const json=JSON.stringify(value,(_k,v)=>v instanceof ArrayBuffer?Array.from(new Uint8Array(v)):v instanceof Uint8Array?Array.from(v):v);
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(json))),x=>x.toString(16).padStart(2,'0')).join('');
    return {version,keys:value.keys,digest};
  }finally{db.close();}
}
async function inspect(includeCopy=false){
  const before=await raw();
  const store=before.version===2?new ExistingSessionVaultStore(2):new IndexedDbVaultStore(globalThis.indexedDB,true);
  const vault=new SecureVault(store);
  try{
    await vault.unlock(password);
    if(store instanceof ExistingSessionVaultStore)await store.verifyAuthenticatedRecords(password);
    const snapshot=await new SecureAppStorage(vault).loadSnapshot();
    const marker=snapshot.appData?.classes.some(c=>c.name==='Collaudo migrazione VAL01')===true;
    const classification=before.version===1?await classifyArchivePreflight(password):'existing-v2';
    let backup:string|undefined;
    if(includeCopy){
      if(classification==='complete'){
        const complete=snapshot as CompleteSecureAppSnapshot;
        backup=await encryptDataWithPassword(createBackupPayload({...complete,meta:withoutLocalBackupVerification(complete.meta)},new Date().toISOString()),copyPassword);
      }else{
        // Negative-only predecessor: an encrypted synthetic file, not a
        // claim of a valid recovery copy or an attempt to populate missing records.
        backup=await encryptDataWithPassword({negativeOnly:true},copyPassword);
      }
    }
    return {...before,classification,marker,snapshot,backup};
  }finally{vault.lock();await store.retireConnection();}
}
Object.assign(globalThis,{__val01ProductInspection:{inspect,raw}});
