// CI emulator only. This file is never imported by the product entrypoint.
import '../../tests/browser/fixtures/val01-fence-candidate.fixture';
import { IndexedDbVaultStore } from '../../src/security/vaultStore';
import { SecureVault } from '../../src/security/secureVault';
import { SecureAppStorage, type CompleteSecureAppSnapshot } from '../../src/security/secureAppStorage';
import type { VaultRecordKey } from '../../src/security/vaultTypes';
import { createBackupPayload } from '../../src/security/backupPayload';
import { withoutLocalBackupVerification } from '../../src/persistence/backupCheckpoint';
import { encryptDataWithPassword } from '../../src/cryptoUtils';
import { createAuthorizedVaultMigration } from '../../src/security/authorizedVaultMigration';
import { readEncryptedBackupOnAndroid, saveEncryptedBackupOnAndroid } from '../../src/security/androidBackupExport';
import { readAndroidSessionState, authorizeAndroidSession, acknowledgeAndroidShield, registerAndroidFileAccess } from '../../src/security/androidSessionLifecycle';

const password='synthetic-archive-compatibility-only';
const backupPassword='synthetic-archive-backup-only';
const filename='Backup_Cifrato_GDPR_2031-01-15.enc.json';
const migration=createAuthorizedVaultMigration();
type MigrationGrant=Awaited<ReturnType<typeof migration.prepare>>;
let grant:MigrationGrant|null=null;
let generation=0;
let readState: {phase:string;sha256?:string;bytes?:number;grant?:MigrationGrant|null}={phase:'idle'};
// A synthetic lab session, not the production Vault owner. The native plugin
// and actual document picker are unchanged. Reauthorize after picker return
// only within the current synthetic operation; never use this in production.
async function access(active:()=>boolean){
  for(let i=0;i<100&&active();i++){
    const s=await readAndroidSessionState();
    if(s?.foreground){
      await authorizeAndroidSession(s.epoch);
      if(!active())return false;
      await acknowledgeAndroidShield(s.epoch,true);
      return active();
    }
    await new Promise(r=>setTimeout(r,100));
  }
  return false;
}
registerAndroidFileAccess(access);
// In the integral-APK lab only, inspect DB1 actually created by the original
// app UI. No writes or migration here; close the v1 connection before upgrading.
// Diagnostic only: disclose record categories and stage, never record values.
async function probeHistoricalArchive(){
  const name='registro-docente-secure-vault';
  const required:VaultRecordKey[]=['appData','settings','udas','customTests','submissions','planning','library','professionalMemory','copilotState','meta'];
  const report={version:0,metadata:'unverified',authentication:'not-run',present:[] as VaultRecordKey[],missing:[...required],authenticated:[] as VaultRecordKey[],failed:[] as VaultRecordKey[],marker:false,phase:'version'};
  try{
    report.version=(await indexedDB.databases()).find(db=>db.name===name)?.version??0;
    if(report.version!==1)return report;
    const store=new class extends IndexedDbVaultStore{
      async release(){(await this.openDatabase()).close();}
    }();
    const vault=new SecureVault(store);
    try{
      report.phase='inventory';
      report.present=(await store.listRecordKeys()).sort();
      report.missing=required.filter(k=>!report.present.includes(k));
      const meta=await store.getMetadata();
      report.metadata=meta?.state??'absent';
      report.phase='unlock';
      try{await vault.unlock(password);report.authentication='accepted';}
      catch{report.authentication='rejected';return report;}
      report.phase='record-authentication';
      for(const key of report.present){
        try{
          const value=await vault.get<unknown>(key);
          report.authenticated.push(key);
          if(key==='appData'){
            const data=value as CompleteSecureAppSnapshot['appData']|null;
            report.marker=!!data?.classes?.some(c=>c.name==='Collaudo migrazione VAL01');
          }
        }catch{report.failed.push(key);}
      }
      report.phase='complete';
      return report;
    }finally{vault.lock();await store.release();}
  }catch{return report;}
}
async function inspectHistoricalArchive(){
  const name='registro-docente-secure-vault';
  if((await indexedDB.databases()).find(db=>db.name===name)?.version!==1)throw Error('Expected existing DB1');
  const store=new class extends IndexedDbVaultStore{
    async release(){(await this.openDatabase()).close();}
  }();
  const vault=new SecureVault(store);
  const storage=new SecureAppStorage(vault);
  const keys:VaultRecordKey[]=['appData','settings','udas','customTests','submissions','planning','library','professionalMemory','copilotState','meta'];
  const digest=async(v:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(v instanceof Uint8Array?v.slice().buffer:v))),x=>x.toString(16).padStart(2,'0')).join('');
  try{
    await vault.unlock(password);
    const snapshot=await storage.loadSnapshot();
    if(keys.some(k=>snapshot[k]===null||snapshot[k]===undefined)||!snapshot.appData?.classes.some(c=>c.name==='Collaudo migrazione VAL01'))throw Error('Missing synthetic archive marker or dataset');
    const meta=await store.getMetadata();
    if(!meta)throw Error('Missing metadata');
    const records=await Promise.all(keys.map(async key=>{
      const r=await store.getRecord(key);
      if(!r)throw Error('Missing encrypted record');
      return {key,version:r.schemaVersion,iv:await digest(r.iv),ciphertext:await digest(r.ciphertext)};
    }));
    const physical={version:meta.vaultVersion,state:meta.state,kdf:meta.kdf,createdAt:meta.createdAt,updatedAt:meta.updatedAt,
      salt:await digest(meta.salt),wrappedDek:await digest(meta.wrappedDek),wrapIv:await digest(meta.wrapIv),records,keys:(await store.listRecordKeys()).sort()};
    const complete=snapshot as CompleteSecureAppSnapshot;
    const backup=await encryptDataWithPassword(createBackupPayload({...complete,meta:withoutLocalBackupVerification(complete.meta)},new Date().toISOString()),backupPassword);
    return {snapshot,physical,backup};
  }finally{vault.lock();await store.release();}
}
Object.assign(globalThis,{__val01NativeLab:{
  inspectHistoricalArchive,
  probeHistoricalArchive,
  async ready(){return access(()=>true);},
  async write(backup:string){const epoch=++generation;return saveEncryptedBackupOnAndroid(backup,filename,()=>epoch===generation);},
  readState(){return readState;},
  async readAndPrepare(wrongPassword=false){
    migration.invalidate();grant=null;
    const epoch=++generation;
    const active=()=>epoch===generation;
    readState={phase:'picker'};
    try{
      const text=await readEncryptedBackupOnAndroid(active);
      if(text===null||!active()){readState={phase:'cancelled'};return null;}
      const bytes=new TextEncoder().encode(text);
      const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
      readState={phase:'native-read-verified',sha256,bytes:bytes.length};
      try{
        grant=await migration.prepare(password,new Blob([text]),wrongPassword?'wrong-synthetic':backupPassword);
      }catch(e){
        if(e instanceof Error&&e.message==='Migrazione non autorizzata: archivio o copia di recupero non verificabili.'){
          readState={...readState,phase:'authorization-rejected'};return null;
        }
        throw e;
      }
      if(!active()){migration.invalidate();grant=null;readState={phase:'cancelled'};return null;}
      readState={...readState,phase:'authorized',grant};
      return grant;
    }catch(e){readState={phase:'native-error'};throw e;}
  },
  async migrate(confirmed:boolean){
    if(!grant)throw Error('No authorization');
    try{await migration.migrate(grant,confirmed);return 'accepted';}
    catch(e){
      if(e instanceof Error&&e.message==='Migrazione non autorizzata: archivio o copia di recupero non verificabili.')return 'rejected';
      throw e;
    }
  },
  invalidate(){generation++;grant=null;migration.invalidate();}
}});
