// VAL-01/D1b.2a — synthetic codec only; not a restore or write authorization.
import {describe,expect,test,beforeAll} from 'bun:test';
import {createAssessmentBackupPayloadV7,inspectAssessmentBackupPayload} from './assessmentBackupPayload';
import {createBackupPayload,normalizeBackupPayload} from './backupPayload';
import {createInitialArchiveSnapshot} from './initialArchiveSetup';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import {encryptDataWithPassword,decryptDataWithPassword} from '../cryptoUtils';

beforeAll(()=>{
  const root=globalThis as typeof globalThis & {window?:typeof globalThis};
  if(!root.window)root.window=globalThis;
});
const s={classId:'class-a',schoolYear:'2026/2027',subjectCode:'TECH'};
const date='2026-11-16',stamp='2026-11-16T10:00:00.000Z';
const c={confirmedByTeacher:true,confirmedAt:stamp};
const proof={batchId:'batch-synthetic',date,period:'Q1',type:'disegno',title:'Schema sintetico'};
const fact={kind:'product',description:'Schema sintetico',method:'elaborato'};
function section():any{
  return {document:{version:1,...s,
    references:[{...c,referenceId:'o',revisionId:'o-r1',kind:'specific-objective',text:'Rappresentare relazioni',source:{kind:'local',sourceVersion:'v1'}}],
    criteria:[{...c,criterionId:'c',revisionId:'c-r1',description:'Relazioni',targetReferenceRevisionIds:['o-r1'],contextualReferenceRevisionIds:[]}],
    rubrics:[],assessments:[{...c,assessmentId:'a',revisionId:'a-r1',date,period:'Q1',title:proof.title,purpose:'formative',
      status:'completed',completedOn:date,source:{kind:'explicit-activity',activityId:'act-a'},criteria:[{criterionRevisionId:'c-r1',expected:{...fact}}]}],
    evidence:[{...c,evidenceId:'e',revisionId:'e-r1',observationEventId:'event-a',assessmentRevisionId:'a-r1',studentId:'s1',
      criterionRevisionId:'c-r1',observedOn:date,recordedAt:stamp,state:'observed',fact:{...fact},interpretation:{kind:'pending'}}]},
    bindings:[{kind:'assessment',assessmentRevisionId:'a-r1',link:{...s,proof:{...proof},confirmedByTeacher:true}},
      {kind:'evidence',evidenceRevisionId:'e-r1',link:{...s,proof:{...proof},confirmedByTeacher:true,individual:{studentId:'s1',gradeId:'g1'}}}]};
}
function legacy():any{return {classes:[{id:'class-a',name:'Classe sintetica',students:[{id:'s1',name:'Sintetico 1'},{id:'s2',name:'Sintetico 2'}],grades:[],behaviors:[]},
  {id:'class-b',name:'Altra classe sintetica',students:[{id:'s3',name:'Sintetico 3'}],grades:[],behaviors:[]}],currentClassId:'class-b'};}
function archive():any{const a=legacy();a.classes[0].assessmentEvidenceV1={version:1,documents:[section()]};return a;}

function base():CompleteSecureAppSnapshot{
  const x=createInitialArchiveSnapshot({mode:'professional',profile:{school:'Istituto sintetico',year:'2026/27',teacher:'Docente sintetico',subject:'Tecnologia'}});
  x.appData=legacy();
  x.meta={changes:4,lastBackup:null};
  return x;
}
function withEvidence():CompleteSecureAppSnapshot{
  const x=base();x.appData=archive();return x;
}
function v7(snapshot:CompleteSecureAppSnapshot):any{
  return {...createBackupPayload(snapshot,stamp),backupDataVersion:7};
}
const docs=(x:any)=>x.appData.classes[0].assessmentEvidenceV1.documents;
const inspect=(p:unknown,current=base(),scopes:unknown=[s])=>inspectAssessmentBackupPayload(p,current,scopes);
const generate=(x:unknown,scopes:unknown=[s])=>createAssessmentBackupPayloadV7(x,scopes,stamp);
const keys=['appData','copilotState','customTests','library','meta','planning','professionalMemory','settings','submissions','udas'];
describe('VAL-01/D1b.2a — isolated v7 codec',()=>{
  test('v7 is distinct and keeps all ten datasets including frozen links and withdrawn history',async()=>{
    const x=withEvidence(),d=docs(x)[0],e=d.document.evidence[0];
    const w={...e,revisionId:'e-r2',supersedesRevisionId:'e-r1',state:'withdrawn',reason:'Ritiro sintetico'};
    delete w.fact;delete w.interpretation;d.document.evidence.push(w);
    const before=structuredClone(x),p=await generate(x);
    expect(p.backupDataVersion).toBe(7);expect(p.app).toBe('registro-docente');expect(p.exportedAt).toBe(stamp);
    expect(Object.keys(p.snapshot).sort()).toEqual(keys);expect(p.snapshot).toEqual(before);expect(x).toEqual(before);
    const r=await inspect(p);expect(r.sourceVersion).toBe(7);expect(r.snapshot).toEqual(before);
  });
  test('v7 empty domain remains absent, no creation of new sections',async()=>{
    const x=base(),p=await generate(x,[]),r=await inspect(p,base(),[]);
    expect(r.snapshot).toEqual(x);
    expect(r.snapshot.appData.classes.every(c=>!Object.hasOwn(c,'assessmentEvidenceV1'))).toBe(true);
  });
  test('independent context is required on export and on inspection',async()=>{
    await expect(generate(withEvidence(),[])).rejects.toThrow();
    await expect(inspect(v7(withEvidence()),base(),[])).rejects.toThrow();
    await expect(inspect(v7(withEvidence()),base(),[{...s,subjectCode:'OTHER'}])).rejects.toThrow();
  });
  test('invalid scope, roster or frozen binding fails before candidate publication',async()=>{
    const x=withEvidence();docs(x)[0].bindings[1].link.individual.studentId='s2';
    await expect(generate(x)).rejects.toThrow();await expect(inspect(v7(x))).rejects.toThrow();
    const y=withEvidence();y.appData.classes[0].students.shift();
    await expect(inspect(v7(y))).rejects.toThrow();
  });
  test('presence malformed is never normalized to absent',async()=>{
    for(const value of [null,undefined,{version:99,documents:[]},{version:1,documents:[]}]){
      const x=withEvidence();(x.appData.classes[0] as any).assessmentEvidenceV1=value;
      await expect(generate(x)).rejects.toThrow();await expect(inspect(v7(x))).rejects.toThrow();
    }
  });
  test('all ten datasets must be present in a v7 input and export snapshot',async()=>{
    for(const key of keys){
      const p=v7(withEvidence());delete p.snapshot[key];
      await expect(inspect(p)).rejects.toThrow();await expect(generate(p.snapshot)).rejects.toThrow();
    }
  });
  test('strict v7 root/snapshot, known app and explicit timestamp',async()=>{
    for(const change of [{app:'other-app'},{app:undefined},{exportedAt:'not-a-date'},{exportedAt:undefined},{extra:'unknown'}]){
      await expect(inspect({...v7(base()),...change})).rejects.toThrow();
    }
    const p=v7(base());p.snapshot.extra='unknown';await expect(inspect(p)).rejects.toThrow();
  });
  test('unsupported explicit future version is rejected',async()=>{
    await expect(inspect({...v7(base()),backupDataVersion:8})).rejects.toThrow();
  });
  test('current legacy v6 reader rejects explicitly versioned v7',async()=>{
    const p=await generate(withEvidence());expect(()=>normalizeBackupPayload(p,base())).toThrow(/versione/i);
  });
  test('v2-v6 and legacy readable with no invented evidence',async()=>{
    const x=base(),modern=createBackupPayload(x,stamp),legacyPlanning={...x.planning,schemaVersion:1};
    delete (legacyPlanning as any).docenteOsProjections;
    for(const version of [2,3,4,5,6]){
      const snapshot:any=structuredClone(modern.snapshot);
      if(version<=5){delete snapshot.copilotState;snapshot.planning=legacyPlanning;}
      if(version<=4)delete snapshot.professionalMemory;
      if(version<=3)delete snapshot.library;
      if(version===2)delete snapshot.planning;
      const r=await inspect({...modern,backupDataVersion:version,snapshot},x,[]);
      expect(r.sourceVersion).toBe(version);expect(r.snapshot.appData).toEqual(x.appData);
      expect(r.snapshot.settings.archiveMode).toBe('professional');
    }
    const r=await inspect({app:'registro-docente',classes:x.appData.classes},x,[]);
    expect(r.sourceVersion).toBe('legacy');expect(r.snapshot.appData.classes).toEqual(x.appData.classes);
  });
  test('domain under historical payload labels or legacy aliases is refused',async()=>{
    for(const version of [2,3,4,5,6]){
      const p={...v7(withEvidence()),backupDataVersion:version};
      await expect(inspect(p)).rejects.toThrow();
    }
    const x=withEvidence();
    await expect(inspect({classes:x.appData.classes})).rejects.toThrow();
    await expect(inspect({data:x.appData})).rejects.toThrow();
    await expect(inspect({classes:x.appData.classes,data:base().appData})).rejects.toThrow();
  });
  test('local-only verified-copy receipts are never exported or inherited',async()=>{
    const x=withEvidence();x.meta={...x.meta,lastBackup:stamp,verifiedBackupAt:stamp,verifiedBackupEvidence:{bytes:123,sha256:'a'.repeat(64),source:'android-readback',payloadVersion:6,checkpointAt:stamp}};
    const p=await generate(x);
    expect(p.snapshot.meta.verifiedBackupAt).toBeUndefined();expect(p.snapshot.meta.verifiedBackupEvidence).toBeUndefined();
    const r=await inspect(v7(x));expect(r.snapshot.meta.verifiedBackupAt).toBeUndefined();expect(r.snapshot.meta.verifiedBackupEvidence).toBeUndefined();
    expect(x.meta.verifiedBackupAt).toBe(stamp);
  });
  test('inspection with evidence in destination flags replacement review even for a valid old copy',async()=>{
    const current=withEvidence(),before=structuredClone(current);
    const r=await inspect(createBackupPayload(base(),stamp),current,[]);
    expect(r.replacementRequiresReview).toBe(true);
    expect(current).toEqual(before);expect(r.snapshot.appData).toEqual(base().appData);
  });
  test('no local evidence means no assessment replacement warning',async()=>{
    const r=await inspect(v7(base()),base(),[]);
    expect(r.replacementRequiresReview).toBe(false);
  });
  test('input accessors are not invoked and cycles are rejected',async()=>{
    let called=false;const x=withEvidence();
    Object.defineProperty(x.appData.classes[0],'assessmentEvidenceV1',{enumerable:true,get(){called=true;return null;}});
    await expect(generate(x)).rejects.toThrow();expect(called).toBe(false);
    const p=v7(base());p.snapshot.appData.classes[0].cycle=p;
    await expect(inspect(p)).rejects.toThrow();
  });
  test('ciphertext protocol v2 roundtrip preserves complete v7 payload and current reader rejects it',async()=>{
    const p=await generate(withEvidence());
    const encrypted=await encryptDataWithPassword(p,'synthetic-test-password');
    expect(JSON.parse(encrypted).version).toBe(2);
    expect(encrypted).not.toContain('Schema sintetico');
    const decrypted=await decryptDataWithPassword(encrypted,'synthetic-test-password');
    expect(decrypted).toEqual(p);
    expect((await inspect(decrypted)).snapshot).toEqual(p.snapshot);
    expect(()=>normalizeBackupPayload(decrypted,base())).toThrow(/versione/i);
  });
});
