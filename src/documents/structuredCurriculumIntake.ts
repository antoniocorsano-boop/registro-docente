/** DOC-01/D2b2b — admission boundary and curriculum field placement.
 * No productive supplement exists yet. No payload text is admitted.
 * Metadata is only a preparation aid; a future verified Arena producer
 * and explicit teacher selection are required for any content review.
 */
import {reviewInstitutionalDocumentModel} from './institutionalDocumentModel';
import {reviewArenaDocumentSource} from './arenaDocumentSource';
type Row=Record<string,unknown>;
type Model=NonNullable<ReturnType<typeof reviewInstitutionalDocumentModel>['review']>;
type Kind='core-theme'|'competence'|'milestone'|'objective'|'knowledge'|'skill'|'evidence';
type Placement=Readonly<{kind:Kind;field:string|null;disposition:'candidate-field'|'support-only'|'specificity-review';nature:'expected';state:'unfilled'}>;
type Status='lab-rejected'|'unsupported-contract'|'reference-only'|'supplement-missing'|'model-review-required'|'curriculum-review-required'|'invalid-input';
type Result=Readonly<{status:Status;canAcquire:false;official:false;complete:false;placements:readonly Placement[];annualReferenceCount:number|null}>;
const scopeKeys=['institutionRef','siteRef','classId','cohortRef','schoolYear','schoolOrder','gradeLevel','subjectCode','regimeRef','purpose'];
const kinds:readonly Kind[]=['core-theme','competence','milestone','objective','knowledge','skill','evidence'];
function record(v:unknown):v is Row{
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return typeof k==='string'&&!!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value');});
}
const exact=(v:unknown,keys:readonly string[]):v is Row=>record(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
function result(status:Status,placements:readonly Placement[]=[],annualReferenceCount:number|null=null):Result{
 return Object.freeze({status,canAcquire:false,official:false,complete:false,placements:Object.freeze([...placements]),annualReferenceCount});
}
function placements(model:Model):readonly Placement[]{
 const first=model.model==='disciplinary-first',council=model.model==='council-contribution';
 return Object.freeze(kinds.map(kind=>{
  let field:string|null=null;
  switch(kind){
   case 'core-theme':field=first?'core-domains':null;break;
   case 'competence':field=first?'expected-competences':null;break;
   case 'objective':field=first?'specific-objectives':'disciplinary-objectives';break;
   case 'knowledge':field=council?null:'knowledge';break;
   case 'skill':field=first||council?null:'skills';break;
   case 'evidence':field=first||council?null:'observable-descriptors';break;
   case 'milestone':break; // Never conflate a milestone with an annual competence.
  }
  const eligible=field!==null&&model.fields.some(f=>f.key===field&&f.nature==='expected'&&f.privacy==='professional'&&f.disposition==='structured-reference'&&f.origins.includes('arena'));
  const destination=eligible?field:null;
  const disposition:Placement['disposition']=!destination?'support-only':kind==='objective'?'specificity-review':'candidate-field';
  return Object.freeze({kind,field:destination,disposition,nature:'expected',state:'unfilled'} as const);
 }));
}
/** Fail closed even when a caller claims a valid receipt or recomputes a hash.
 * The experimental Arena packet is never a productive input. Unknown future
 * contracts are rejected until an explicitly governed verifier is implemented.
 */
export function reviewStructuredCurriculumIntake(input:unknown):Result{
 try{
  if(!exact(input,['scope','classes','bindings','modelSelection','arena','supplement']))return result('invalid-input');
  const {scope,classes,bindings,modelSelection,arena,supplement}=input;
  // Classify the supplement before reading anything else. Never expose its text.
  if(supplement!==null){
   if(!record(supplement))return result('invalid-input');
   if(supplement.contract==='ARENA_REGISTRO_STRUCTURED_CONTENT_LAB_V1'||supplement.labOnly===true||supplement.authority==='SYNTHETIC_ONLY')return result('lab-rejected');
   // The only existing V1 contains annual references, not structured fields.
   if(supplement.contract!=='ARENA_REGISTRO_PLANNING_CONTEXT_V1')return result('unsupported-contract');
  }
  if(!exact(scope,scopeKeys))return result('invalid-input');
  const model=reviewInstitutionalDocumentModel(scope,classes,bindings,modelSelection);
  if(model.status!=='available')return result('model-review-required');
  if(!exact(arena,['profiles','accepted','selection']))return result('curriculum-review-required');
  const sourceScope={institutionRef:scope.institutionRef,cohortRef:scope.cohortRef,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,gradeLevel:scope.gradeLevel,regimeRef:scope.regimeRef};
  const checked=reviewArenaDocumentSource(sourceScope,classes,arena.profiles,arena.accepted,arena.selection);
  if(!checked.valid)return result('curriculum-review-required');
  // Never trust the supplied V1 supplement itself: the count is only from D1d2.
  return result(supplement===null?'supplement-missing':'reference-only',placements(model.review),checked.review.source.count);
 }catch{return result('invalid-input');}
}
