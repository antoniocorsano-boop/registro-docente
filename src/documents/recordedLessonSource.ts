/** DOC-01/D1d3 — selected recorded lesson references, not annual completion.
 * Narrow input contract derived from existing local UdaRecord/UdaLesson:
 * no roster, title, topic, notes, grades, planned hours, or archive access.
 * The legacy lesson model lacks institution/year/subject/cohort identity.
 * A teacher-reviewed scope is required; it is not independent source authority.
 */
import { normalizeSchoolYear } from '../planning/planningFrameResolver';
import { resolveCanonicalRegistroClass } from '../teaching/classIdentity';
import { isDocenteOsProjectedUdaId } from '../teaching/teachingUdaCatalog';
import type { UdaRecord, UdaLesson } from '../types';
type Row=Record<string,unknown>;
type Lesson=Pick<UdaLesson,'id'|'date'|'hours'>;
type LocalRecord=Pick<UdaRecord,'id'|'className'>&{lessons?:Lesson[]};
type Ref=Readonly<{udaId:string;lessonId:string;date:string;hours:number}>;
type Source=Readonly<{kind:'recorded-lesson-references';official:false;coverage:'selected-only';count:number;recordedHours:number;plannedHours:null;references:readonly Ref[]}>;
type Issue='INVALID_CONTEXT'|'INVALID_CLASS'|'INVALID_RECORD'|'INVALID_SELECTION'|'STALE_SELECTION'|'INVALID_INPUT';
type Internal={valid:false;issue:Issue}|{valid:true;source:Source;basis:string};
type Review={valid:false;issue:Issue}|{valid:true;review:Readonly<{source:Source;isCurrent:(scope:unknown,classes:unknown,records:unknown,selection:unknown)=>boolean}>};
const fail=(issue:Issue):{valid:false;issue:Issue}=>({valid:false,issue});
const scopeKeys=['institutionRef','cohortRef','classId','schoolYear','subjectCode','gradeLevel','periodStart','periodEnd'];
const nonempty=(x:unknown):x is string=>typeof x==='string'&&!!x.trim()&&x.length<=512;
function exact(value:unknown,keys:readonly string[]):value is Row{
 if(value===null||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 return Reflect.ownKeys(value).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(value,k);return !!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value');});
}
function dense(value:unknown):value is unknown[]{
 if(!Array.isArray(value)||value.length>10000||Reflect.ownKeys(value).length!==value.length+1)return false;
 return Array.from({length:value.length},(_,i)=>Object.getOwnPropertyDescriptor(value,String(i))).every(d=>!!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value'));
}
function date(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
// Mirrors the diary input's half-hour increments and maximum per entry.
const hours=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0.5&&value<=10&&Number.isInteger(value*2);
function inspect(scope:unknown,classes:unknown,records:unknown,selection:unknown):Internal{
 try{
  if(!exact(scope,scopeKeys)||!scopeKeys.filter(k=>k!=='gradeLevel').every(k=>nonempty(scope[k]))
   ||typeof scope.gradeLevel!=='number'||![1,2,3].includes(scope.gradeLevel)||!date(scope.periodStart)||!date(scope.periodEnd))return fail('INVALID_CONTEXT');
  const year=normalizeSchoolYear(scope.schoolYear as string);
  if(!year||scope.periodStart<year.slice(0,4)+'-09-01'||scope.periodEnd>year.slice(5)+'-08-31'||scope.periodStart>scope.periodEnd)return fail('INVALID_CONTEXT');
  if(!dense(classes)||!classes.every(c=>exact(c,['id','name'])&&nonempty(c.id)&&nonempty(c.name)))return fail('INVALID_CLASS');
  const identities=classes as {id:string;name:string}[];
  if(new Set(identities.map(c=>c.id)).size!==identities.length)return fail('INVALID_CLASS');
  const cls=identities.find(c=>c.id===scope.classId);
  if(!cls)return fail('INVALID_CLASS');
  const resolved=resolveCanonicalRegistroClass(cls.name,identities);
  if(resolved.status!=='resolved'||resolved.classId!==scope.classId||resolved.semanticKey.split(':')[0]!==String(scope.gradeLevel))return fail('INVALID_CLASS');
  if(!exact(selection,['confirmedByTeacher','scope','lessons'])||selection.confirmedByTeacher!==true||!exact(selection.scope,scopeKeys))return fail('INVALID_SELECTION');
  const reviewedScope=selection.scope;
  if(!scopeKeys.every(k=>reviewedScope[k]===scope[k])||!dense(selection.lessons)||!selection.lessons.length)return fail('INVALID_SELECTION');
  if(!dense(records))return fail('INVALID_RECORD');
  const byId=new Map<string,LocalRecord>();
  const lessonIds=new Set<string>();
  for(const row of records){
   if(!exact(row,['id','className','lessons'])&&!exact(row,['id','className']))return fail('INVALID_RECORD');
   const hasLessons=Object.prototype.hasOwnProperty.call(row,'lessons');
   if(!nonempty(row.id)||!nonempty(row.className)||isDocenteOsProjectedUdaId(row.id)||byId.has(row.id))return fail('INVALID_RECORD');
   const entries:Lesson[]=[];
   if(hasLessons){
    if(!dense(row.lessons))return fail('INVALID_RECORD');
    for(const l of row.lessons){
     if(!exact(l,['id','date','hours'])||!nonempty(l.id)||!date(l.date)||!hours(l.hours)||lessonIds.has(l.id))return fail('INVALID_RECORD');
     lessonIds.add(l.id);entries.push({id:l.id,date:l.date,hours:l.hours});
    }
   }
   byId.set(row.id,{id:row.id,className:row.className,lessons:entries});
  }
  const refs:Ref[]=[];const chosen=new Set<string>();
  for(const ref of selection.lessons){
   if(!exact(ref,['udaId','lessonId','date','hours'])||!nonempty(ref.udaId)||!nonempty(ref.lessonId)||!date(ref.date)||!hours(ref.hours)||chosen.has(ref.lessonId))return fail('INVALID_SELECTION');
   if(ref.date<scope.periodStart||ref.date>scope.periodEnd)return fail('INVALID_SELECTION');
   const uda=byId.get(ref.udaId);
   if(!uda)return fail('STALE_SELECTION');
   const owner=resolveCanonicalRegistroClass(uda.className,identities);
   if(owner.status!=='resolved'||owner.classId!==scope.classId)return fail('INVALID_CLASS');
   const lesson=uda.lessons?.find(l=>l.id===ref.lessonId);
   if(!lesson||lesson.date!==ref.date||lesson.hours!==ref.hours)return fail('STALE_SELECTION');
   chosen.add(ref.lessonId);
   refs.push(Object.freeze({udaId:uda.id,lessonId:lesson.id,date:lesson.date,hours:lesson.hours}));
  }
  const source:Source=Object.freeze({kind:'recorded-lesson-references',official:false,coverage:'selected-only',count:refs.length,recordedHours:refs.reduce((sum,r)=>sum+r.hours,0),plannedHours:null,references:Object.freeze(refs)});
  return {valid:true,source,basis:JSON.stringify([scopeKeys.map(k=>scope[k]),resolved.semanticKey,cls.id,refs])};
 }catch{return fail('INVALID_INPUT');}
}
export function reviewRecordedLessonSource(scope:unknown,classes:unknown,records:unknown,selection:unknown):Review{
 const result=inspect(scope,classes,records,selection);
 if(!result.valid)return result;
 return {valid:true,review:Object.freeze({source:result.source,isCurrent:(s:unknown,c:unknown,r:unknown,a:unknown)=>{
  const next=inspect(s,c,r,a);return next.valid&&next.basis===result.basis;
 }})};
}
