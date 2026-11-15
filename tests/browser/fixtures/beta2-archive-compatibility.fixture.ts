// Copied verbatim into src/ of each exact source checkout by the isolated workflow.
// No production entrypoint, no native bridge, only synthetic data.
import { SecureVault } from './security/secureVault';
import { IndexedDbVaultStore } from './security/vaultStore';
import { SecureAppStorage, type CompleteSecureAppSnapshot } from './security/secureAppStorage';
import type { VaultRecordKey } from './security/vaultTypes';
import { createBackupPayload, normalizeBackupPayloadVerified } from './security/backupPayload';
import { encryptDataWithPassword, decryptDataWithPassword } from './cryptoUtils';
import { createEmptyPlanningState } from './planning/emptyPlanningState';
import { createEmptyProfessionalMemoryState } from './memory/emptyProfessionalMemoryState';
import { createEmptyCopilotState } from './copilot/emptyCopilotState';

const keys: VaultRecordKey[] = ['appData','settings','udas','customTests','submissions','planning','library','professionalMemory','copilotState','meta'];
const password='synthetic-archive-compatibility-only';
const backupPassword='synthetic-archive-backup-only';
const date='2026-11-12';
const stamp=date+'T09:00:00.000Z';
const store=new IndexedDbVaultStore();
const vault=new SecureVault(store);
const storage=new SecureAppStorage(vault);

function fixture(empty=false): CompleteSecureAppSnapshot {
  return {
    appData:{currentClassId:null,classes:empty?[]:[{
      id:'synthetic-class',name:'Classe sintetica',students:[{id:'synthetic-student',name:'Alunno sintetico'}],
      grades:[{id:'synthetic-grade',batchId:'synthetic-batch',studentId:'synthetic-student',date,type:'disegno',period:'Q1',title:'Prova sintetica',value:'8.5',udaId:'synthetic-uda'}],
      behaviors:[{id:'synthetic-behavior',studentId:'synthetic-student',date,status:'Costruttivo 👍',note:'Nota sintetica'}]
    }]},
    settings:{school:'Istituto sintetico',year:'2026/2027',teacher:'Docente sintetico',subject:'Tecnologia',theme:'matrix'},
    udas:empty?[]:[{id:'synthetic-uda',className:'Classe sintetica',title:'UDA sintetica',hours:3,period:'Q1',startMonth:2,durationMonths:1,lessons:[{id:'synthetic-lesson',date,topic:'Lezione sintetica',hours:1}]}],
    customTests:empty?{}:{'synthetic-test':{id:'synthetic-test',title:'Verifica sintetica',questions:[{q:'Domanda sintetica',options:['A','B'],correct:0}],udaId:'synthetic-uda'}},
    submissions:empty?[]:[{id:'synthetic-submission',name:'Alunno sintetico',class:'Classe sintetica',testTitle:'Verifica sintetica',testId:'synthetic-test',score:1,total:1,date:stamp}],
    planning:createEmptyPlanningState(),
    library:{schemaVersion:1,sources:empty?[]:[{id:'synthetic-source',kind:'text',title:'Fonte sintetica',capturedAt:stamp,payload:{text:'Materiale sintetico'},status:'ready',privacy:'teacher-professional',links:[{targetType:'uda',targetId:'synthetic-uda'}]}]},
    professionalMemory:createEmptyProfessionalMemoryState(),copilotState:createEmptyCopilotState(),
    meta:{changes:empty?0:7,lastBackup:empty?null:stamp}
  };
}
function complete(snapshot:Awaited<ReturnType<SecureAppStorage['loadSnapshot']>>):CompleteSecureAppSnapshot{
  for(const key of keys)if(snapshot[key]===null||snapshot[key]===undefined)throw Error('Missing dataset '+key);
  return snapshot as CompleteSecureAppSnapshot;
}
const bytes=(value:ArrayBuffer|Uint8Array)=>Array.from(value instanceof Uint8Array?value:new Uint8Array(value));
async function digest(value:ArrayBuffer|Uint8Array){
  const copy=Uint8Array.from(bytes(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',copy))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function physical(){
  const meta=await store.getMetadata();
  if(!meta)throw Error('No metadata');
  const records=await Promise.all(keys.map(async key=>{
    const r=await store.getRecord(key);
    if(!r)throw Error('Missing encrypted record '+key);
    return {key,version:r.schemaVersion,iv:await digest(r.iv),ciphertext:await digest(r.ciphertext)};
  }));
  return {version:meta.vaultVersion,state:meta.state,kdf:meta.kdf,createdAt:meta.createdAt,updatedAt:meta.updatedAt,
    salt:await digest(meta.salt),wrappedDek:await digest(meta.wrappedDek),wrapIv:await digest(meta.wrapIv),records,keys:(await store.listRecordKeys()).sort()};
}
const api={
  async seed(empty=false){
    if(await store.getMetadata())throw Error('Fixture cannot overwrite archive');
    await vault.initializeActive(password);
    await storage.restoreSnapshotVerified(fixture(empty));
    const snapshot=complete(await storage.loadSnapshot());
    const backup=await encryptDataWithPassword(createBackupPayload(snapshot,stamp),backupPassword);
    vault.lock();
    return {snapshot,backup,physical:await physical()};
  },
  async open(){
    await vault.unlock(password);
    return {snapshot:complete(await storage.loadSnapshot()),physical:await physical()};
  },
  async rejectWrongPassword(){
    try{await vault.unlock('wrong-synthetic-password');}catch{return !vault.isUnlocked();}
    throw Error('Wrong password accepted');
  },
  async raw(){return physical();},
  async mutate(){
    const snapshot=complete(await storage.loadSnapshot());
    const grade=snapshot.appData.classes[0]?.grades[0];
    if(!grade)throw Error('Expected synthetic grade');
    grade.value='9';
    const meta={...snapshot.meta,changes:snapshot.meta.changes+1};
    await storage.saveAppDataAndMeta(snapshot.appData,meta);
    vault.lock();
    await vault.unlock(password);
    return {snapshot:complete(await storage.loadSnapshot()),physical:await physical()};
  },
  async restoreOldBackup(backup:string){
    const snapshot=complete(await storage.loadSnapshot());
    // Reject wrong backup password before touching the archive.
    const before=await physical();
    try{await decryptDataWithPassword(backup,'wrong-synthetic-backup');throw Error('Wrong backup password accepted');}
    catch(error){if(error instanceof Error&&error.message==='Wrong backup password accepted')throw error;}
    if(JSON.stringify(before)!==JSON.stringify(await physical()))throw Error('Rejected backup changed archive');
    const decoded=await decryptDataWithPassword(backup,backupPassword);
    const candidate=await normalizeBackupPayloadVerified(decoded,snapshot);
    await storage.restoreSnapshotVerified(candidate,snapshot);
    vault.lock();
    await vault.unlock(password);
    return {snapshot:complete(await storage.loadSnapshot()),physical:await physical()};
  },
  lock(){vault.lock();}
};
Object.assign(globalThis,{__beta2ArchiveCompatibility:api});
