// VAL-01/D1b.1 — synthetic archive boundary; no runtime storage.
import {describe,expect,test} from 'bun:test';
import {validateAssessmentArchiveV1} from '../assessment/assessmentArchive';
import {validateAssessmentRevisionBindings} from '../assessment/assessmentRevisionBindings';
const s={classId:'class-a',schoolYear:'2026/2027',subjectCode:'TECH'};
const scope={...s,studentIds:['s1','s2']};
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
const documents=(a:any)=>a.classes[0].assessmentEvidenceV1.documents;
const valid=(state:string)=>({valid:true,state});
const reject=(a:unknown,scopes:unknown=[s])=>expect(validateAssessmentArchiveV1(a,scopes).valid).toBe(false);
function otherSection(a:any,overrides:Record<string,unknown>,batchId='batch-other',gradeId='g-other'):any{
  const d=section();Object.assign(d.document,overrides);
  for(const b of d.bindings){Object.assign(b.link,overrides);b.link.proof.batchId=batchId;if(b.kind==='evidence')b.link.individual.gradeId=gradeId;}
  documents(a).push(d);return d;
}
describe('VAL-01/D1b.1 — isolated assessment archive validation',()=>{
  test('legacy archive is absent and unchanged, without inventing any record',()=>{
    const a=legacy(),before=structuredClone(a);expect(validateAssessmentArchiveV1(a,[])).toEqual(valid('absent'));expect(a).toEqual(before);
  });
  test('present historical links remain valid without current grades; validate other class than selected',()=>{
    const a=archive(),before=structuredClone(a);
    expect(validateAssessmentArchiveV1(a,[s])).toEqual(valid('present'));expect(a).toEqual(before);
    expect(a.classes[0].grades).toHaveLength(0);
  });
  test('empty evidence and unlinked activity are valid inside a confirmed document',()=>{
    const a=archive(),d=documents(a)[0];d.document.evidence=[];d.bindings=[];
    expect(validateAssessmentArchiveV1(a,[s])).toEqual(valid('present'));
  });
  test('present undefined, null, unknown version, empty envelope and extra keys never mean absence',()=>{
    for(const v of [undefined,null,{version:2,documents:[section()]},{version:1,documents:[]},{version:1,documents:[section()],extra:true}]){
      const a=archive();a.classes[0].assessmentEvidenceV1=v;reject(a);
    }
  });
  test('section is closed and cannot bypass graph validation',()=>{
    const a=archive();documents(a)[0].extra=true;reject(a);
    const b=archive();documents(b)[0].document.criteria[0].targetReferenceRevisionIds=['missing'];reject(b);
  });
  test('scope independently required, no inference from names or settings',()=>{
    const a=archive();reject(a,[]);reject(a,[{...s,subjectCode:'OTHER'}]);reject(a,[{...s,schoolYear:'2025/2026'}]);
    reject(a,[{...s,studentIds:['s1','s2']}]);
  });
  test('invalid or duplicate approved scopes rejected',()=>{
    for(const x of [[s,s],[{...s,schoolYear:'2026/2028'}],[{...s,classId:'missing'}],[{...s,subjectCode:''}],[null]])reject(archive(),x);
  });
  test('multiple explicit discipline scopes allowed without sharing proof identity',()=>{
    const a=archive(),next={...s,subjectCode:'MATH'};otherSection(a,{subjectCode:'MATH'});
    expect(validateAssessmentArchiveV1(a,[s,next])).toEqual(valid('present'));
  });
  test('multiple annual scopes remain distinct',()=>{
    const a=archive(),next={...s,schoolYear:'2025/2026'},d=otherSection(a,{schoolYear:next.schoolYear});
    const old='2025-11-16',at='2025-11-16T10:00:00.000Z';
    for(const r of [...d.document.references,...d.document.criteria,...d.document.assessments,...d.document.evidence])r.confirmedAt=at;
    Object.assign(d.document.assessments[0],{date:old,completedOn:old});Object.assign(d.document.evidence[0],{observedOn:old,recordedAt:at});
    for(const b of d.bindings)b.link.proof.date=old;
    expect(validateAssessmentArchiveV1(a,[s,next])).toEqual(valid('present'));
  });
  test('duplicate document scope rejected even with valid individual sections',()=>{
    const a=archive();documents(a).push(section());reject(a);
  });
  test('document cannot be moved into a different class envelope',()=>{
    const a=archive();a.classes[1].assessmentEvidenceV1=a.classes[0].assessmentEvidenceV1;delete a.classes[0].assessmentEvidenceV1;reject(a);
  });
  test('class and roster identity must be unambiguous',()=>{
    const a=archive();a.classes.push(structuredClone(a.classes[0]));reject(a);
    const b=archive();b.classes[0].students.push({...b.classes[0].students[0]});reject(b);
    const d=archive();d.classes[0].students.shift();reject(d);
  });
  test('malformed historical link cannot pass with otherwise valid graph',()=>{
    const a=archive();documents(a)[0].bindings[1].link.individual.studentId='s2';reject(a);
    const b=archive();documents(b)[0].bindings.shift();reject(b);
  });
  test('batch ownership cannot cross discipline scopes',()=>{
    const a=archive();otherSection(a,{subjectCode:'MATH'},proof.batchId,'g-other');reject(a,[s,{...s,subjectCode:'MATH'}]);
  });
  test('grade identity cannot cross discipline scopes even when batches differ',()=>{
    const a=archive();otherSection(a,{subjectCode:'MATH'},'batch-other','g1');reject(a,[s,{...s,subjectCode:'MATH'}]);
  });
  test('historical validator independent of current archive and request',()=>{
    const d=section();
    expect(validateAssessmentRevisionBindings(d.document,scope,d.bindings)).toBe(true);
    expect(validateAssessmentRevisionBindings(d.document,scope,[d.bindings[1]])).toBe(false);
    expect(validateAssessmentRevisionBindings(d.document,{...scope,studentIds:['s2']},d.bindings)).toBe(false);
  });
  test('withdrawn or superseded history remains valid without relinking',()=>{
    const a=archive(),d=documents(a)[0],e=d.document.evidence[0];
    const withdrawal={...e,revisionId:'e-r2',supersedesRevisionId:'e-r1',state:'withdrawn',reason:'Ritiro sintetico'};
    delete withdrawal.fact;delete withdrawal.interpretation;d.document.evidence.push(withdrawal);
    expect(validateAssessmentArchiveV1(a,[s])).toEqual(valid('present'));
  });
  test('active object, sparse arrays and cyclic evidence reject without invoking getters',()=>{
    let called=false;const a=legacy();Object.defineProperty(a.classes[0],'assessmentEvidenceV1',{enumerable:true,get(){called=true;return null;}});
    reject(a);expect(called).toBe(false);
    const b=archive();documents(b).length=2;reject(b);
    const d=archive();documents(d)[0].document.evidence.push(documents(d)[0]);reject(d);
  });
  test('unrelated legacy fields and values are not rewritten or exposed in result',()=>{
    const a=archive();a.classes[0].grades=[{id:'g1',studentId:'s1',...proof,value:'8'}];
    a.classes[0].behaviors=[{id:'b1',studentId:'s1',date,value:'synthetic'}];const before=structuredClone(a);
    expect(validateAssessmentArchiveV1(a,[s])).toEqual(valid('present'));expect(a).toEqual(before);
  });
});
