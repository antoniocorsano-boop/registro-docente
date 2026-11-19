/** DOC-01/D4a — synthetic, in-memory draft identity and revision lineage.
 * No document payload, content binding, teacher signature, storage or global registry.
 * D3b private individual destinations intentionally require a separate protected design.
 */
import {reviewInstitutionalDocumentModel} from './institutionalDocumentModel';
import {normalizeSchoolYear} from '../planning/planningFrameResolver';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
type Row=Record<string,unknown>;
type Kind='disciplinary-plan'|'program-completed'|'final-report'|'council-disciplinary-contribution';
type Reason='initial'|'content-update'|'source-update'|'correction';
type Scope=Readonly<{institutionRef:string;siteRef:string;classId:string;cohortRef:string;schoolYear:string;schoolOrder:'lower_secondary';gradeLevel:number;subjectCode:string;regimeRef:string;purpose:'disciplinary-plan'|'council-contribution'}>;
type Model=NonNullable<ReturnType<typeof reviewInstitutionalDocumentModel>['review']>['model'];
type Identity=Readonly<{documentId:string;kind:Kind;scope:Scope;period:Readonly<{from:string;to:string}>;model:Model;mappingVersion:string}>;
type Revision=Readonly<{revisionId:string;number:number;previousRevisionId:string|null;reason:Reason;state:'draft'}>;
type History=Readonly<{schemaVersion:1;official:false;complete:false;labOnly:true;identity:Identity;revisions:readonly Revision[]}>;
type Issue='INVALID_INPUT'|'INVALID_CONTEXT'|'INVALID_HISTORY'|'INVALID_REQUEST'|'STALE_HEAD'|'IDENTITY_MISMATCH';
type Result={valid:false;issue:Issue}|{valid:true;history:History};
const fail=(issue:Issue):Result=>({valid:false,issue});
const kinds:readonly Kind[]=['disciplinary-plan','program-completed','final-report','council-disciplinary-contribution'];
const reasons:readonly Reason[]=['initial','content-update','source-update','correction'];
const scopeKeys=['institutionRef','siteRef','classId','cohortRef','schoolYear','schoolOrder','gradeLevel','subjectCode','regimeRef','purpose'];
const requestKeys=['expectedHead','revisionId','reason'];
const revisionKeys=['revisionId','number','previousRevisionId','reason','state'];
const historyKeys=['schemaVersion','official','complete','labOnly','identity','revisions'];
const inputKeys=['mode','kind','documentId','scope','classes','bindings','modelSelection','period','history','request'];
const demoId=(v:unknown):v is string=>typeof v==='string'&&/^demo-[a-z0-9-]{1,64}$/.test(v);
function exact(v:unknown,keys:readonly string[]):v is Row{
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value' in d;});
}
function date(v:unknown):v is string{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const t=Date.parse(v+'T00:00:00.000Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v;
}
function canonical(v:unknown):string{
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null&&typeof v==='object'){const r=v as Row;return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';}
 return JSON.stringify(v)??'undefined';
}
/** Propose a fresh draft revision against the caller's exact current head.
 * This validates one supplied lineage, not uniqueness across histories or atomic CAS.
 */
export function proposeDocumentRevision(raw:unknown):Result{
 try{
  if(!exact(raw,inputKeys)||raw.mode!=='SYNTHETIC_ONLY'||!exact(raw.scope,scopeKeys)||!exact(raw.request,requestKeys)||!kinds.includes(raw.kind as Kind)||!demoId(raw.documentId))return fail('INVALID_INPUT');
  if(raw.history!==null&&!exact(raw.history,historyKeys))return fail('INVALID_HISTORY');
  const input=snapshotAssessmentData(raw);
  if(!exact(input,inputKeys)||!exact(input.scope,scopeKeys)||!exact(input.request,requestKeys)||!exact(input.period,['from','to']))return fail('INVALID_INPUT');
  const {scope,classes,bindings,modelSelection,period,request,history}=input;
  const kind=input.kind as Kind,documentId=input.documentId as string;
  const model=reviewInstitutionalDocumentModel(scope,classes,bindings,modelSelection);
  if(model.status!=='available'||scope.purpose!==(kind==='council-disciplinary-contribution'?'council-contribution':'disciplinary-plan'))return fail('INVALID_CONTEXT');
  if(!['institutionRef','siteRef','classId','cohortRef','regimeRef'].every(k=>demoId(scope[k]))||typeof scope.subjectCode!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(scope.subjectCode))return fail('INVALID_CONTEXT');
  if(!Array.isArray(classes)||!classes.every(c=>exact(c,['id','name'])&&demoId(c.id)))return fail('INVALID_CONTEXT');
  const year=typeof scope.schoolYear==='string'?normalizeSchoolYear(scope.schoolYear):null;
  if(!year||!date(period.from)||!date(period.to)||period.from>period.to||period.from<year.slice(0,4)+'-09-01'||period.to>year.slice(5)+'-08-31')return fail('INVALID_CONTEXT');
  const identity:Identity=Object.freeze({documentId,kind,scope:Object.freeze({...scope,schoolYear:year.replace('-','/')} as Scope),period:Object.freeze({from:period.from,to:period.to}),model:model.review.model,mappingVersion:model.review.version});
  if(!demoId(request.revisionId)||request.revisionId===documentId||!reasons.includes(request.reason as Reason)||!(request.expectedHead===null||demoId(request.expectedHead)))return fail('INVALID_REQUEST');
  const revisions:Revision[]=[];const seen=new Set<string>();
  if(history!==null){
   if(!exact(history,historyKeys)||history.schemaVersion!==1||history.official!==false||history.complete!==false||history.labOnly!==true||!Array.isArray(history.revisions)||history.revisions.length<1||history.revisions.length>=1000)return fail('INVALID_HISTORY');
   if(canonical(history.identity)!==canonical(identity))return fail('IDENTITY_MISMATCH');
   for(const rev of history.revisions){
    const previous=revisions.at(-1)?.revisionId??null;
    if(!exact(rev,revisionKeys)||!demoId(rev.revisionId)||rev.revisionId===documentId||seen.has(rev.revisionId)||rev.number!==revisions.length+1||rev.previousRevisionId!==previous||rev.state!=='draft'||!reasons.includes(rev.reason as Reason)||(previous===null)!==(rev.reason==='initial'))return fail('INVALID_HISTORY');
    seen.add(rev.revisionId);revisions.push(Object.freeze({revisionId:rev.revisionId,number:rev.number as number,previousRevisionId:previous,reason:rev.reason as Reason,state:'draft'}));
   }
  }
  const head=revisions.at(-1)?.revisionId??null;
  if(request.expectedHead!==head)return fail('STALE_HEAD');
  if(seen.has(request.revisionId)||(head===null)!==(request.reason==='initial'))return fail('INVALID_REQUEST');
  revisions.push(Object.freeze({revisionId:request.revisionId,number:revisions.length+1,previousRevisionId:head,reason:request.reason as Reason,state:'draft'}));
  return {valid:true,history:Object.freeze({schemaVersion:1,official:false,complete:false,labOnly:true,identity,revisions:Object.freeze(revisions)})};
 }catch{return fail('INVALID_INPUT');}
}
