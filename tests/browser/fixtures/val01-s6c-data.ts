import type {AssessmentEvidenceV1,AssessmentScopeV1,AssessmentDefinitionRevision,IndividualEvidenceRevision} from '../../../src/assessment/assessmentEvidence';
export const boardScope:AssessmentScopeV1={classId:'synthetic-board',schoolYear:'2026/2027',subjectCode:'TECH',studentIds:['s1','s2','s3','s4','s5']};
const start={confirmedByTeacher:true as const,confirmedAt:'2026-11-18T08:00:00.000Z'};
const completed={confirmedByTeacher:true as const,confirmedAt:'2026-11-20T10:00:00.000Z'};
const observed={confirmedByTeacher:true as const,confirmedAt:'2026-11-20T11:00:00.000Z',recordedAt:'2026-11-20T10:30:00.000Z',observedOn:'2026-11-20'};
const source={kind:'local' as const,sourceVersion:'v1'};
const expected={kind:'product' as const,description:'Schema delle relazioni',method:'Elaborato'};
const planned:AssessmentDefinitionRevision={...start,assessmentId:'a',revisionId:'a1',date:'2026-11-19',period:'Q1',title:'Filiera sintetica',purpose:'formative',status:'planned',source:{kind:'explicit-activity',activityId:'activity'},criteria:[{criterionRevisionId:'c1',expected},{criterionRevisionId:'c2',expected}]};
const done:AssessmentDefinitionRevision={...planned,...completed,revisionId:'a2',supersedesRevisionId:'a1',status:'completed',completedOn:'2026-11-20'};
function identity(studentId:string,event:string,criterionRevisionId='c1'){
 return {...observed,studentId,assessmentRevisionId:'a2',criterionRevisionId,evidenceId:'e-'+event,revisionId:'r-'+event,observationEventId:'event-'+event};
}
const evidence:IndividualEvidenceRevision[]=[
 {...identity('s1','1'),state:'observed',fact:{...expected,description:'Collegamenti esplicitati'},interpretation:{kind:'pending'}},
 {...identity('s2','2'),state:'not_observed'},
 {...identity('s3','3'),state:'not_applicable'},
 {...identity('s5','5','c2'),state:'observed',fact:{...expected,description:'Scelta motivata'},interpretation:{kind:'description',description:'Motivazione pertinente'}}
];
export const boardDocument:AssessmentEvidenceV1={version:1,classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode,
 references:[{...start,referenceId:'o',revisionId:'o1',kind:'specific-objective',text:'Rappresentare la filiera',source}],
 criteria:[{...start,criterionId:'c',revisionId:'c1',description:'Relazioni tra fasi',targetReferenceRevisionIds:['o1'],contextualReferenceRevisionIds:[]},{...start,criterionId:'d',revisionId:'c2',description:'Motivazione tecnica',targetReferenceRevisionIds:['o1'],contextualReferenceRevisionIds:[]}],
 rubrics:[],assessments:[planned,done],evidence};
