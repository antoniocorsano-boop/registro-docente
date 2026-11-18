// S5a — synthetic fixtures, no app integration.
import { describe, expect, test } from 'bun:test';
import { listAssessmentPreparationOptions } from '../assessment/assessmentPreparationOptions';

const scope = {classId:'class-synthetic',schoolYear:'2026/2027',subjectCode:'TECH',studentIds:['s1','s2']};
const stamp = '2026-11-18T09:00:00.000Z';
const confirmed = {confirmedByTeacher:true,confirmedAt:stamp};
const source = {kind:'local',sourceVersion:'v1'};
function fixture():any {
  return {version:1,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,
    references:[
      {...confirmed,referenceId:'o',revisionId:'o1',kind:'specific-objective',text:'Rappresentare la filiera',source},
      {...confirmed,referenceId:'n',revisionId:'n1',kind:'foundational-core',text:'Sistemi produttivi',source}
    ],
    criteria:[{...confirmed,criterionId:'c',revisionId:'c1',description:'Relazioni tra fasi',targetReferenceRevisionIds:['o1'],contextualReferenceRevisionIds:['n1']}],
    rubrics:[{...confirmed,rubricId:'r',revisionId:'r1',source,criteria:[{criterionRevisionId:'c1',levels:[{levelId:'l1',label:'Da integrare',description:'Rappresenta alcuni passaggi'}]}]}],
    assessments:[],evidence:[]};
}
const list=(d:any=fixture(),activity:unknown='activity1',s:unknown=scope)=>listAssessmentPreparationOptions(d,s,activity);
describe('VAL-01/S5a — selezione esplicita per attività',()=>{
  test('returns only local selectable criteria, targets, context and compatible rubric; no selection or roster',()=>{
    const d=fixture(),before=structuredClone(d);
    expect(list(d)).toEqual({valid:true,existing:null,criteria:[{
      criterionRevisionId:'c1',description:'Relazioni tra fasi',
      targets:[{revisionId:'o1',kind:'specific-objective',text:'Rappresentare la filiera',sourceVersion:'v1'}],
      context:[{revisionId:'n1',kind:'foundational-core',text:'Sistemi produttivi',sourceVersion:'v1'}],
      rubrics:[{rubricRevisionId:'r1',sourceVersion:'v1',levels:[{levelId:'l1',label:'Da integrare',description:'Rappresenta alcuni passaggi'}]}]
    }]});
    expect(d).toEqual(before);
  });
  test('empty catalogue remains empty, no invented criterion',()=>{
    const d=fixture(); d.references=[];d.criteria=[];d.rubrics=[];
    expect(list(d)).toEqual({valid:true,existing:null,criteria:[]});
  });
  test('superseded reference blocks stale criterion; never upgrades links silently',()=>{
    const d=fixture();d.references.push({...d.references[0],revisionId:'o2',supersedesRevisionId:'o1'});
    expect(list(d)).toEqual({valid:true,existing:null,criteria:[]});
  });
  test('superseded criterion replaced, old rubric is not applied to new revision',()=>{
    const d=fixture();d.criteria.push({...d.criteria[0],revisionId:'c2',supersedesRevisionId:'c1'});
    const result=list(d);expect(result.valid).toBe(true);
    if(result.valid){expect(result.criteria.map(c=>c.criterionRevisionId)).toEqual(['c2']);expect(result.criteria[0].rubrics).toEqual([]);}
  });
  test('only active rubric revision is selectable',()=>{
    const d=fixture();d.rubrics.push({...d.rubrics[0],revisionId:'r2',supersedesRevisionId:'r1'});
    const result=list(d);expect(result.valid).toBe(true);
    if(result.valid)expect(result.criteria[0].rubrics.map(r=>r.rubricRevisionId)).toEqual(['r2']);
  });
  test('existing activity is identified by its active revision; unrelated activity remains new',()=>{
    const d=fixture();const a={...confirmed,assessmentId:'a',revisionId:'a1',date:'2026-11-18',period:'Q1',title:'Filiera',purpose:'formative',status:'planned',source:{kind:'explicit-activity',activityId:'activity1'},criteria:[{criterionRevisionId:'c1',expected:{kind:'product',description:'Schema',method:'elaborato'}}]};
    d.assessments.push(a,{...a,revisionId:'a2',supersedesRevisionId:'a1',status:'cancelled'});
    const result=list(d);expect(result.valid).toBe(true);
    if(result.valid)expect(result.existing).toEqual({assessmentRevisionId:'a2',status:'cancelled'});
    const other=list(d,'activity2');if(other.valid)expect(other.existing).toBeNull();else throw Error('invalid');
  });
  test('rejects malformed document, foreign scope and invalid activity identity',()=>{
    expect(list(null)).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
    expect(list(fixture(),'activity1',{...scope,classId:'other'})).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
    for(const id of [null,'','a b',{}])expect(list(fixture(),id)).toEqual({valid:false,issue:'INVALID_ACTIVITY'});
  });
  test('does not invoke getters and does not expose source references by alias',()=>{
    const d=fixture();let called=false;Object.defineProperty(d,'evidence',{enumerable:true,get(){called=true;return [];}});
    expect(list(d)).toEqual({valid:false,issue:'INVALID_DOCUMENT'});expect(called).toBe(false);
    const original=fixture(),result=list(original);if(!result.valid)throw Error('invalid');
    (result.criteria[0].rubrics[0].levels[0] as any).label='changed';
    expect(original.rubrics[0].criteria[0].levels[0].label).toBe('Da integrare');
  });
});
