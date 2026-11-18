// VAL-01/S6a — synthetic completion without inferred evidence.
import {describe,expect,test} from 'bun:test';
import {previewAssessmentCompletion,confirmAssessmentCompletion} from '../assessment/assessmentCompletion';
import {validateAssessmentEvidenceV1} from '../assessment/assessmentEvidence';
const scope={classId:'class-synthetic',schoolYear:'2026/2027',subjectCode:'TECH',studentIds:['s1','s2']};
const original={confirmedByTeacher:true,confirmedAt:'2026-11-18T09:00:00.000Z'};
const confirmation={confirmedByTeacher:true,confirmedAt:'2026-11-20T10:00:00.000Z'};
const source={kind:'local',sourceVersion:'v1'};
function fixture():any{
  return {version:1,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,
    references:[{...original,referenceId:'o',revisionId:'o1',kind:'specific-objective',text:'Rappresentare la filiera',source}],
    criteria:[{...original,criterionId:'c',revisionId:'c1',description:'Relazioni tra fasi',targetReferenceRevisionIds:['o1'],contextualReferenceRevisionIds:[]}],
    rubrics:[{...original,rubricId:'r',revisionId:'r1',source,criteria:[{criterionRevisionId:'c1',levels:[{levelId:'l1',label:'Coerente',description:'Collegamenti motivati'}]}]}],
    assessments:[{...original,assessmentId:'a',revisionId:'a1',date:'2026-11-19',period:'Q1',title:'Filiera sintetica',purpose:'formative',status:'planned',source:{kind:'explicit-activity',activityId:'activity1'},
      criteria:[{criterionRevisionId:'c1',rubricRevisionId:'r1',expected:{kind:'product',description:'Schema',method:'elaborato'}}]}],evidence:[]};
}
const request=()=>({assessmentRevisionId:'a1',revisionId:'a2',completedOn:'2026-11-20'});
function review(d:any=fixture(),r:any=request()):any{const p=previewAssessmentCompletion(d,scope,r);if(!p.valid)throw Error(p.issue);return p.preview;}
const confirm=(d:any,p:any=review(d),c:any=confirmation)=>confirmAssessmentCompletion(d,scope,p,c);
describe('VAL-01/S6a — svolgimento esplicito',()=>{
  test('planned to completed appends a new revision, preserving all planned metadata',()=>{
    const d=fixture(),before=structuredClone(d);const p=review(d);const c=confirm(d,p);
    if(!c.valid)throw Error(c.issue);
    expect(c.definition).toEqual({...d.assessments[0],...confirmation,revisionId:'a2',supersedesRevisionId:'a1',status:'completed',completedOn:'2026-11-20'});
    expect(validateAssessmentEvidenceV1({...d,assessments:[...d.assessments,c.definition]},scope).valid).toBe(true);
    expect(d).toEqual(before);
  });
  test('planned and actual dates are independent, including rescheduled earlier dates',()=>{
    const d=fixture();const p=review(d,{...request(),completedOn:'2026-11-18'});
    const c=confirm(d,p);if(!c.valid)throw Error(c.issue);
    expect(c.definition.date).toBe('2026-11-19');expect(c.definition.completedOn).toBe('2026-11-18');expect(c.definition.period).toBe('Q1');
  });
  test('no evidence, roster, grades or completed definition created by preview',()=>{
    const d=fixture();const p=review(d);expect(p.planned.status).toBe('planned');
    expect(p.scope.studentIds).toBeUndefined();expect(p.evidence).toBeUndefined();
    const c=confirm(d,p);expect(c.valid).toBe(true);expect(Object.keys(c).sort()).toEqual(['definition','valid']);
    expect(d.evidence).toEqual([]);expect(d.assessments).toHaveLength(1);
  });
  test('superseded or unknown planned revision is rejected',()=>{
    const d=fixture(),p=review(d);
    d.assessments.push({...d.assessments[0],revisionId:'a-new',supersedesRevisionId:'a1'});
    expect(confirm(d,p)).toEqual({valid:false,issue:'STALE_REVISION'});
    expect(previewAssessmentCompletion(d,scope,{...request(),assessmentRevisionId:'absent'})).toEqual({valid:false,issue:'STALE_REVISION'});
  });
  test('completed, cancelled and anomalously reopened logical assessments cannot complete',()=>{
    for(const status of ['completed','cancelled']){
      const d=fixture();d.assessments[0].status=status;if(status==='completed')d.assessments[0].completedOn='2026-11-19';
      expect(previewAssessmentCompletion(d,scope,request())).toEqual({valid:false,issue:'INVALID_STATUS'});
      const next={...d.assessments[0],revisionId:'a-new',supersedesRevisionId:'a1',status:'planned'};delete next.completedOn;d.assessments.push(next);
      expect(previewAssessmentCompletion(d,scope,{...request(),assessmentRevisionId:'a-new'})).toEqual({valid:false,issue:'INVALID_STATUS'});
    }
  });
  test('new revision identity is globally unique',()=>{
    for(const revisionId of ['a1','o1','c1','r1']){
      expect(previewAssessmentCompletion(fixture(),scope,{...request(),revisionId})).toEqual({valid:false,issue:'CONFLICT'});
    }
  });
  test('foreign context and tampered preview are rejected',()=>{
    const d=fixture(),p=review(d),other={...scope,classId:'other'};
    expect(previewAssessmentCompletion(d,other,request())).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
    expect(confirmAssessmentCompletion({...d,classId:'other'},other,p,confirmation)).toEqual({valid:false,issue:'STALE_PREVIEW'});
    p.planned.title='Alterato';expect(confirm(d,p)).toEqual({valid:false,issue:'STALE_PREVIEW'});
  });
  test('invalid date, extra fields, and premature confirmation fail closed',()=>{
    for(const completedOn of ['2026-02-30','2026-08-31','2027-09-01','invalid']){
      expect(previewAssessmentCompletion(fixture(),scope,{...request(),completedOn})).toEqual({valid:false,issue:'INVALID_REQUEST'});
    }
    expect(previewAssessmentCompletion(fixture(),scope,{...request(),grade:9})).toEqual({valid:false,issue:'INVALID_REQUEST'});
    const d=fixture(),p=review(d);
    for(const confirmedAt of ['2026-11-17T09:00:00.000Z','2026-11-19T09:00:00.000Z','invalid']){
      expect(confirm(d,p,{...confirmation,confirmedAt})).toEqual({valid:false,issue:'INVALID_CONFIRMATION'});
    }
  });
  test('historical references and rubric survive newer catalogue revisions',()=>{
    const d=fixture(),p=review(d);
    d.references.push({...d.references[0],revisionId:'o2',supersedesRevisionId:'o1'});
    d.rubrics.push({...d.rubrics[0],revisionId:'r2',supersedesRevisionId:'r1'});
    const c=confirm(d,p);if(!c.valid)throw Error(c.issue);
    expect(c.definition.criteria[0].rubricRevisionId).toBe('r1');
    expect(p.frozen.references[0].revisionId).toBe('o1');
  });
  test('explicit true confirmation is mandatory, no implicit authorization or extra input',()=>{
    const d=fixture(),p=review(d);
    for(const c of [null,{confirmedAt:confirmation.confirmedAt},{...confirmation,confirmedByTeacher:false},{...confirmation,extra:true}]){
      expect(confirm(d,p,c)).toEqual({valid:false,issue:'INVALID_CONFIRMATION'});
    }
  });
  test('same-revision content alteration invalidates frozen review',()=>{
    const d=fixture(),p=review(d);d.rubrics[0].criteria[0].levels[0].label='Diverso';
    expect(confirm(d,p)).toEqual({valid:false,issue:'STALE_PREVIEW'});
  });
  test('input getters are not invoked and returned data are detached',()=>{
    const d=fixture(),r=request();let invoked=false;
    Object.defineProperty(r,'completedOn',{enumerable:true,get(){invoked=true;return '2026-11-20';}});
    expect(previewAssessmentCompletion(d,scope,r)).toEqual({valid:false,issue:'INVALID_REQUEST'});expect(invoked).toBe(false);
    const c=confirm(d);if(!c.valid)throw Error(c.issue);
    (c.definition.criteria[0].expected as any).description='Altro';
    expect(d.assessments[0].criteria[0].expected.description).toBe('Schema');
  });
});
