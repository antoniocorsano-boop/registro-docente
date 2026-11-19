/** DOC-01/D2a — laboratory mapping of professional field categories only.
 * These reference structures are not institutional templates or proof of adoption.
 * No document contents, personal values, approval or runtime integration.
 */
import {normalizeSchoolYear} from '../planning/planningFrameResolver';
import {resolveCanonicalRegistroClass} from '../teaching/classIdentity';
type Row=Record<string,unknown>;
const REFERENCE_VERSION='2026-27-map-v1';
type Model='council-contribution'|'disciplinary-first'|'disciplinary-second-third';
type Nature='context'|'expected'|'planned'|'professional-choice'|'recorded'|'evaluated'|'collegial';
type Origin='local-context'|'arena'|'docente-os'|'registro'|'val-01'|'teacher'|'institution'|'council'|'evidence-repertoire';
type Field=Readonly<{key:string;section:string;nature:Nature;origins:readonly Origin[];confirmation:'teacher'|'institution'|'council';disposition:'structured-reference'|'manual-review'|'excluded-restricted'|'collegial-only';privacy:'professional'|'restricted';destination:'disciplinary-contribution'|'disciplinary-plan'|'collegial-only'}>;
type Review=Readonly<{model:Model;version:string;official:false;complete:false;fields:readonly Field[]}>;
type Result={status:'available';review:Review}|{status:'missing'|'review-required'|'invalid-context'|'unsupported';review:null};
const absent=(status:'missing'|'review-required'|'invalid-context'|'unsupported'):Result=>({status,review:null});
const scopeKeys=['institutionRef','siteRef','classId','cohortRef','schoolYear','schoolOrder','gradeLevel','subjectCode','regimeRef','purpose'];
const bindingKeys=['model','version','institutionRef','siteRef','cohortRef','schoolYear','schoolOrder','gradeLevel','regimeRef','referenceStatus'];
const selectionKeys=['confirmedByTeacher','scope','model','version'];
const nonempty=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=256;
function exact(v:unknown,keys:readonly string[]):v is Row{
 if(v===null||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return false;
 return Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value');});
}
function dense(v:unknown):v is unknown[]{
 return Array.isArray(v)&&v.length<=1000&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>!!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value'));
}
function fields(model:Model):readonly Field[]{
 const destination=model==='council-contribution'?'disciplinary-contribution':'disciplinary-plan';
 const out:Field[]=[];
 const add=(key:string,section:string,nature:Nature,origins:Origin[],disposition:Field['disposition']='manual-review',confirmation:Field['confirmation']='teacher',privacy:Field['privacy']='professional')=>{
  out.push(Object.freeze({key,section,nature,origins:Object.freeze(origins),confirmation,disposition,privacy,destination:disposition==='collegial-only'?'collegial-only':destination}));
 };
 add('identity','context','context',['local-context'],'structured-reference');
 add('class-composition','initial-profile','context',['registro'],'excluded-restricted','teacher','restricted');
 add('initial-profile','initial-profile','evaluated',['registro','val-01','teacher'],'excluded-restricted','teacher','restricted');
 add('interventions','initial-profile','professional-choice',['teacher','docente-os']);
 if(model==='disciplinary-first'){
  add('core-domains','curriculum','expected',['arena'],'structured-reference');
  add('expected-competences','curriculum','expected',['arena'],'structured-reference');
  add('specific-objectives','curriculum','expected',['arena'],'structured-reference');
  add('knowledge','curriculum','expected',['arena','docente-os'],'structured-reference');
 }else if(model==='disciplinary-second-third'){
  add('term-content','curriculum','planned',['docente-os'],'structured-reference');
  add('planned-uda','curriculum','planned',['docente-os'],'structured-reference');
  add('disciplinary-objectives','curriculum','expected',['arena'],'structured-reference');
  add('observable-descriptors','curriculum','expected',['evidence-repertoire','arena'],'structured-reference');
  add('significant-tasks','curriculum','planned',['docente-os'],'structured-reference');
  add('skills','curriculum','expected',['arena','docente-os'],'structured-reference');
  add('knowledge','curriculum','expected',['arena','docente-os'],'structured-reference');
 }else{
  add('disciplinary-objectives','curriculum','expected',['arena'],'structured-reference');
  add('planned-uda','curriculum','planned',['docente-os'],'structured-reference');
  add('shared-objectives','collegial-frame','collegial',['council','institution'],'collegial-only','council');
  add('collegial-profile','collegial-frame','collegial',['council'],'collegial-only','council','restricted');
 }
 add('transversal-competences','transversal','expected',['arena','institution'],'manual-review','institution');
 add('methodologies','methods','professional-choice',['teacher','docente-os']);
 add('resources','methods','professional-choice',['teacher','docente-os']);
 add('assessment-methods','assessment','professional-choice',['teacher','docente-os']);
 add('common-assessment-criteria','assessment','collegial',['institution','council'],'collegial-only','council');
 add('civic-education','civic-orientation','planned',['institution','arena','docente-os']);
 add('orientation','civic-orientation','planned',['institution','docente-os','teacher']);
 if(model==='council-contribution')add('council-approval','approval','collegial',['council'],'collegial-only','council');
 return Object.freeze(out);
}
/** Bind a locally reviewed reference variant; this is not an adoption attestation. */
export function reviewInstitutionalDocumentModel(scope:unknown,classes:unknown,bindings:unknown,selection:unknown):Result{
 try{
  if(!exact(scope,scopeKeys)||scope.schoolOrder!=='lower_secondary'||typeof scope.gradeLevel!=='number'||![1,2,3].includes(scope.gradeLevel)||
    !scopeKeys.filter(k=>k!=='gradeLevel').every(k=>nonempty(scope[k])))return absent('invalid-context');
  const year=normalizeSchoolYear(scope.schoolYear as string);if(!year)return absent('invalid-context');
  if(!dense(classes)||!classes.every(c=>exact(c,['id','name'])&&nonempty(c.id)&&nonempty(c.name)))return absent('invalid-context');
  const identities=classes as {id:string;name:string}[];
  if(new Set(identities.map(c=>c.id)).size!==identities.length)return absent('invalid-context');
  const cls=identities.find(c=>c.id===scope.classId);if(!cls)return absent('invalid-context');
  const resolved=resolveCanonicalRegistroClass(cls.name,identities);
  if(resolved.status!=='resolved'||resolved.classId!==scope.classId||resolved.semanticKey.split(':')[0]!==String(scope.gradeLevel))return absent('invalid-context');
  const model:Model|null=scope.purpose==='council-contribution'?'council-contribution':scope.purpose==='disciplinary-plan'?(scope.gradeLevel===1?'disciplinary-first':'disciplinary-second-third'):null;
  if(!model||year!=='2026-2027')return absent('unsupported');
  if(!dense(bindings)||!bindings.every(b=>exact(b,bindingKeys)&&typeof b.gradeLevel==='number'&&[1,2,3].includes(b.gradeLevel)&&bindingKeys.filter(k=>k!=='gradeLevel').every(k=>nonempty(b[k]))&&
    ['unverified','reviewed-reference'].includes(b.referenceStatus as string)&&['council-contribution','disciplinary-first','disciplinary-second-third'].includes(b.model as string)))return absent('review-required');
  const rows=bindings as Row[];
  // Never infer the regime or institutional applicability from the grade alone.
  const matches=rows.filter(b=>b.model===model&&['institutionRef','siteRef','cohortRef','schoolOrder','gradeLevel','regimeRef'].every(k=>b[k]===scope[k])&&normalizeSchoolYear(b.schoolYear as string)===year);
  if(matches.length===0)return absent('missing');
  if(matches.length!==1||matches[0].referenceStatus!=='reviewed-reference'||matches[0].version!==REFERENCE_VERSION)return absent('review-required');
  const binding=matches[0];
  if(!exact(selection,selectionKeys)||selection.confirmedByTeacher!==true||!exact(selection.scope,scopeKeys))return absent('review-required');
  const reviewedScope=selection.scope;
  if(!scopeKeys.every(k=>reviewedScope[k]===scope[k])||selection.model!==model||selection.version!==binding.version||!nonempty(binding.version))return absent('review-required');
  return {status:'available',review:Object.freeze({model,version:binding.version,official:false,complete:false,fields:fields(model)})};
 }catch{return absent('review-required');}
}
