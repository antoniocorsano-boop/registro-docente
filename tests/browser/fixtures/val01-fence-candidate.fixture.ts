// D1b.3a GREEN candidate adapter: isolated version-fenced store.
import {createDb2Lifecycle,inspectDb2LifecycleState} from '../../../src/security/db2Lifecycle';
import {createBackupPayload} from '../../../src/security/backupPayload';
import {encryptDataWithPassword} from '../../../src/cryptoUtils';
import { ExistingSessionVaultStore } from '../../../src/security/existingSessionVaultStore';
import { createLocalMigrationSessionBoundary } from '../../../src/security/migrationSessionBoundary';
import { createDurableMutationCoordinator } from '../../../src/persistence/durableMutationCoordinator';
import { classifyArchivePreflight } from '../../../src/security/archivePreflight';
import { createAuthorizedVaultMigration } from '../../../src/security/authorizedVaultMigration';
import { VersionFencedVaultStore } from '../../../src/security/versionFencedVaultStore';
import { SecureVault } from '../../../src/security/secureVault';
import { SecureAppStorage } from '../../../src/security/secureAppStorage';
import type { VaultRecordKey } from '../../../src/security/vaultTypes';
const name='registro-docente-secure-vault';
const password='synthetic-archive-compatibility-only';
const keys:VaultRecordKey[]=['appData','settings','udas','customTests','submissions','planning','library','professionalMemory','copilotState','meta'];
const store=new VersionFencedVaultStore();
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
const migration=createAuthorizedVaultMigration();
let grant:Awaited<ReturnType<typeof migration.prepare>>|null=null;
Object.assign(globalThis,{__val01FenceCandidate:{
  version,
  db2State:()=>inspectDb2LifecycleState(),
  async db2Lifecycle(action:'restore'|'erase'|'setup',backup?:string,mode='approve'){
    const service=createDb2Lifecycle();
    const old=new ExistingSessionVaultStore(2);
    const stale=new SecureVault(old);
    let staleReady=false;
    if(action!=='setup'&&await inspectDb2LifecycleState()==='active'){
      await stale.unlock(password);staleReady=true;
    }
    try{
      let grant;
      try{
        grant=await service.prepare(action==='restore'?{operation:'restore',password:mode==='wrong-vault'?'wrong':password,file:new Blob([backup??'']),backupPassword:mode==='wrong-copy'?'wrong':'synthetic-archive-backup-only'}:
          action==='erase'?{operation:'erase',password:mode==='wrong-vault'?'wrong':password}:
          {operation:'setup',password:'synthetic-new-password',setup:{mode:'professional',profile:{school:'Synthetic school',year:'2026/2027',teacher:'Synthetic teacher',subject:'Tecnologia'}}});
      }catch{return {result:'prepare-rejected',state:await inspectDb2LifecycleState()};}
      if(mode==='race'&&staleReady)await stale.put('meta',{changes:999,lastBackup:null});
      if(mode==='revoke')service.invalidate();
      try{await service.commit(grant,mode!=='refuse');}
      catch{return {result:'commit-rejected',state:await inspectDb2LifecycleState()};}
      let replay=false;
      try{await service.commit(grant,true);}catch{replay=true;}
      let staleRejected=false;
      if(staleReady){
        try{await stale.put('meta',{changes:1000,lastBackup:null});}catch{staleRejected=true;}
      }
      return {result:'committed',state:await inspectDb2LifecycleState(),replay,staleRejected,version:await version()};
    }finally{stale.lock();await old.retireConnection();service.invalidate();}
  },
  async db2Read(newPassword=false){
    const existing=new ExistingSessionVaultStore(2),v=new SecureVault(existing);
    try{
      await existing.verifyAuthenticatedRecords(newPassword?'synthetic-new-password':password);
      await v.unlock(newPassword?'synthetic-new-password':password);
      return await new SecureAppStorage(v).loadSnapshot();
    }finally{v.lock();await existing.retireConnection();}
  },
  async db2ChangedCopy(){
    const current=await (async()=>{
      const existing=new ExistingSessionVaultStore(2),v=new SecureVault(existing);
      try{await v.unlock(password);return await new SecureAppStorage(v).loadSnapshot();}
      finally{v.lock();await existing.retireConnection();}
    })();
    if(!current.appData||!current.meta)throw Error('Synthetic snapshot missing');
    const next={...current,appData:{...current.appData,classes:[]},meta:{changes:19,lastBackup:null,verifiedBackupAt:'2031-01-01T00:00:00.000Z'}};
    return encryptDataWithPassword(createBackupPayload(next as Parameters<typeof createBackupPayload>[0]),'synthetic-archive-backup-only');
  },
  async verifyExisting(version:1|2,wrong=false){
    const existing=new ExistingSessionVaultStore(version);
    try{
      await existing.verifyAuthenticatedRecords(wrong?'wrong':password);
      return true;
    }catch{return false;}
    finally{await existing.retireConnection();}
  },
  async retireDuringOpen(expected:1|2){
    const existing=new ExistingSessionVaultStore(expected);
    const pending=existing.getMetadata().then(()=>false,()=>true);
    await existing.retireConnection();
    return {rejected:await pending,version:await version()};
  },
  async migrateWithOwnedConnection(backup:string){
    const queue=createDurableMutationCoordinator();
    const previous=new ExistingSessionVaultStore(1);
    const oldVault=new SecureVault(previous);
    await previous.verifyAuthenticatedRecords(password);
    await oldVault.unlock(password);
    const owner=createLocalMigrationSessionBoundary({
      queue,isCurrent:()=>true,
      readLocalCopy:async()=>new Blob([backup]),
      confirm:async()=>true,
      retireDb1:async()=>{oldVault.lock();await previous.retireConnection();}
    });
    const result=await owner.run(password,'synthetic-archive-backup-only');
    let retired=false;
    try{await previous.getMetadata();}catch{retired=true;}
    const next=new ExistingSessionVaultStore(2);
    try{
      await next.verifyAuthenticatedRecords(password);
      const nextVault=new SecureVault(next);
      await nextVault.unlock(password);
      try{
        const snapshot=await new SecureAppStorage(nextVault).loadSnapshot();
        return {result,retired,version:await version(),snapshot};
      }finally{nextVault.lock();}
    }finally{await next.retireConnection();}
  },
  async runSessionMigration(backup:string,mode:'approve'|'refuse'|'revoke'|'wrong-copy'){
    // Isolated browser fixture: no live App, no native file authority.
    // The historical page was unloaded before this adapter is invoked.
    const queue=createDurableMutationCoordinator();
    let owner:ReturnType<typeof createLocalMigrationSessionBoundary>;
    owner=createLocalMigrationSessionBoundary({
      queue,isCurrent:()=>true,
      readLocalCopy:async()=>new Blob([backup]),
      confirm:async()=>{if(mode==='revoke')owner.revoke();return mode!=='refuse';},
      retireDb1:async()=>{} // this fixture owns no open DB1 runtime handle
    });
    const result=await owner.run(password,mode==='wrong-copy'?'wrong':'synthetic-archive-backup-only');
    let sealed=false;
    try{await queue.enqueueTask(()=>1);}catch{sealed=true;}
    return {result,sealed,version:await version()};
  },
  async preflight(wrongPassword=false,revocation=false){
    const controller=new AbortController();
    const pending=classifyArchivePreflight(wrongPassword?'wrong':password,controller.signal);
    if(revocation)controller.abort();
    return pending;
  },
  async preflightInventory(change?:'sparse'|'unknown'|'tamper'|'metadata'|'record-shape',expectedVersion:1|2=1){
    // Synthetic fixture only. Fingerprint the raw database, including all keys
    // and byte arrays, not the logical defaults returned by the historical App.
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      const req=indexedDB.open(name,expectedVersion);
      req.onupgradeneeded=()=>req.transaction?.abort();
      req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
    });
    try{
      if(change)await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction(['metadata','records'],'readwrite');
        tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error);
        const records=tx.objectStore('records'),meta=tx.objectStore('metadata');
        if(change==='sparse')for(const key of keys.filter(k=>!['appData','meta'].includes(k)))records.delete(key);
        else if(change==='metadata'){const req=meta.get('current');req.onsuccess=()=>meta.put({...req.result,state:'STAGING'},'current');}
        else {const req=records.get('appData');req.onsuccess=()=>{
          const r=req.result;
          if(change==='unknown')records.put({...r,recordKey:'unknown'});
          else if(change==='record-shape')records.put({...r,schemaVersion:2});
          else {const data=new Uint8Array(r.ciphertext);data[0]^=1;records.put({...r,ciphertext:data.buffer});}
        };}
      });
      const raw=await new Promise<unknown>((resolve,reject)=>{
        const tx=db.transaction(['metadata','records'],'readonly');
        const m=tx.objectStore('metadata'),r=tx.objectStore('records');
        const mk=m.getAllKeys(),mv=m.getAll(),rk=r.getAllKeys(),rv=r.getAll();
        tx.oncomplete=()=>resolve([db.version,mk.result,mv.result,rk.result,rv.result]);
        tx.onabort=tx.onerror=()=>reject(tx.error);
      });
      const serialized=JSON.stringify(raw,(_key,value)=>value instanceof ArrayBuffer?Array.from(new Uint8Array(value)):value instanceof Uint8Array?Array.from(value):value);
      return digest(new TextEncoder().encode(serialized));
    }finally{db.close();}
  },
  async prepareMigration(backup:string,wrongVault=false,wrongBackup=false){
    grant=null;
    grant=await migration.prepare(wrongVault?'wrong':password,new Blob([backup]),
      wrongBackup?'wrong':'synthetic-archive-backup-only');
    return grant;
  },
  async migrate(confirmed=true,copyGrant=false){
    if(!grant)throw Error('No grant');
    await migration.migrate(copyGrant?{...grant}:grant,confirmed);
    return version();
  },
  invalidateMigration(){migration.invalidate();},
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
