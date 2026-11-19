/** DOC-01/D2b1 — in-memory, synthetic-only review of selected planned UDA content.
 * Reuses D2a and D1d1. No curriculum interpretation, no real-data adapter.
 * The V1 privacy declaration alone is not a content privacy audit.
 */
import {reviewInstitutionalDocumentModel} from './institutionalDocumentModel';
import {reviewPlanningDocumentSource} from './planningDocumentSource';
import {normalizePlanningState} from '../planning/normalizePlanningState';
type Row=Record<string,unknown>;
type ModelReview=NonNullable<ReturnType<typeof reviewInstitutionalDocumentModel>['review']>;
type PlannedUda=Readonly<{title:string;focus:string;sourcePeriod:string;plannedHours:number}>;
type Presentation=Readonly<{model:ModelReview['model'];mappingVersion:string;official:false;complete:false;origin:'docente-os';nature:'planned';placement:'supporting-plan'|'planned-uda';udas:readonly PlannedUda[];unfilled:readonly string[];excluded:readonly string[]}>;
type Failure={status:'model-missing'|'model-review-required'|'invalid-context'|'unsupported'|'planning-missing'|'planning-review-required';review:null};
type Inspection=Failure|{status:'available';presentation:Presentation;basis:string};
type Confirmation={valid:true;confirmed:true;official:false;complete:false}|{valid:false};
type Review=Readonly<{presentation:Presentation;isCurrent:(input:unknown)=>boolean;confirm:(input:unknown)=>Confirmation}>;
const fail=(status:Failure['status']):Failure=>({status,review:null});
const scopeKeys=['institutionRef','siteRef','classId','cohortRef','schoolYear','schoolOrder','gradeLevel','subjectCode','regimeRef','purpose'];
function exact(v:unknown,keys:readonly string[]):v is Row{
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
}
/** Reject accessors, symbols, sparse arrays and non-JSON shapes before canonical validation.
 * Bounded to a small laboratory handoff; never invoke getters or stringify input objects.
 */
function detach(value:unknown):unknown{
 let budget=50000;const ancestors=new Set<object>();
 function visit(v:unknown,depth:number):unknown{
  if(--budget<0||depth>24)throw Error('input limit');
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='string'){if(v.length>16000)throw Error('text limit');return v;}
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v!=='object'||v===null||ancestors.has(v))throw Error('invalid input');
  ancestors.add(v);
  try{
   if(Array.isArray(v)){
    if(v.length>1000||Reflect.ownKeys(v).length!==v.length+1)throw Error('invalid array');
    return Array.from({length:v.length},(_,i)=>{
     const d=Object.getOwnPropertyDescriptor(v,String(i));
     if(!d?.enumerable||!Object.prototype.hasOwnProperty.call(d,'value'))throw Error('invalid item');
     return visit(d.value,depth+1);
    });
   }
   if(![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('invalid object');
   const out:Row=Object.create(null);
   for(const k of Reflect.ownKeys(v)){
    if(typeof k!=='string'||['__proto__','constructor','prototype'].includes(k))throw Error('invalid key');
    const d=Object.getOwnPropertyDescriptor(v,k);
    if(!d?.enumerable||!Object.prototype.hasOwnProperty.call(d,'value'))throw Error('invalid property');
    out[k]=visit(d.value,depth+1);
   }
   return out;
  }finally{ancestors.delete(v);}
 }
 return visit(value,0);
}
function inspect(raw:unknown):Inspection{
 try{
  const input=detach(raw);
  if(!exact(input,['scope','classes','bindings','modelSelection','planning']))return fail('invalid-context');
  const {scope,classes,bindings,modelSelection,planning}=input;
  const model=reviewInstitutionalDocumentModel(scope,classes,bindings,modelSelection);
  if(model.status!=='available'){
   if(model.status==='missing')return fail('model-missing');
   if(model.status==='review-required')return fail('model-review-required');
   return fail(model.status);
  }
  if(!exact(scope,scopeKeys))return fail('invalid-context');
  if(planning===null)return fail('planning-missing');
  if(!exact(planning,['accepted','selection']))return fail('planning-review-required');
  const planScope={institutionRef:scope.institutionRef,cohortRef:scope.cohortRef,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,gradeLevel:scope.gradeLevel};
  const result=reviewPlanningDocumentSource(planScope,classes,planning.accepted,planning.selection);
  if(!result.valid)return fail('planning-review-required');
  const source=result.source;
  // Re-read only the detached, canonically validated acceptance used by D1d1.
  const normalized=normalizePlanningState({schemaVersion:2,profiles:[],arenaContexts:[],resources:[],masterPrograms:[],classInstances:[],docenteOsProjections:planning.accepted});
  const matches=normalized.docenteOsProjections.filter(a=>a.projection.projectionFingerprint.hash===source.projectionHash&&a.acceptedAt===source.acceptedAt);
  if(matches.length!==1)return fail('planning-review-required');
  const sections=matches[0].projection.classes.filter(s=>s.sourceSectionId===source.sourceSectionId);
  if(sections.length!==1)return fail('planning-review-required');
  const section=sections[0];const udas:PlannedUda[]=[];
  for(const ref of source.references){
   const found=section.udas.filter(u=>u.projectedUdaId===ref.udaId);
   if(found.length!==1||found[0].plannedHours!==ref.plannedHours)return fail('planning-review-required');
   const u=found[0];
   // Preserve the literal source period. No conversion into terms, objectives or tasks.
   udas.push(Object.freeze({title:u.title,focus:u.focus,sourcePeriod:u.period,plannedHours:u.plannedHours}));
  }
  const placement=model.review.model==='disciplinary-first'?'supporting-plan':'planned-uda';
  const excluded=model.review.fields.filter(f=>f.disposition==='excluded-restricted'||f.disposition==='collegial-only').map(f=>f.key);
  const unfilled=model.review.fields.filter(f=>!excluded.includes(f.key)&&!(placement==='planned-uda'&&f.key==='planned-uda')).map(f=>f.key);
  const presentation:Presentation=Object.freeze({model:model.review.model,mappingVersion:model.review.version,official:false,complete:false,origin:'docente-os',nature:'planned',placement,udas:Object.freeze(udas),unfilled:Object.freeze(unfilled),excluded:Object.freeze(excluded)});
  // Retain only a private, minimal revision binding; the fingerprint covers
  // selected source contents, not generatedAt. No raw acceptance in the closure.
  const identities=classes as {id:string;name:string}[];
  const identity=identities.find(c=>c.id===scope.classId);
  if(!identity)return fail('invalid-context');
  const basis=JSON.stringify([scopeKeys.map(k=>scope[k]),identity.id,identity.name,model.review.model,model.review.version,source.projectionHash,source.acceptedAt,source.sourceSectionId,source.references,section.canonicalPlan.generationId]);
  return {status:'available',presentation,basis};
 }catch{return fail('planning-review-required');}
}
export function createPlannedDocumentContentReview(input:unknown):Failure|{status:'available';review:Review}{
 const result=inspect(input);if(result.status!=='available')return result;
 const {presentation,basis}=result;
 const isCurrent=(next:unknown)=>{const current=inspect(next);return current.status==='available'&&current.basis===basis&&JSON.stringify(current.presentation)===JSON.stringify(presentation);};
 const confirm=(next:unknown):Confirmation=>isCurrent(next)?{valid:true,confirmed:true,official:false,complete:false}:{valid:false};
 return {status:'available',review:Object.freeze({presentation,isCurrent,confirm})};
}
