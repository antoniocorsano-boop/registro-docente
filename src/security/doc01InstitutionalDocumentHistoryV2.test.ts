import {describe,expect,test} from 'bun:test';
import {
 createInstitutionalDocumentRecordV2,validateInstitutionalDocumentHistoryV2,
 appendInstitutionalDocumentV2,revokeInstitutionalDocumentV2
} from '../documents/institutionalDocumentHistoryV2';
const scope={institutionCode:'ZZIC00000A',siteCode:'ZZMM000001',schoolYear:'2026/2027',schoolOrder:'lower-secondary' as const,
 gradeLevel:2 as const,classId:'2C',subjectCode:'TECH',purpose:'disciplinary-plan' as const};
const ids={doc:'11111111-1111-4111-8111-111111111111',rev1:'22222222-2222-4222-8222-222222222222',
 evt1:'33333333-3333-4333-8333-333333333333',rev2:'44444444-4444-4444-8444-444444444444',
 evt2:'55555555-5555-4555-8555-555555555555',evt3:'66666666-6666-4666-8666-666666666666'};
const blank=()=>({schemaVersion:2,labOnly:false,events:[]});
const input=()=>({schemaVersion:2,labOnly:false,official:false,approval:'teacher-confirmed',
 documentId:ids.doc,revisionId:ids.rev1,revisionNumber:1,previousRevisionId:null,revisionReason:'initial',
 kind:'disciplinary-plan',scope,confirmedAt:'2026-11-20T09:00:00.000Z',
 title:'Piano disciplinare di Tecnologia',sections:[{field:'obiettivi',text:'Osservare e descrivere i sistemi tecnologici.'},{field:'attivita',text:'Attività di progettazione in gruppo.'}]});
const record=async()=>createInstitutionalDocumentRecordV2(input());
describe('DOC-01/D4c3e3 — institutional documents without V1 demo markers',()=>{
 test('explicit real-world-style institutional scope, class and teacher review create a frozen V2 document',async()=>{
  const r=await record();
  expect(r).toMatchObject({schemaVersion:2,labOnly:false,official:false,approval:'teacher-confirmed',
   documentId:ids.doc,revisionId:ids.rev1,scope});
  expect(r.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  expect(Object.isFrozen(r)).toBe(true);expect(Object.isFrozen(r.sections[0])).toBe(true);
  expect(r.sections[0].text).toContain('sistemi tecnologici');
 });
 test('valid initial append verifies an immutable whole chain with one confirmed revision',async()=>{
  const first=await record();
  const out=await appendInstitutionalDocumentV2(blank(),scope,first,null,ids.evt1);
  expect(out.valid).toBe(true);
  if(!out.valid)return;
  expect(out.archive.events).toHaveLength(1);
  expect(out.confirmedCount).toBe(1);expect(out.revokedCount).toBe(0);
  expect(out.head).toMatch(/^[0-9a-f]{64}$/);
  expect((await validateInstitutionalDocumentHistoryV2(out.archive,scope)).valid).toBe(true);
  expect(blank().events).toHaveLength(0);
 });
 test('only a consecutive revision of identical document/scope may extend the chain',async()=>{
  const first=await record();
  const state=await appendInstitutionalDocumentV2(blank(),scope,first,null,ids.evt1);
  if(!state.valid)throw Error('Invalid setup');
  const second=await createInstitutionalDocumentRecordV2({...input(),revisionId:ids.rev2,
   revisionNumber:2,previousRevisionId:ids.rev1,revisionReason:'content-update',
   confirmedAt:'2026-11-20T10:00:00.000Z'});
  const next=await appendInstitutionalDocumentV2(state.archive,scope,second,state.head,ids.evt2);
  expect(next.valid).toBe(true);
  if(next.valid){expect(next.archive.events).toHaveLength(2);expect(next.confirmedCount).toBe(1);
   expect((await validateInstitutionalDocumentHistoryV2(next.archive,scope)).valid).toBe(true);}
  expect((await appendInstitutionalDocumentV2(state.archive,scope,second,null,ids.evt2)).valid).toBe(false);
  expect((await appendInstitutionalDocumentV2(state.archive,scope,second,state.head,ids.evt1)).valid).toBe(false);
 });
 test('explicit teacher revocation is append-only and prevents silent replacement',async()=>{
  const a=await appendInstitutionalDocumentV2(blank(),scope,await record(),null,ids.evt1);
  if(!a.valid)throw Error('Invalid setup');
  const q={documentId:ids.doc,revisionId:ids.rev1,reason:'withdrawn',confirmedAt:'2026-11-20T11:00:00.000Z',confirmedByTeacher:true};
  const rev=await revokeInstitutionalDocumentV2(a.archive,scope,q,a.head,ids.evt2);
  expect(rev.valid).toBe(true);
  if(rev.valid){
   expect(rev.archive.events).toHaveLength(2);expect(rev.revokedCount).toBe(1);
   expect((await validateInstitutionalDocumentHistoryV2(rev.archive,scope)).valid).toBe(true);
   const duplicate=await revokeInstitutionalDocumentV2(rev.archive,scope,q,rev.head,ids.evt3);
   expect(duplicate.valid).toBe(false);
  }
 });
 test('reject unrelated school, class, year, purpose and unsupported school order',async()=>{
  const base=input();
  for(const edit of [
   {...scope,institutionCode:'ZZIC99999A'}, {...scope,classId:'3C'},
   {...scope,schoolYear:'2024/2025'}, {...scope,purpose:'council-contribution'},
   {...scope,schoolOrder:'primary'}
  ]){
   const candidate={...base,scope:edit};
   if(edit.schoolYear==='2024/2025'||edit.schoolOrder==='primary'||edit.purpose==='council-contribution')
    await expect(createInstitutionalDocumentRecordV2(candidate)).rejects.toThrow();
   else{
    const created=await createInstitutionalDocumentRecordV2(candidate);
    expect((await appendInstitutionalDocumentV2(blank(),scope,created,null,ids.evt1)).valid).toBe(false);
   }
  }
 });
 test('tampered content, forged official approval and personal-shaped unexpected fields are rejected',async()=>{
  const clean=await record();
  const corrupted={...clean,sections:[{field:'obiettivi',text:'Testo sostituito'}]};
  expect((await appendInstitutionalDocumentV2(blank(),scope,corrupted,null,ids.evt1)).valid).toBe(false);
  for(const bad of [
   {...input(),official:true},{...input(),labOnly:true},{...input(),approval:'institutional-approved'},
   {...input(),studentName:'Una persona'},
   {...input(),sections:[{field:'studente',text:'Nominativi'}]},
   {...input(),sections:[{field:'obiettivi',text:' '.repeat(5000)}]},
   {...input(),sections:[]}
  ])await expect(createInstitutionalDocumentRecordV2(bad)).rejects.toThrow();
 });
 test('reject accessor, prototype pollution and cyclic records before hashing',async()=>{
  const getter={...input()};Object.defineProperty(getter,'title',{enumerable:true,get(){throw Error('executed');}});
  await expect(createInstitutionalDocumentRecordV2(getter)).rejects.toThrow();
  const cycle:any=input();cycle.sections.push(cycle);
  await expect(createInstitutionalDocumentRecordV2(cycle)).rejects.toThrow();
  await expect(createInstitutionalDocumentRecordV2({...input(),__proto__:{unsafe:true}})).rejects.toThrow();
 });
 test('old V1 lab-only histories never implicitly migrate to school-document V2',async()=>{
  const old={schemaVersion:1,labOnly:true,events:[]};
  expect((await validateInstitutionalDocumentHistoryV2(old,scope)).valid).toBe(false);
  expect((await validateInstitutionalDocumentHistoryV2(blank(),scope)).valid).toBe(true);
  const src=await import('../security/documentBackupPayloadV8');
  expect(src.DOCUMENT_BACKUP_DATA_VERSION_V8).toBe(8);
 });
});
