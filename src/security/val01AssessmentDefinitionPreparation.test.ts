// VAL-01/S5b — synthetic-only planned activity preparation.
import {describe,expect,test} from 'bun:test';
import {previewAssessmentDefinition,confirmAssessmentDefinition} from '../assessment/assessmentDefinitionPreparation';
import {validateAssessmentEvidenceV1} from '../assessment/assessmentEvidence';
const scope={classId:'class-synthetic',schoolYear:'2026/2027',subjectCode:'TECH',studentIds:['s1','s2']};
const stamp='2026-11-18T09:00:00.000Z';
const confirmation={confirmedByTeacher:true,confirmedAt:stamp};
const source={kind:'local',sourceVersion:'v1'};
function fixture():any{
  return {version:1,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,
    references:[{...confirmation,referenceId:'o',revisionId:'o1',kind:'specific-objective',text:'Rappresentare la filiera',source}],
    criteria:[{...confirmation,criterionId:'c',revisionId:'c1',description:'Relazioni tra fasi',targetReferenceRevisionIds:['o1'],contextualReferenceRevisionIds:[]}],
    rubrics:[{...confirmation,rubricId:'r',revisionId:'r1',source,criteria:[{criterionRevisionId:'c1',levels:[{levelId:'l1',label:'Da integrare',description:'Rappresenta alcuni passaggi'}]}]}],
    assessments:[],evidence:[]};
}
function request():any{return {activityId:'activity1',assessmentId:'a',revisionId:'a1',date:'2026-11-19',period:'Q1',title:'Filiera sintetica',purpose:'formative',
  criteria:[{criterionRevisionId:'c1',rubricRevisionId:'r1',expected:{kind:'product',description:'Schema delle fasi',method:'elaborato'}}]};}
function reviewed(d:any=fixture(),r:any=request()):any{
  const p=previewAssessmentDefinition(d,scope,r);if(!p.valid)throw Error(p.issue);return p.preview;
}
const preview=(d:any,r:any)=>previewAssessmentDefinition(d,scope,r);
describe('VAL-01/S5b — configurazione esplicita della prova',()=>{
  test('preview displays frozen selected content without confirmation or roster',()=>{
    const d=fixture(),r=request(),before=structuredClone(d),original=structuredClone(r);
    const p=reviewed(d,r);
    expect(p.scope).toEqual({classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode});
    expect(p.request).toEqual(r);expect(p.selected[0].targets[0].text).toBe('Rappresentare la filiera');
    expect(p.selected[0].rubric.rubricRevisionId).toBe('r1');
    expect(p.confirmedByTeacher).toBeUndefined();expect(p.request.studentIds).toBeUndefined();
    expect(d).toEqual(before);expect(r).toEqual(original);
  });
  test('explicit confirmation returns a valid planned definition without mutating archive',()=>{
    const d=fixture(),before=structuredClone(d),p=reviewed(d);
    const c=confirmAssessmentDefinition(d,scope,p,confirmation);expect(c.valid).toBe(true);
    if(!c.valid)throw Error(c.issue);
    expect(c.definition.status).toBe('planned');expect(c.definition.confirmedByTeacher).toBe(true);
    expect(c.definition.criteria).toEqual(request().criteria);
    expect(c.definition.source).toEqual({kind:'explicit-activity',activityId:'activity1'});
    expect(c.definition.completedOn).toBeUndefined();
    expect(validateAssessmentEvidenceV1({...d,assessments:[c.definition]},scope).valid).toBe(true);
    expect(d).toEqual(before);
  });
  test('diagnostic without grade or rubric remains possible; no inferred rubric',()=>{
    const d=fixture(),r=request();r.purpose='diagnostic';delete r.criteria[0].rubricRevisionId;
    const p=reviewed(d,r);expect(p.selected[0].rubric).toBeNull();
    const c=confirmAssessmentDefinition(d,scope,p,confirmation);
    if(!c.valid)throw Error(c.issue);
    expect(c.definition.purpose).toBe('diagnostic');expect(c.definition.criteria[0].rubricRevisionId).toBeUndefined();
    expect(d.evidence).toEqual([]);
  });
  test('rejects missing, duplicate, extra or malformed preparation fields',()=>{
    const mutations=[(r:any)=>r.criteria=[],(r:any)=>r.criteria.push(r.criteria[0]),(r:any)=>r.criteria[0].expected.description=' ',
      (r:any)=>r.grade=8,(r:any)=>r.criteria[0].expected.level='l1',(r:any)=>r.confirmedByTeacher=true,
      (r:any)=>r.date='2026-02-30',(r:any)=>r.date='2026-08-31',(r:any)=>r.date='2027-09-01',(r:any)=>r.title=' ',
      (r:any)=>r.purpose='unknown',(r:any)=>r.period='Q3',(r:any)=>r.criteria[0].rubricRevisionId=undefined];
    for(const mutate of mutations){const r=request();mutate(r);expect(preview(fixture(),r)).toEqual({valid:false,issue:'INVALID_REQUEST'});}
  });
  test('rejects incompatible rubric, missing criterion and obsolete selected revisions',()=>{
    const r=request();r.criteria[0].rubricRevisionId='unknown';expect(preview(fixture(),r)).toEqual({valid:false,issue:'UNAVAILABLE_SELECTION'});
    const r2=request();r2.criteria[0].criterionRevisionId='unknown';expect(preview(fixture(),r2)).toEqual({valid:false,issue:'UNAVAILABLE_SELECTION'});
    const d=fixture();d.criteria.push({...d.criteria[0],revisionId:'c2',supersedesRevisionId:'c1'});
    expect(preview(d,request())).toEqual({valid:false,issue:'UNAVAILABLE_SELECTION'});
  });
  test('rejects unconfirmed and chronologically invalid confirmation',()=>{
    const d=fixture(),p=reviewed(d);
    for(const c of [null,{...confirmation,confirmedByTeacher:false},{...confirmation,confirmedAt:'invalid'},
      {...confirmation,confirmedAt:'2026-11-17T09:00:00.000Z'},{...confirmation,extra:true}]){
      expect(confirmAssessmentDefinition(d,scope,p,c)).toEqual({valid:false,issue:'INVALID_CONFIRMATION'});
    }
  });
  test('rejects stale preview after rubric or objective changes',()=>{
    const d=fixture(),p=reviewed(d);
    d.rubrics.push({...d.rubrics[0],revisionId:'r2',supersedesRevisionId:'r1'});
    expect(confirmAssessmentDefinition(d,scope,p,confirmation)).toEqual({valid:false,issue:'UNAVAILABLE_SELECTION'});
    const d2=fixture();d2.references.push({...d2.references[0],revisionId:'o2',supersedesRevisionId:'o1'});
    expect(confirmAssessmentDefinition(d2,scope,p,confirmation)).toEqual({valid:false,issue:'UNAVAILABLE_SELECTION'});
    const d3=fixture();d3.references[0].text='Testo diverso';
    expect(confirmAssessmentDefinition(d3,scope,p,confirmation)).toEqual({valid:false,issue:'STALE_PREVIEW'});
  });
  test('rejects duplicate activity, logical assessment ID and revision identity',()=>{
    const d=fixture(),p=reviewed(d);const c=confirmAssessmentDefinition(d,scope,p,confirmation);
    if(!c.valid)throw Error(c.issue);d.assessments.push(c.definition);
    expect(confirmAssessmentDefinition(d,scope,p,confirmation)).toEqual({valid:false,issue:'EXISTING_ACTIVITY'});
    const r=request();r.activityId='other';expect(preview(d,r)).toEqual({valid:false,issue:'CONFLICT'});
    r.assessmentId='other';r.revisionId='o1';expect(preview(d,r)).toEqual({valid:false,issue:'CONFLICT'});
  });
  test('rejects cross-scope preview and tampered selected content',()=>{
    const d=fixture(),p=reviewed(d);p.selected[0].description='Altro';
    expect(confirmAssessmentDefinition(d,scope,p,confirmation)).toEqual({valid:false,issue:'STALE_PREVIEW'});
    const p2=reviewed(d),otherScope={...scope,classId:'other'},other={...d,classId:'other'};
    expect(confirmAssessmentDefinition(other,otherScope,p2,confirmation)).toEqual({valid:false,issue:'STALE_PREVIEW'});
    expect(previewAssessmentDefinition(d,otherScope,request())).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
  });
  test('rejects getters without invoking them and detaches output',()=>{
    const d=fixture(),r=request();let called=false;Object.defineProperty(r,'criteria',{enumerable:true,get(){called=true;return [];}});
    expect(preview(d,r)).toEqual({valid:false,issue:'INVALID_REQUEST'});expect(called).toBe(false);
    const p=reviewed(d);p.selected[0].rubric.levels[0].label='changed';
    expect(d.rubrics[0].criteria[0].levels[0].label).toBe('Da integrare');
  });
});
