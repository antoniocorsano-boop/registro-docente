// D1b.3a RED baseline: the unmodified v1 store cannot enforce a v2 fence.
// Replace only the candidate store implementation after causal browser RED.
import { IndexedDbVaultStore } from '../../../src/security/vaultStore';
import { SecureVault } from '../../../src/security/secureVault';
import { SecureAppStorage } from '../../../src/security/secureAppStorage';
import type { VaultRecordKey } from '../../../src/security/vaultTypes';
const name='registro-docente-secure-vault';
const password='synthetic-archive-compatibility-only';
const keys:VaultRecordKey[]=['appData','settings','udas','customTests','submissions','planning','library','professionalMemory','copilotState','meta'];
const store=new IndexedDbVaultStore();
const vault=new SecureVault(store);
const storage=new SecureAppStorage(vault);
const bytes=(value:ArrayBuffer|Uint8Array)=>new Uint8Array(value instanceof Uint8Array?value.slice().buffer:value);
async function digest(value:ArrayBuffer|Uint8Array){
  const hash=await crypto.subtle.digest('SHA-256',bytes(value));
  return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
}
async function physical(){
  const meta=await store.getMetadata();
  if(!meta)throw Error('Missing metadata');
  const records=await Promise.all(keys.map(async key=>{
    const r=await store.getRecord(key);
    if(!r)throw Error('Missing encrypted record '+key);
    return {key,version:r.schemaVersion,iv:await digest(r.iv),ciphertext:await digest(r.ciphertext)};
  }));
  return {version:meta.vaultVersion,state:meta.state,kdf:meta.kdf,createdAt:meta.createdAt,updatedAt:meta.updatedAt,
    salt:await digest(meta.salt),wrappedDek:await digest(meta.wrappedDek),wrapIv:await digest(meta.wrapIv),records,keys:(await store.listRecordKeys()).sort()};
}
async function version(){return (await indexedDB.databases()).find(db=>db.name===name)?.version??null;}
async function opened(){
  await vault.unlock(password);
  return {snapshot:await storage.loadSnapshot(),physical:await physical()};
}
Object.assign(globalThis,{__val01FenceCandidate:{
  version,
  async upgrade(){await store.getMetadata();return version();},
  open:opened,
  async mutate(){
    const current=await opened();
    if(!current.snapshot.appData||!current.snapshot.meta)throw Error('Missing archive');
    current.snapshot.appData.classes[0].grades[0].value='9';
    await storage.saveAppDataAndMeta(current.snapshot.appData,{...current.snapshot.meta,changes:current.snapshot.meta.changes+1});
    return opened();
  }
}});
