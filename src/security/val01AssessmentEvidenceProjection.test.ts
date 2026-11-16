// VAL-01/D1a.2b.1: synthetic RED contract; no runtime import.
import { describe, expect, test } from 'bun:test';
import { projectIndividualAssessmentEvidence } from '../assessment/assessmentEvidenceProjection';

const scope = { classId:'class-synthetic', schoolYear:'2026/2027', subjectCode:'TECH', studentIds:['s1','s2'] };
const day = '2026-11-16';
const stamp = '2026-11-16T10:00:00.000Z';
const confirmation = {confirmedByTeacher:true,confirmedAt:stamp};
const local = {kind:'local',sourceVersion:'v1'};
const fact = {kind:'product',description:'Schema sintetico completato',method:'elaborato'};
function evidence(id:string, studentId='s1'):any {
  return {...confirmation,evidenceId:id,revisionId:id+'-r1',observationEventId:id+'-event',
    assessmentRevisionId:'a-r1',studentId,criterionRevisionId:'c-r1',observedOn:day,recordedAt:stamp,
    state:'observed',fact:{...fact},interpretation:{kind:'level',levelId:'l1'}};
}
function fixture():any {
  return {version:1,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,
    references:[
      {...confirmation,referenceId:'o1',revisionId:'o1-r1',kind:'specific-objective',text:'Rappresentare la filiera',source:local},
      {...confirmation,referenceId:'o2',revisionId:'o2-r1',kind:'general-objective',text:'Descrivere il sistema',source:local}
    ],
    criteria:[{...confirmation,criterionId:'c',revisionId:'c-r1',description:'Relazioni rappresentate',
      targetReferenceRevisionIds:['o1-r1','o2-r1'],contextualReferenceRevisionIds:[]}],
    rubrics:[{...confirmation,rubricId:'rubric',revisionId:'rubric-r1',source:local,
      criteria:[{criterionRevisionId:'c-r1',levels:[{levelId:'l1',label:'Descrittore sintetico',description:'Rappresenta le relazioni'}]}]}],
    assessments:[{...confirmation,assessmentId:'a',revisionId:'a-r1',date:day,period:'Q1',title:'Prova sintetica',
      purpose:'formative',status:'completed',completedOn:day,source:{kind:'explicit-activity',activityId:'activity'},
      criteria:[{criterionRevisionId:'c-r1',rubricRevisionId:'rubric-r1',expected:{...fact}}]}],
    evidence:[evidence('e1'),evidence('e2','s2')]};
}
const project=(d:any, student:unknown='s1', context:unknown=scope)=>projectIndividualAssessmentEvidence(d,context,student);
function expectedEntry(id:string,state='observed') {
  return {evidenceRevisionId:id,assessmentRevisionId:'a-r1',criterionRevisionId:'c-r1',
    targetReferenceRevisionIds:['o1-r1','o2-r1'],state};
}
function expectSuccess(result:unknown,entries:unknown[],observed:number,notObserved=0,notApplicable=0) {
  expect(result).toEqual({valid:true,entries,counts:{observed,notObserved,notApplicable},coverage:'undetermined'});
}
describe('VAL-01/D1a.2b.1 — active evidence projection',()=>{
  test('selects only one student and exposes only minimal frozen references',()=>{
    const d=fixture(),before=structuredClone(d);
    expectSuccess(project(d),[expectedEntry('e1-r1')],1);
    expectSuccess(project(d,'s2'),[expectedEntry('e2-r1')],1);
    expect(d).toEqual(before);
  });
  test('multiple objective references do not multiply an observation',()=>{
    const d=fixture();
    expectSuccess(project(d),[expectedEntry('e1-r1')],1);
  });
  test('empty graph of evidence is valid and does not invent opportunities',()=>{
    const d=fixture(); d.evidence=[];
    expectSuccess(project(d),[],0);
  });
  test('unknown student or malformed student identity fails closed',()=>{
    for(const student of ['missing','',null,42,{}]) {
      expect(project(fixture(),student)).toEqual({valid:false,issue:'INVALID_STUDENT'});
    }
  });
  test('invalid document and mismatched scope fail closed',()=>{
    const d=fixture();d.evidence[0].criterionRevisionId='missing';
    expect(project(d)).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
    expect(project(fixture(),'s1',{...scope,subjectCode:'OTHER'})).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
    expect(project(fixture(),'s1',{...scope,studentIds:['s1','s1']})).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
  });
  test('a revision replaces its own active head without removing history, independent of array order',()=>{
    const d=fixture(), original=d.evidence[0];
    const successor={...original,revisionId:'e1-r2',supersedesRevisionId:'e1-r1',interpretation:{kind:'pending'}};
    d.evidence.unshift(successor);
    const before=structuredClone(d);
    expectSuccess(project(d),[expectedEntry('e1-r2')],1);
    d.evidence.reverse(); expectSuccess(project(d),[expectedEntry('e1-r2')],1);
    expect(d.evidence).toEqual([...before.evidence].reverse());
  });
  test('withdrawal is excluded from active counts but not from source history',()=>{
    const d=fixture(),{fact:_f,interpretation:_i,...original}=d.evidence[0];
    d.evidence.push({...original,revisionId:'e1-r2',supersedesRevisionId:'e1-r1',state:'withdrawn',reason:'Ritiro sintetico'});
    const before=structuredClone(d);
    expectSuccess(project(d),[],0);expect(d).toEqual(before);
  });
  test('two observations of the same criterion on the same day remain separate',()=>{
    const d=fixture();d.evidence.unshift(evidence('e3'));
    expectSuccess(project(d),[expectedEntry('e1-r1'),expectedEntry('e3-r1')],2);
  });
  test('not observed, not applicable and absent are separate',()=>{
    const d=fixture(),{fact:_f,interpretation:_i,...e}=evidence('e3');
    d.evidence.push({...e,state:'not_observed'});
    const {fact:_g,interpretation:_j,...other}=evidence('e4');
    d.evidence.push({...other,state:'not_applicable'});
    expectSuccess(project(d),[expectedEntry('e1-r1'),expectedEntry('e3-r1','not_observed'),expectedEntry('e4-r1','not_applicable')],1,1,1);
  });
  test('a newer objective revision does not change the frozen evidence reference',()=>{
    const d=fixture();d.references.push({...d.references[0],revisionId:'o1-r2',supersedesRevisionId:'o1-r1',text:'Obiettivo aggiornato'});
    expectSuccess(project(d),[expectedEntry('e1-r1')],1);
  });
  test('observed fact without interpretation contributes a fact count, not a level',()=>{
    const d=fixture();d.evidence[0].interpretation={kind:'pending'};
    expectSuccess(project(d),[expectedEntry('e1-r1')],1);
  });
  test('duplicate revision or fork cannot masquerade as a new observation',()=>{
    const d=fixture();d.evidence.push(structuredClone(d.evidence[0]));
    expect(project(d)).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
    const f=fixture(), e=f.evidence[0];
    f.evidence.push({...e,revisionId:'e1-r2',supersedesRevisionId:'e1-r1'},{...e,revisionId:'e1-r3',supersedesRevisionId:'e1-r1'});
    expect(project(f)).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
  });
  test('projection result does not alias target references from the input',()=>{
    const d=fixture(),r=project(d);
    expect(r.valid).toBe(true);
    if(r.valid) {
      expect(r.entries[0].targetReferenceRevisionIds).not.toBe(d.criteria[0].targetReferenceRevisionIds);
    }
  });
});
