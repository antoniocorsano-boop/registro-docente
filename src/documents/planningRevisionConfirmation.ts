/** DOC-01/D4b2 — synthetic annual planning and disciplinary council contribution.
 * UDA content is derived from D2b1; Arena V1 remains reference-only.
 * No structured curriculum values, collegiate decisions, or individual records.
 */
import {proposeDocumentRevision} from './documentRevisionIdentity';
import {createPlannedDocumentContentReview} from './plannedDocumentContent';
import {reviewArenaDocumentSource} from './arenaDocumentSource';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
import {createAssessmentDocumentReview} from './assessmentDocumentSource';
import type {AssessmentEvidenceV1,LearningReferenceRevision} from '../assessment/assessmentEvidence';

type Row=Record<string,unknown>;
type PlanReview=Extract<ReturnType<typeof createPlannedDocumentContentReview>,{status:'available'}>['review'];
type ArenaReview=Extract<ReturnType<typeof reviewArenaDocumentSource>,{valid:true}>['review'];
type ArenaArgs=readonly [unknown,unknown,unknown,unknown,unknown];
type Curriculum=Readonly<{status:'missing'|'reference-only';annualReferenceCount:number|null;objectives:null}>;
type AssessmentReview=Extract<ReturnType<typeof createAssessmentDocumentReview>,{valid:true}>['review'];
type LocalTarget=Readonly<{kind:LearningReferenceRevision['kind'];text:string;origin:'local'}>;
type TargetGroup=Readonly<{assessmentIndex:number;criterionIndex:number;targets:readonly LocalTarget[]}>;
type AssessmentLink=Readonly<{udaIndex:number;assessmentIndex:number}>;
type AssessmentContent=Readonly<{status:'missing'|'selected';coverage:'selected-only'|null;expected:AssessmentReview['presentation']['expected'];localTargets:readonly TargetGroup[];links:readonly AssessmentLink[];linkAuthority:'teacher-declared'|null;curriculumEquivalence:'not-established'}>;
type Content=Readonly<{planning:PlanReview['presentation'];curriculum:Curriculum;assessment?:AssessmentContent}>;
type Preview=Readonly<{official:false;complete:false;labOnly:true;kind:'disciplinary-plan'|'council-disciplinary-contribution';documentId:string;revisionId:string;number:number;content:Content}>;
type Status='draft'|'confirmed'|'review-required'|'revoked';
type Confirmation={valid:false}|{valid:true;confirmed:true;official:false;complete:false};
type Review=Readonly<{preview:Preview;status:(current:unknown)=>Status;confirm:(current:unknown,decision:unknown)=>Confirmation;revoke:(decision:unknown)=>boolean}>;
type Failure={valid:false;issue:'INVALID_INPUT'|'INVALID_REVISION'|'INVALID_SOURCE'|'CONTEXT_MISMATCH'|'UNSUPPORTED_KIND'};
type Inspected={valid:true;preview:Preview;basis:string;planningInput:unknown;planningReview:PlanReview;arenaArgs:ArenaArgs|null;arenaReview:ArenaReview|null;assessmentInput:unknown;assessmentReview:AssessmentReview|null;assessmentBasis:string};
type Result=Failure|{valid:true;review:Review};
const fail=(issue:Failure['issue']):Failure=>({valid:false,issue});
function exact(v:unknown,keys:readonly string[]):v is Row{
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value' in d;});
}
function canonical(v:unknown):string{
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null&&typeof v==='object'){const r=v as Row;return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';}
 return JSON.stringify(v)??'undefined';
}
function inspect(raw:unknown):Failure|Inspected{
 try{
  if(!exact(raw,['mode','revision','source'])||raw.mode!=='SYNTHETIC_ONLY')return fail('INVALID_INPUT');
  const revision=proposeDocumentRevision(raw.revision);
  if(!revision.valid)return fail('INVALID_REVISION');
  const {identity,revisions}=revision.history,{kind,documentId,scope,period}=identity;
  if(kind!=='disciplinary-plan'&&kind!=='council-disciplinary-contribution')return fail('UNSUPPORTED_KIND');
  // D2b1 supplies literal annual UDA periods, not validated calendar intervals.
  if(period.from!==scope.schoolYear.slice(0,4)+'-09-01'||period.to!==scope.schoolYear.slice(5)+'-08-31')return fail('INVALID_REVISION');
  const r=snapshotAssessmentData(raw.revision) as Row,s=snapshotAssessmentData(raw.source);
  const legacy=['scope','classes','bindings','modelSelection','planning','arena'];
  if(!exact(s,legacy)&&!exact(s,[...legacy,'assessment']))return fail('INVALID_SOURCE');
  if(!['scope','classes','bindings','modelSelection'].every(k=>canonical(r[k])===canonical(s[k])))return fail('CONTEXT_MISMATCH');
  const planningInput={scope:s.scope,classes:s.classes,bindings:s.bindings,modelSelection:s.modelSelection,planning:s.planning};
  const planned=createPlannedDocumentContentReview(planningInput);
  if(planned.status!=='available')return fail('INVALID_SOURCE');
  let arenaArgs:ArenaArgs|null=null,arenaReview:ArenaReview|null=null;
  if(s.arena!==null){
   if(!exact(s.arena,['profiles','accepted','selection']))return fail('INVALID_SOURCE');
   const sourceScope={institutionRef:scope.institutionRef,cohortRef:scope.cohortRef,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,gradeLevel:scope.gradeLevel,regimeRef:scope.regimeRef};
   arenaArgs=[sourceScope,s.classes,s.arena.profiles,s.arena.accepted,s.arena.selection];
   const checked=reviewArenaDocumentSource(...arenaArgs);
   if(!checked.valid)return fail('INVALID_SOURCE');
   arenaReview=checked.review;
  }
  const curriculum:Curriculum=Object.freeze({status:arenaReview?'reference-only':'missing',annualReferenceCount:arenaReview?.source.count??null,objectives:null});
  let assessment:AssessmentContent|undefined;
  let assessmentReview:AssessmentReview|null=null,assessmentInput:unknown=null,assessmentBasis='legacy';
  if(Object.prototype.hasOwnProperty.call(s,'assessment')){
   if(s.assessment===null){
    assessmentBasis='missing';
    assessment=Object.freeze({status:'missing',coverage:null,expected:Object.freeze([]),localTargets:Object.freeze([]),links:Object.freeze([]),linkAuthority:null,curriculumEquivalence:'not-established'});
   }else{
    const a=s.assessment;
    if(!exact(a,['graph','selection','links'])||!exact(a.selection,['confirmedByTeacher','scope','period','expectedRevisionIds','completedRevisionIds'])||
       !Array.isArray(a.selection.expectedRevisionIds)||!a.selection.expectedRevisionIds.length||
       !Array.isArray(a.selection.completedRevisionIds)||a.selection.completedRevisionIds.length!==0||
       !exact(a.links,['confirmedByTeacher','items'])||a.links.confirmedByTeacher!==true||!Array.isArray(a.links.items)||a.links.items.length>1000)return fail('INVALID_SOURCE');
    assessmentInput={mode:'SYNTHETIC_ONLY',scope:s.scope,classes:s.classes,bindings:s.bindings,modelSelection:s.modelSelection,period:r.period,graph:a.graph,selection:a.selection};
    const checked=createAssessmentDocumentReview(assessmentInput);
    if(!checked.valid)return fail('INVALID_SOURCE');
    assessmentReview=checked.review;
    // D3a has validated this exact professional graph, including its local
    // reference and historical criterion revisions. No individual evidence.
    const graph=a.graph as unknown as Omit<AssessmentEvidenceV1,'evidence'>;
    const expectedIds=a.selection.expectedRevisionIds as string[];
    const groups:TargetGroup[]=[];
    for(const [assessmentIndex,id] of expectedIds.entries()){
     const definition=graph.assessments.find(d=>d.revisionId===id);
     if(!definition)return fail('INVALID_SOURCE');
     for(const [criterionIndex,binding] of definition.criteria.entries()){
      const criterion=graph.criteria.find(c=>c.revisionId===binding.criterionRevisionId);
      if(!criterion)return fail('INVALID_SOURCE');
      const targets:LocalTarget[]=[];
      for(const refId of criterion.targetReferenceRevisionIds){
       const target=graph.references.find(t=>t.revisionId===refId);
       if(!target||target.source.kind!=='local')return fail('INVALID_SOURCE');
       targets.push(Object.freeze({kind:target.kind,text:target.text,origin:'local'}));
      }
      groups.push(Object.freeze({assessmentIndex,criterionIndex,targets:Object.freeze(targets)}));
     }
    }
    // D2b1 validates and preserves the selected UDA order. Links never
    // imply temporal overlap, curricular equivalence or actual outcomes.
    if(!exact(s.planning,['accepted','selection'])||s.planning.selection===null||typeof s.planning.selection!=='object')return fail('INVALID_SOURCE');
    const udaIds=(s.planning.selection as Row).udaIds;
    if(!Array.isArray(udaIds)||udaIds.length!==planned.review.presentation.udas.length)return fail('INVALID_SOURCE');
    const seen=new Set<string>(),links:AssessmentLink[]=[];
    for(const item of a.links.items){
     if(!exact(item,['udaId','assessmentRevisionId'])||typeof item.udaId!=='string'||typeof item.assessmentRevisionId!=='string')return fail('INVALID_SOURCE');
     const udaIndex=udaIds.indexOf(item.udaId),assessmentIndex=expectedIds.indexOf(item.assessmentRevisionId);
     if(udaIndex<0||assessmentIndex<0)return fail('INVALID_SOURCE');
     const key=udaIndex+':'+assessmentIndex;
     if(seen.has(key))return fail('INVALID_SOURCE');
     seen.add(key);links.push(Object.freeze({udaIndex,assessmentIndex}));
    }
    assessmentBasis=canonical(a.links);
    assessment=Object.freeze({status:'selected',coverage:'selected-only',expected:checked.review.presentation.expected,localTargets:Object.freeze(groups),links:Object.freeze(links),linkAuthority:'teacher-declared',curriculumEquivalence:'not-established'});
   }
  }
  const head=revisions.at(-1);if(!head)return fail('INVALID_REVISION');
  const preview:Preview=Object.freeze({official:false,complete:false,labOnly:true,kind,documentId,revisionId:head.revisionId,number:head.number,content:Object.freeze({planning:planned.review.presentation,curriculum,...(assessment===undefined?{}:{assessment})})});
  return {valid:true,preview,basis:canonical([revision.history,r.scope,r.classes,r.bindings,r.modelSelection,r.period]),planningInput,planningReview:planned.review,arenaArgs,arenaReview,assessmentInput,assessmentReview,assessmentBasis};
 }catch{return fail('INVALID_INPUT');}
}
export function createPlanningRevisionReview(input:unknown):Result{
 const r=inspect(input);if(!r.valid)return r;
 const {preview,basis,planningReview,arenaReview,assessmentReview,assessmentBasis}=r;
 let state:Status='draft';
 const status=(current:unknown):Status=>{
  if(state==='revoked'||state==='review-required')return state;
  const fresh=inspect(current);
  if(!fresh.valid||fresh.basis!==basis||canonical(fresh.preview)!==canonical(preview)||!planningReview.isCurrent(fresh.planningInput)||(arenaReview===null?fresh.arenaArgs!==null:!fresh.arenaArgs||!arenaReview.isCurrent(...fresh.arenaArgs))||fresh.assessmentBasis!==assessmentBasis||(assessmentReview===null?fresh.assessmentReview!==null:!fresh.assessmentReview||!assessmentReview.isCurrent(fresh.assessmentInput)))state='review-required';
  return state;
 };
 const matches=(decision:unknown,key:'confirmedByTeacher'|'revokedByTeacher',keys:string[]):decision is Row=>
  exact(decision,keys)&&decision[key]===true&&decision.documentId===preview.documentId&&decision.revisionId===preview.revisionId;
 const confirm=(current:unknown,decision:unknown):Confirmation=>{
  try{
   if(status(current)!=='draft'||!matches(decision,'confirmedByTeacher',['confirmedByTeacher','documentId','revisionId','reviewed'])||canonical(snapshotAssessmentData(decision.reviewed))!==canonical(preview))return {valid:false};
   state='confirmed';return {valid:true,confirmed:true,official:false,complete:false};
  }catch{return {valid:false};}
 };
 const revoke=(decision:unknown):boolean=>{
  try{
   if(state!=='confirmed'||!matches(decision,'revokedByTeacher',['revokedByTeacher','documentId','revisionId']))return false;
   state='revoked';return true;
  }catch{return false;}
 };
 return {valid:true,review:Object.freeze({preview,status,confirm,revoke})};
}
