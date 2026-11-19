/** DOC-01/D3a — isolated class-level professional definition review.
 * A synthetic-only input slice deliberately excludes roster and individual evidence.
 * Structural validation of the definition slice is not a save receipt, proof of
 * completion, institutional adoption, or an attestation of text privacy.
 */
import {validateAssessmentEvidenceV1} from '../assessment/assessmentEvidence';
import type {AssessmentEvidenceV1,AssessmentDefinitionRevision} from '../assessment/assessmentEvidence';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
import {normalizeSchoolYear} from '../planning/planningFrameResolver';
import {reviewInstitutionalDocumentModel} from './institutionalDocumentModel';

type Row=Record<string,unknown>;
type Model=NonNullable<ReturnType<typeof reviewInstitutionalDocumentModel>['review']>;
type ExpectedCriterion=Readonly<{criterion:string;kind:AssessmentDefinitionRevision['criteria'][number]['expected']['kind'];description:string;method:string}>;
type Expected=Readonly<{title:string;purpose:AssessmentDefinitionRevision['purpose'];plannedDate:string;criteria:readonly ExpectedCriterion[]}>;
type Completed=Readonly<{title:string;purpose:AssessmentDefinitionRevision['purpose'];completedOn:string}>;
type Presentation=Readonly<{model:Model['model'];mappingVersion:string;official:false;complete:false;labOnly:true;coverage:'selected-only';period:Readonly<{from:string;to:string}>;expected:readonly Expected[];completed:readonly Completed[];lessonLink:'not-established';assessmentMethods:'teacher-review-required';institutionalDescriptors:'reference-only'|'not-in-model'}>;
type Failure={valid:false;issue:'INVALID_INPUT'|'MODEL_REVIEW_REQUIRED'|'INVALID_PERIOD'|'INVALID_DEFINITIONS'|'INVALID_SELECTION'|'STALE_SELECTION'};
type Inspection=Failure|{valid:true;presentation:Presentation;basis:string};
type Confirmation={valid:true;confirmed:true;official:false;complete:false}|{valid:false};
type Review=Readonly<{presentation:Presentation;isCurrent:(input:unknown)=>boolean;confirm:(input:unknown)=>Confirmation}>;
type Result=Failure|{valid:true;review:Review};
const failure=(issue:Failure['issue']):Failure=>({valid:false,issue});
const scopeKeys=['institutionRef','siteRef','classId','cohortRef','schoolYear','schoolOrder','gradeLevel','subjectCode','regimeRef','purpose'];
const graphKeys=['version','classId','schoolYear','subjectCode','references','criteria','rubrics','assessments'];
const inputKeys=['mode','scope','classes','bindings','modelSelection','period','graph','selection'];
const selectionKeys=['confirmedByTeacher','scope','period','expectedRevisionIds','completedRevisionIds'];
function exact(v:unknown,keys:readonly string[]):v is Row{
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value');});
}
function day(v:unknown):v is string{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const t=Date.parse(v+'T00:00:00.000Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v;
}
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const ids=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=1000&&v.every(id)&&new Set(v).size===v.length;
const canonical=(v:unknown):string=>{
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null&&typeof v==='object'){const r=v as Row;return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';}
 return JSON.stringify(v)??'undefined';
};
function inspect(raw:unknown):Inspection{
 try{
  // Reject a full graph or roster before detaching anything. The class-level
  // slice is a narrow proposed input, not an adapter to the real archive.
  if(!exact(raw,inputKeys)||raw.mode!=='SYNTHETIC_ONLY'||!exact(raw.graph,graphKeys))return failure('INVALID_INPUT');
  const input=snapshotAssessmentData(raw);
  if(!exact(input,inputKeys)||!exact(input.scope,scopeKeys)||!exact(input.graph,graphKeys))return failure('INVALID_INPUT');
  const {scope,classes,bindings,modelSelection,period,graph,selection}=input;
  const model=reviewInstitutionalDocumentModel(scope,classes,bindings,modelSelection);
  if(model.status!=='available')return failure('MODEL_REVIEW_REQUIRED');
  const year=typeof scope.schoolYear==='string'?normalizeSchoolYear(scope.schoolYear):null;
  if(!year||!exact(period,['from','to'])||!day(period.from)||!day(period.to)||period.from>period.to||period.from<year.slice(0,4)+'-09-01'||period.to>year.slice(5)+'-08-31')return failure('INVALID_PERIOD');
  const from=period.from,to=period.to;
  // Reuse the canonical validator with an explicitly empty evidence array and
  // roster. This validates only the professional definitions, not a full VAL graph.
  const document={...graph,evidence:[]};
  const localScope={classId:scope.classId,schoolYear:year.replace('-','/'),subjectCode:scope.subjectCode,studentIds:[]};
  if(!validateAssessmentEvidenceV1(document,localScope).valid)return failure('INVALID_DEFINITIONS');
  const d=document as unknown as AssessmentEvidenceV1;
  if(!exact(selection,selectionKeys)||selection.confirmedByTeacher!==true||!exact(selection.scope,scopeKeys)||!exact(selection.period,['from','to']))return failure('INVALID_SELECTION');
  const reviewedScope=selection.scope;
  if(!scopeKeys.every(k=>reviewedScope[k]===scope[k])||selection.period.from!==from||selection.period.to!==to||!ids(selection.expectedRevisionIds)||!ids(selection.completedRevisionIds)||selection.expectedRevisionIds.length+selection.completedRevisionIds.length===0)return failure('INVALID_SELECTION');
  const superseded=new Set(d.assessments.flatMap(a=>a.supersedesRevisionId?[a.supersedesRevisionId]:[]));
  const active=d.assessments.filter(a=>!superseded.has(a.revisionId));
  const within=(date:string)=>date>=from&&date<=to;
  const expected:Expected[]=[],completed:Completed[]=[];
  const selected:AssessmentDefinitionRevision[]=[];
  for(const revisionId of selection.expectedRevisionIds){
   const a=active.find(a=>a.revisionId===revisionId);
   if(!a||a.status==='cancelled'||!within(a.date))return failure('STALE_SELECTION');
   selected.push(a);
   expected.push(Object.freeze({title:a.title,purpose:a.purpose,plannedDate:a.date,criteria:Object.freeze(a.criteria.map(b=>{
    const criterion=d.criteria.find(c=>c.revisionId===b.criterionRevisionId)!;
    return Object.freeze({criterion:criterion.description,kind:b.expected.kind,description:b.expected.description,method:b.expected.method});
   }))}));
  }
  for(const revisionId of selection.completedRevisionIds){
   const a=active.find(a=>a.revisionId===revisionId);
   if(!a||a.status!=='completed'||!a.completedOn||!within(a.completedOn))return failure('STALE_SELECTION');
   selected.push(a);
   completed.push(Object.freeze({title:a.title,purpose:a.purpose,completedOn:a.completedOn}));
  }
  // Freeze the exact selected definitions and their historical dependencies.
  // Later revisions of a criterion do not rewrite a frozen assessment.
  const criterionIds=new Set(selected.flatMap(a=>a.criteria.map(b=>b.criterionRevisionId)));
  const rubricIds=new Set(selected.flatMap(a=>a.criteria.flatMap(b=>b.rubricRevisionId?[b.rubricRevisionId]:[])));
  const criteria=d.criteria.filter(c=>criterionIds.has(c.revisionId));
  const referenceIds=new Set(criteria.flatMap(c=>[...c.targetReferenceRevisionIds,...c.contextualReferenceRevisionIds]));
  const dependencies={criteria,references:d.references.filter(r=>referenceIds.has(r.revisionId)),rubrics:d.rubrics.filter(r=>rubricIds.has(r.revisionId))};
  const presentation:Presentation=Object.freeze({model:model.review.model,mappingVersion:model.review.version,official:false,complete:false,labOnly:true,coverage:'selected-only',period:Object.freeze({from,to}),expected:Object.freeze(expected),completed:Object.freeze(completed),lessonLink:'not-established',assessmentMethods:'teacher-review-required',institutionalDescriptors:model.review.fields.some(f=>f.key==='observable-descriptors'&&f.nature==='expected')?'reference-only':'not-in-model'});
  // Private comparison only, never a presentation field or authority assertion.
  const identities=classes as {id:string;name:string}[];
  const identity=identities.find(c=>c.id===scope.classId);
  if(!identity)return failure('INVALID_INPUT');
  const basis=canonical([scope,identity,model.review.model,model.review.version,period,selection,selected,dependencies]);
  return {valid:true,presentation,basis};
 }catch{return failure('INVALID_INPUT');}
}
export function createAssessmentDocumentReview(input:unknown):Result{
 const r=inspect(input);if(!r.valid)return r;
 const {presentation,basis}=r;
 const isCurrent=(next:unknown)=>{const fresh=inspect(next);return fresh.valid&&fresh.basis===basis&&canonical(fresh.presentation)===canonical(presentation);};
 const confirm=(next:unknown):Confirmation=>isCurrent(next)?{valid:true,confirmed:true,official:false,complete:false}:{valid:false};
 return {valid:true,review:Object.freeze({presentation,isCurrent,confirm})};
}
