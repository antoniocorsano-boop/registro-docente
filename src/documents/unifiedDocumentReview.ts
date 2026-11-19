/** DOC-01/D1d4a — isolated composition of existing source reviews.
 * No adapter to the live archive, no document text, no official approval.
 */
import { reviewArenaDocumentSource } from './arenaDocumentSource';
import { reviewPlanningDocumentSource } from './planningDocumentSource';
import { reviewRecordedLessonSource } from './recordedLessonSource';
import { normalizeSchoolYear } from '../planning/planningFrameResolver';
import { resolveCanonicalRegistroClass } from '../teaching/classIdentity';
type Row=Record<string,unknown>;
type Status='available'|'missing'|'review-required';
type Summary=Readonly<{status:Status;count:number|null;hours:number|null}>;
type RecordedSummary=Summary&Readonly<{coverage:'selected-only'|null}>;
type Presentation=Readonly<{official:false;complete:false;canConfirm:boolean;schoolYear:string;periodStart:string;periodEnd:string;curriculum:Summary;planning:Summary;recorded:RecordedSummary;unfilled:readonly string[]}>;
type Failure={valid:false;issue:'INVALID_INPUT'|'INVALID_CONTEXT'|'INVALID_CLASS'};
type Confirmation={valid:true;confirmed:true;official:false;complete:false}|{valid:false};
type Review=Readonly<{presentation:Presentation;isCurrent:(input:unknown)=>boolean;confirm:(input:unknown)=>Confirmation}>;
type ArenaResult=ReturnType<typeof reviewArenaDocumentSource>;
type PlanResult=ReturnType<typeof reviewPlanningDocumentSource>;
type RecordedResult=ReturnType<typeof reviewRecordedLessonSource>;
type Inspection={valid:true;presentation:Presentation;scopeBasis:string;arena:ArenaResult|null;planning:PlanResult|null;recorded:RecordedResult|null;arenaScope:Row;recordedScope:Row;classes:unknown;arenaInput:Row|null;recordedInput:Row|null};
const failure=(issue:Failure['issue']):Failure=>({valid:false,issue});
const scopeKeys=['institutionRef','cohortRef','classId','schoolYear','subjectCode','gradeLevel','regimeRef','periodStart','periodEnd'];
const nonempty=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=512;
function exact(v:unknown,keys:readonly string[]):v is Row{
 if(v===null||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return false;
 return Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value');});
}
function dense(v:unknown):v is unknown[]{
 return Array.isArray(v)&&v.length<=1000&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>!!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value'));
}
function date(v:unknown):v is string{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const d=new Date(v+'T00:00:00.000Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;
}
const summary=(status:Status,count:number|null=null,hours:number|null=null):Summary=>Object.freeze({status,count,hours});
function inspect(input:unknown):Failure|Inspection{
 try{
  if(!exact(input,['scope','classes','arena','planning','recorded']))return failure('INVALID_INPUT');
  const {scope,classes,arena,planning,recorded}=input;
  if(!exact(scope,scopeKeys)||!scopeKeys.filter(k=>k!=='gradeLevel').every(k=>nonempty(scope[k]))||
   typeof scope.gradeLevel!=='number'||![1,2,3].includes(scope.gradeLevel)||!date(scope.periodStart)||!date(scope.periodEnd))return failure('INVALID_CONTEXT');
  const year=normalizeSchoolYear(scope.schoolYear as string);
  if(!year||scope.periodStart<year.slice(0,4)+'-09-01'||scope.periodEnd>year.slice(5)+'-08-31'||scope.periodStart>scope.periodEnd)return failure('INVALID_CONTEXT');
  if(!dense(classes)||!classes.every(c=>exact(c,['id','name'])&&nonempty(c.id)&&nonempty(c.name)))return failure('INVALID_CLASS');
  const identities=classes as {id:string;name:string}[];
  if(new Set(identities.map(c=>c.id)).size!==identities.length)return failure('INVALID_CLASS');
  const cls=identities.find(c=>c.id===scope.classId);
  if(!cls)return failure('INVALID_CLASS');
  const resolved=resolveCanonicalRegistroClass(cls.name,identities);
  if(resolved.status!=='resolved'||resolved.classId!==scope.classId||resolved.semanticKey.split(':')[0]!==String(scope.gradeLevel))return failure('INVALID_CLASS');
  if(arena!==null&&!exact(arena,['profiles','accepted','selection']))return failure('INVALID_INPUT');
  if(planning!==null&&!exact(planning,['accepted','selection']))return failure('INVALID_INPUT');
  if(recorded!==null&&!exact(recorded,['records','selection']))return failure('INVALID_INPUT');
  const {periodStart,periodEnd,regimeRef,...baseScope}=scope;
  const arenaScope={...baseScope,regimeRef};
  const recordedScope={...baseScope,periodStart,periodEnd};
  const a=arena===null?null:reviewArenaDocumentSource(arenaScope,classes,arena.profiles,arena.accepted,arena.selection);
  const p=planning===null?null:reviewPlanningDocumentSource(baseScope,classes,planning.accepted,planning.selection);
  const r=recorded===null?null:reviewRecordedLessonSource(recordedScope,classes,recorded.records,recorded.selection);
  const curriculum=a===null?summary('missing'):a.valid?summary('available',a.review.source.count):summary('review-required');
  const plannedHours=p?.valid?p.source.references.reduce((sum,ref)=>sum+ref.plannedHours,0):null;
  const plan=p===null?summary('missing'):p.valid&&plannedHours!==null&&Number.isFinite(plannedHours)?summary('available',p.source.count,plannedHours):summary('review-required');
  const recordedSummary=r===null?summary('missing'):r.valid?summary('available',r.review.source.count,r.review.source.recordedHours):summary('review-required');
  const recordedView:RecordedSummary=Object.freeze({...recordedSummary,coverage:r?.valid?'selected-only':null});
  const states=[curriculum.status,plan.status,recordedView.status];
  const presentation:Presentation=Object.freeze({official:false,complete:false,canConfirm:states.includes('available')&&!states.includes('review-required'),
   schoolYear:year.replace('-','/'),periodStart,periodEnd,curriculum,planning:plan,recorded:recordedView,unfilled:Object.freeze(['objectives','transversalObjectives','assessmentMethods','strategies'])});
  return {valid:true,presentation,scopeBasis:JSON.stringify([scopeKeys.map(k=>scope[k]),cls.id,cls.name]),arena:a,planning:p,recorded:r,arenaScope,recordedScope,classes,arenaInput:arena,recordedInput:recorded};
 }catch{return failure('INVALID_INPUT');}
}
export function createUnifiedDocumentReview(input:unknown):Failure|{valid:true;review:Review}{
 const first=inspect(input);if(!first.valid)return first;
 // Keep only detached source reviews and a private scope binding, not the
 // input objects. Revalidate the exact selected sources before confirmation.
 const {presentation,scopeBasis,arena,planning,recorded}=first;
 const planBasis=planning?.valid?JSON.stringify(planning.source):null;
 const isCurrent=(nextInput:unknown):boolean=>{
  const next=inspect(nextInput);
  if(!next.valid||!presentation.canConfirm||!next.presentation.canConfirm||next.scopeBasis!==scopeBasis||JSON.stringify(next.presentation)!==JSON.stringify(presentation))return false;
  if(arena===null?next.arena!==null:!arena.valid||!next.arenaInput||!arena.review.isCurrent(next.arenaScope,next.classes,next.arenaInput.profiles,next.arenaInput.accepted,next.arenaInput.selection))return false;
  if(planning===null?next.planning!==null:!next.planning?.valid||JSON.stringify(next.planning.source)!==planBasis)return false;
  if(recorded===null?next.recorded!==null:!recorded.valid||!next.recordedInput||!recorded.review.isCurrent(next.recordedScope,next.classes,next.recordedInput.records,next.recordedInput.selection))return false;
  return true;
 };
 const confirm=(nextInput:unknown):Confirmation=>isCurrent(nextInput)?{valid:true,confirmed:true,official:false,complete:false}:{valid:false};
 return {valid:true,review:Object.freeze({presentation,isCurrent,confirm})};
}
