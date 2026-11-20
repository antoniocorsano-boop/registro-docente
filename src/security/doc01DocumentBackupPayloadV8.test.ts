// DOC-01/D4c3c2: unchanged contracts across exact RED and GREEN; synthetic only.
import {beforeAll,describe,expect,test} from 'bun:test';
import {applyDocumentHistoryOperation,type DocumentHistoryV1} from '../documents/documentHistoryTransitions';
import {createInitialArchiveSnapshot} from './initialArchiveSetup';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import {createDocumentBackupPayloadV8,inspectDocumentBackupPayloadV8,projectDocumentRestoreV8} from './documentBackupPayloadV8';
import {createBackupPayload,normalizeBackupPayload} from './backupPayload';
import {createAssessmentBackupPayloadV7,inspectAssessmentBackupPayload} from './assessmentBackupPayload';
import {encryptDataWithPassword,decryptDataWithPassword,BACKUP_VERSION_V2} from '../cryptoUtils';

beforeAll(()=>{const root=globalThis as typeof globalThis&{window?:typeof globalThis};if(!root.window)root.window=globalThis;});
const at='2026-11-19T19:30:00.000Z';
const scope={institutionRef:'demo-school',siteRef:'demo-site',classId:'demo-class',cohortRef:'demo-cohort',schoolYear:'2026/2027',schoolOrder:'lower_secondary',gradeLevel:2,subjectCode:'tecnologia',regimeRef:'demo-regime',purpose:'disciplinary-plan'};
const assessmentScope={classId:'demo-class',schoolYear:'2026/2027',subjectCode:'TECH'};
const period={from:'2026-09-01',to:'2027-08-31'};
const blank=():DocumentHistoryV1=>({schemaVersion:1,labOnly:true,events:[]});
const copy=<T>(v:T):T=>structuredClone(v);
const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
async function candidate(){
 const unsigned={schemaVersion:1,labOnly:true,official:false,complete:false,
  identity:{documentId:'demo-document',kind:'program-completed',scope,period,model:'disciplinary-second-third',mappingVersion:'2026-27-map-v1'},
  revision:{revisionId:'demo-revision-one',number:1,previousRevisionId:null,reason:'initial',state:'draft'},
  confirmedAt:'2026-11-19T16:00:00.000Z',confirmedByTeacher:true,
  preview:{official:false,complete:false,labOnly:true,kind:'program-completed',documentId:'demo-document',revisionId:'demo-revision-one',number:1,
   content:{official:false,complete:false,labOnly:true,coverage:'selected-only',period,
    recorded:{status:'selected',count:1,hours:1,activities:[{date:'2026-11-17',hours:1,title:'Attività sintetica'}]},
    coverageAssessment:'not-established',institutionalModel:'reference-only'}}};
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(['DOC-01/archive-candidate/v1',unsigned])));
 return {...unsigned,contentDigest:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};
}
async function documentHistory(){
 const record=await candidate();
 const first=await applyDocumentHistoryOperation(blank(),[scope],{mode:'SYNTHETIC_ONLY',eventId:'demo-event-one',expectedHead:null,operation:{kind:'append',record}});
 if(!first.valid)throw Error(first.issue);
 const second=await applyDocumentHistoryOperation(first.archive,[scope],{mode:'SYNTHETIC_ONLY',eventId:'demo-event-two',
  expectedHead:first.archive.events[0].eventDigest,operation:{kind:'revoke',documentId:record.identity.documentId,revisionId:record.revision.revisionId,
  contentDigest:record.contentDigest,revokedAt:'2026-11-19T16:02:00.000Z',reason:'withdrawn',confirmedByTeacher:true}});
 if(!second.valid)throw Error(second.issue);
 return {initial:first.archive,updated:second.archive};
}
function assessmentSection():any{
 const confirmed={confirmedByTeacher:true,confirmedAt:'2026-11-16T10:00:00.000Z'};
 const date='2026-11-16',proof={batchId:'batch-demo',date,period:'Q1',type:'disegno',title:'Schema sintetico'};
 const fact={kind:'product',description:'Schema sintetico',method:'elaborato'},s=assessmentScope;
 return {document:{version:1,...s,
  references:[{...confirmed,referenceId:'o',revisionId:'o-r1',kind:'specific-objective',text:'Rappresentare relazioni',source:{kind:'local',sourceVersion:'v1'}}],
  criteria:[{...confirmed,criterionId:'c',revisionId:'c-r1',description:'Relazioni',targetReferenceRevisionIds:['o-r1'],contextualReferenceRevisionIds:[]}],
  rubrics:[],assessments:[{...confirmed,assessmentId:'a',revisionId:'a-r1',date,period:'Q1',title:proof.title,purpose:'formative',
   status:'completed',completedOn:date,source:{kind:'explicit-activity',activityId:'act-a'},criteria:[{criterionRevisionId:'c-r1',expected:{...fact}}]}],
  evidence:[{...confirmed,evidenceId:'e',revisionId:'e-r1',observationEventId:'event-a',assessmentRevisionId:'a-r1',studentId:'s1',
   criterionRevisionId:'c-r1',observedOn:date,recordedAt:confirmed.confirmedAt,state:'observed',fact:{...fact},interpretation:{kind:'pending'}}]},
  bindings:[{kind:'assessment',assessmentRevisionId:'a-r1',link:{...s,proof:{...proof},confirmedByTeacher:true}},
    {kind:'evidence',evidenceRevisionId:'e-r1',link:{...s,proof:{...proof},confirmedByTeacher:true,individual:{studentId:'s1',gradeId:'g1'}}}]};
}
function base():CompleteSecureAppSnapshot{
 const x=createInitialArchiveSnapshot({mode:'professional',profile:{school:'Scuola dimostrativa',year:'2026/27',teacher:'Docente sintetico',subject:'Tecnologia'}});
 x.appData={classes:[{id:'demo-class',name:'2C',students:[{id:'s1',name:'Studente dimostrativo'}],grades:[],behaviors:[],
  assessmentEvidenceV1:{version:1,documents:[assessmentSection()]}}],currentClassId:'demo-class'} as typeof x.appData;
 x.meta={changes:4,lastBackup:null};
 return x;
}
async function snapshot(hist?:DocumentHistoryV1):Promise<CompleteSecureAppSnapshot>{
 const s=base();
 (s.appData as typeof s.appData&{documentHistoryV1:DocumentHistoryV1}).documentHistoryV1=hist??(await documentHistory()).initial;
 return s;
}
function withExistingGrade(source:CompleteSecureAppSnapshot):CompleteSecureAppSnapshot{
 const snapshot=copy(source);
 snapshot.appData.classes[0].grades=[{id:'g1',batchId:'batch-demo',studentId:'s1',date:'2026-11-16',
  type:'disegno',period:'Q1',title:'Schema sintetico',value:'8'}];
 return snapshot;
}
const generate=(s:unknown)=>createDocumentBackupPayloadV8(s,[assessmentScope],[scope],at);
const inspect=(p:unknown,current:CompleteSecureAppSnapshot)=>inspectDocumentBackupPayloadV8(p,current,[assessmentScope],[scope]);
const project=(current:CompleteSecureAppSnapshot,incoming:unknown,recovery:unknown)=>projectDocumentRestoreV8(current,incoming,recovery,[assessmentScope],[assessmentScope],[scope]);
const reject=async(p:Promise<unknown>)=>expect(p).rejects.toThrow('DOC01_V8_REJECTED');

describe('DOC-01/D4c3c2 — v8 append-only document history backup and recovery',()=>{
 test('v8 export + inspection retain ten datasets, assessment graph, immutable document events',async()=>{
  const original=await snapshot(),before=copy(original),p=await generate(original),i=await inspect(p,original);
  expect(p).toMatchObject({app:'registro-docente',backupDataVersion:8,exportedAt:at});
  expect(Object.keys(p.snapshot).sort()).toEqual(['appData','settings','udas','customTests','submissions','planning','library','professionalMemory','copilotState','meta'].sort());
  expect(p.snapshot).toEqual(before);expect(i.sourceVersion).toBe(8);expect(i.snapshot).toEqual(before);
  expect(i.replacementRequiresReview).toBe(true);expect(original).toEqual(before);
  expect(p.snapshot.appData.classes[0].assessmentEvidenceV1).toEqual((before.appData.classes[0] as any).assessmentEvidenceV1);
 });
 test('encrypted envelope v2 roundtrip preserves v8 document history and assessment without silent normalization',async()=>{
  const original=await snapshot((await documentHistory()).updated),p=await generate(original);
  const encrypted=await encryptDataWithPassword(p,'password-sintetica');
  expect(JSON.parse(encrypted).version).toBe(BACKUP_VERSION_V2);
  const decoded=await decryptDataWithPassword(encrypted,'password-sintetica');
  const checked=await inspect(decoded,original);
  expect(checked.snapshot).toEqual(p.snapshot);expect(checked.snapshot.appData.documentHistoryV1.events).toHaveLength(2);
  expect(checked.snapshot.appData.classes[0].assessmentEvidenceV1).toEqual((original.appData.classes[0] as any).assessmentEvidenceV1);
 });
 test('existing historical v6/v7 readers remain closed to new v8 data and do not invent a downgrade',async()=>{
  const original=await snapshot(),p=await generate(original);
  expect(()=>normalizeBackupPayload(p,base())).toThrow(/versione/i);
  await expect(inspectAssessmentBackupPayload(p,base(),[assessmentScope])).rejects.toThrow();
  expect(()=>createBackupPayload(original,at)).toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
  await expect(createAssessmentBackupPayloadV7(original,[assessmentScope],at)).rejects.toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
 });
 test('v8 rejects absent, forged or mutated historical chain on both export and inspection',async()=>{
  const s=await snapshot(),p=await generate(s),missing=base();
  await reject(generate(missing));
  const changed=copy(s);(changed.appData as any).documentHistoryV1.events[0].eventDigest='0'.repeat(64);
  await reject(generate(changed));
  const inbound=copy(p);(inbound.snapshot.appData.documentHistoryV1.events[0] as any).eventDigest='0'.repeat(64);
  await reject(inspect(inbound,s));
 });
 test('approved document scope and assessment scope both remain independently mandatory',async()=>{
  const s=await snapshot(),p=await generate(s);
  await reject(createDocumentBackupPayloadV8(s,[assessmentScope],[],at));
  await reject(createDocumentBackupPayloadV8(s,[],[scope],at));
  await reject(inspectDocumentBackupPayloadV8(p,s,[assessmentScope],[{...scope,subjectCode:'matematica'}]));
  await reject(inspectDocumentBackupPayloadV8(p,s,[],[scope]));
 });
 test('reserved marker outside appData root or an accessor is refused without executing it',async()=>{
  const s=await snapshot(),p=await generate(s),changed=copy(s);
  (changed.settings as any).other={documentHistoryV1:blank()};
  await reject(generate(changed));
  const alias=copy(p);(alias.snapshot.settings as any).other={documentHistoryV1:blank()};
  await reject(inspect(alias,s));
  let accessed=false;const poisoned=copy(s);
  Object.defineProperty(poisoned.appData,'documentHistoryV1',{enumerable:true,get(){accessed=true;return blank();}});
  await reject(generate(poisoned));expect(accessed).toBe(false);
 });
 test('strict version-eight root, timestamp and complete snapshot are required',async()=>{
  const s=await snapshot(),p=await generate(s);
  await reject(inspect({...p,backupDataVersion:7},s));
  await reject(inspect({...p,app:'other-app'},s));
  await reject(inspect({...p,exportedAt:'2026-11-19'},s));
  await reject(inspect({...p,unrecognized:true},s));
  const incomplete=copy(p);delete (incomplete.snapshot as any).library;await reject(inspect(incomplete,s));
 });
 test('exact recovery checkpoint and valid newer revocation preserve previous events and assessment',async()=>{
  const h=await documentHistory(),current=await snapshot(h.initial),next=await snapshot(h.updated);
  const before=copy(current),incoming=await generate(next),recovery=await generate(current);
  const projected=await project(current,incoming,recovery);
  expect((projected.appData as any).documentHistoryV1.events).toHaveLength(2);
  expect((projected.appData as any).documentHistoryV1.events[0]).toEqual(h.initial.events[0]);
  expect((projected.appData.classes[0] as any).assessmentEvidenceV1).toEqual((current.appData.classes[0] as any).assessmentEvidenceV1);
  expect(current).toEqual(before);
 });
 test('recovery refuses omission of previously committed document events',async()=>{
  const h=await documentHistory(),current=await snapshot(h.updated),incoming=await generate(await snapshot(h.initial));
  await reject(project(current,incoming,await generate(current)));
 });
 test('recovery refuses a stale or unrelated recovery copy even if incoming is valid',async()=>{
  const h=await documentHistory(),current=await snapshot(h.updated),incoming=await generate(current);
  await reject(project(current,incoming,await generate(await snapshot(h.initial))));
 });
 test('recovery rejects deletion of existing grades while assessment and document histories are unchanged',async()=>{
  const current=withExistingGrade(await snapshot()),incoming=copy(current);
  incoming.appData.classes[0].grades=[];
  await reject(project(current,await generate(incoming),await generate(current)));
 });
 test('recovery rejects rewritten grade values under the same grade identity',async()=>{
  const current=withExistingGrade(await snapshot()),incoming=copy(current);
  incoming.appData.classes[0].grades[0].value='6';
  await reject(project(current,await generate(incoming),await generate(current)));
 });
 test('recovery retains identical existing grades and permits new grade records',async()=>{
  const current=withExistingGrade(await snapshot()),incoming=copy(current);
  incoming.appData.classes[0].grades.push({...incoming.appData.classes[0].grades[0],id:'g2',date:'2026-11-19',value:'9'});
  const result=await project(current,await generate(incoming),await generate(current));
  expect(result.appData.classes[0].grades).toEqual(incoming.appData.classes[0].grades);
  expect(current.appData.classes[0].grades[0].value).toBe('8');
 });
 test('recovery refuses loss of previously confirmed assessment graph',async()=>{
  const s=await snapshot(),weaker=copy(s);
  delete (weaker.appData.classes[0] as any).assessmentEvidenceV1;
  await reject(project(s,await generate(weaker),await generate(s)));
 });
 test('document-containing destination requires explicit review; local backup receipt cannot be exported',async()=>{
  const s=await snapshot();s.meta={...s.meta,lastBackup:at,verifiedBackupAt:at,
   verifiedBackupEvidence:{bytes:200,sha256:'a'.repeat(64),source:'android-readback',payloadVersion:7,checkpointAt:at}};
  const p=await generate(s),r=await inspect(p,s);
  expect(r.replacementRequiresReview).toBe(true);
  expect(p.snapshot.meta.verifiedBackupAt).toBeUndefined();
  expect(p.snapshot.meta.verifiedBackupEvidence).toBeUndefined();
  expect(s.meta.verifiedBackupAt).toBe(at);
 });
});
