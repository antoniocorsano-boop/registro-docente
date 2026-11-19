/** DOC-01/D3c — laboratory consuntivo, never a final official document.
 * Selected recorded lessons and completed assessment definitions are distinct.
 * Free text is teacher-selected synthetic material, not privacy-certified.
 */
import {reviewRecordedLessonSource} from './recordedLessonSource';
import {createAssessmentDocumentReview} from './assessmentDocumentSource';
import {reviewInstitutionalDocumentModel} from './institutionalDocumentModel';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
import {normalizeSchoolYear} from '../planning/planningFrameResolver';
type Row=Record<string,unknown>;
type Issue='INVALID_INPUT'|'INVALID_CONTEXT'|'INVALID_SOURCE'|'INVALID_SELECTION';
type Failure={valid:false;issue:Issue};
type Activity=Readonly<{date:string;hours:number;title:string|null}>;
type Completed=Extract<ReturnType<typeof createAssessmentDocumentReview>,{valid:true}>['review']['presentation']['completed'][number];
type Section='methodologies'|'resources'|'interventions'|'civic-education'|'orientation'|'professional-reflection';
type Presentation=Readonly<{official:false;complete:false;labOnly:true;coverage:'selected-only';period:Readonly<{from:string;to:string}>;recorded:Readonly<{status:'selected'|'not-selected';count:number|null;hours:number|null;activities:readonly Activity[]}>;assessments:Readonly<{status:'selected'|'not-selected';completed:readonly Completed[]}>;links:readonly Readonly<{activityIndex:number;assessmentIndex:number}>[];summary:readonly Readonly<{section:Section;text:string}>[];coverageAssessment:'not-established';institutionalModel:'reference-only'}>;
type Inspection=Failure|{valid:true;presentation:Presentation;basis:string;recorded:Extract<ReturnType<typeof reviewRecordedLessonSource>,{valid:true}>|null;assessment:Extract<ReturnType<typeof createAssessmentDocumentReview>,{valid:true}>|null;recordedArgs:readonly [unknown,unknown,unknown,unknown]|null;assessmentArgs:unknown};
type Confirmation={valid:true;confirmed:true;official:false;complete:false}|{valid:false};
type Result=Failure|{valid:true;review:Readonly<{presentation:Presentation;isCurrent:(input:unknown)=>boolean;confirm:(input:unknown)=>Confirmation}>};
const fail=(issue:Issue):Failure=>({valid:false,issue});
const scopeKeys=['institutionRef','siteRef','classId','cohortRef','schoolYear','schoolOrder','gradeLevel','subjectCode','regimeRef','purpose'];
const inputKeys=['mode','scope','classes','bindings','modelSelection','period','recorded','assessment','selection'];
const graphKeys=['version','classId','schoolYear','subjectCode','references','criteria','rubrics','assessments'];
const sections:readonly Section[]=['methodologies','resources','interventions','civic-education','orientation','professional-reflection'];
function exact(v:unknown,keys:readonly string[]):v is Row{
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value' in d;});
}
function date(v:unknown):v is string{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const t=Date.parse(v+'T00:00:00.000Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v;
}
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const list=(v:unknown):v is unknown[]=>Array.isArray(v)&&v.length<=1000;
const canonical=(v:unknown):string=>{
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null&&typeof v==='object'){const r=v as Row;return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';}
 return JSON.stringify(v)??'undefined';
};
function inspect(raw:unknown):Inspection{
 try{
  if(!exact(raw,inputKeys)||raw.mode!=='SYNTHETIC_ONLY')return fail('INVALID_INPUT');
  if(raw.assessment!==null&&(!exact(raw.assessment,['graph','selection'])||!exact(raw.assessment.graph,graphKeys)))return fail('INVALID_INPUT');
  if(raw.recorded!==null&&!exact(raw.recorded,['records','selection']))return fail('INVALID_INPUT');
  const input=snapshotAssessmentData(raw);
  if(!exact(input,inputKeys)||!exact(input.scope,scopeKeys)||!exact(input.period,['from','to']))return fail('INVALID_CONTEXT');
  const {scope,classes,bindings,modelSelection,period,recorded,assessment,selection}=input;
  const model=reviewInstitutionalDocumentModel(scope,classes,bindings,modelSelection);
  if(model.status!=='available'||scope.purpose!=='disciplinary-plan')return fail('INVALID_CONTEXT');
  const year=typeof scope.schoolYear==='string'?normalizeSchoolYear(scope.schoolYear):null;
  if(!year||!date(period.from)||!date(period.to)||period.from>period.to||period.from<year.slice(0,4)+'-09-01'||period.to>year.slice(5)+'-08-31')return fail('INVALID_CONTEXT');
  const from=period.from,to=period.to;
  if(!exact(selection,['confirmedByTeacher','scope','period','topics','links','summary'])||selection.confirmedByTeacher!==true||canonical(selection.scope)!==canonical(scope)||canonical(selection.period)!==canonical(period)||!list(selection.topics)||!list(selection.links)||!list(selection.summary))return fail('INVALID_SELECTION');
  let rec:Extract<ReturnType<typeof reviewRecordedLessonSource>,{valid:true}>|null=null;
  let ass:Extract<ReturnType<typeof createAssessmentDocumentReview>,{valid:true}>|null=null;
  let recordedArgs:readonly [unknown,unknown,unknown,unknown]|null=null;
  let assessmentArgs:unknown=null;
  if(recorded!==null){
   if(!exact(recorded,['records','selection']))return fail('INVALID_SOURCE');
   const s={institutionRef:scope.institutionRef,cohortRef:scope.cohortRef,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,gradeLevel:scope.gradeLevel,periodStart:from,periodEnd:to};
   recordedArgs=[s,classes,recorded.records,recorded.selection];
   const r=reviewRecordedLessonSource(...recordedArgs);if(!r.valid)return fail('INVALID_SOURCE');rec=r;
  }
  let completedIds:string[]=[];
  if(assessment!==null){
   if(!exact(assessment,['graph','selection'])||!exact(assessment.selection,['confirmedByTeacher','scope','period','expectedRevisionIds','completedRevisionIds']))return fail('INVALID_SOURCE');
   assessmentArgs={mode:input.mode,scope,classes,bindings,modelSelection,period,graph:assessment.graph,selection:assessment.selection};
   const r=createAssessmentDocumentReview(assessmentArgs);if(!r.valid)return fail('INVALID_SOURCE');ass=r;
   completedIds=assessment.selection.completedRevisionIds as string[];
  }
  const refs=rec?.review.source.references??[];
  const completed=ass?.review.presentation.completed??[];
  const topics=new Map<string,string>();
  for(const t of selection.topics){
   if(!exact(t,['lessonId','title'])||typeof t.lessonId!=='string'||!text(t.title,500)||topics.has(t.lessonId)||!refs.some(r=>r.lessonId===t.lessonId))return fail('INVALID_SELECTION');
   topics.set(t.lessonId,t.title);
  }
  const activities=Object.freeze(refs.map(r=>Object.freeze({date:r.date,hours:r.hours,title:topics.get(r.lessonId)??null})));
  const links:Readonly<{activityIndex:number;assessmentIndex:number}>[]=[];const linked=new Set<number>();
  for(const l of selection.links){
   if(!exact(l,['lessonId','revisionId'])||typeof l.lessonId!=='string'||typeof l.revisionId!=='string')return fail('INVALID_SELECTION');
   const activityIndex=refs.findIndex(r=>r.lessonId===l.lessonId),assessmentIndex=completedIds.indexOf(l.revisionId);
   // A teacher-confirmed same-day relation, not inferred from dates or activityId.
   if(activityIndex<0||assessmentIndex<0||linked.has(assessmentIndex)||refs[activityIndex].date!==completed[assessmentIndex]?.completedOn)return fail('INVALID_SELECTION');
   linked.add(assessmentIndex);links.push(Object.freeze({activityIndex,assessmentIndex}));
  }
  const summary:Readonly<{section:Section;text:string}>[]=[];const used=new Set<Section>();
  for(const s of selection.summary){
   if(!exact(s,['section','text'])||!sections.includes(s.section as Section)||!text(s.text,4000)||used.has(s.section as Section))return fail('INVALID_SELECTION');
   const section=s.section as Section;used.add(section);summary.push(Object.freeze({section,text:s.text}));
  }
  if(!rec&&!completed.length&&!summary.length)return fail('INVALID_SELECTION');
  const presentation:Presentation=Object.freeze({official:false,complete:false,labOnly:true,coverage:'selected-only',period:Object.freeze({from,to}),recorded:Object.freeze({status:rec?'selected':'not-selected',count:rec?.review.source.count??null,hours:rec?.review.source.recordedHours??null,activities}),assessments:Object.freeze({status:completed.length?'selected':'not-selected',completed}),links:Object.freeze(links),summary:Object.freeze(summary),coverageAssessment:'not-established',institutionalModel:'reference-only'});
  return {valid:true,presentation,basis:canonical([scope,(classes as {id:string;name:string}[]).find(c=>c.id===scope.classId),model.review.model,model.review.version,period,selection,!!rec,!!ass]),recorded:rec,assessment:ass,recordedArgs,assessmentArgs};
 }catch{return fail('INVALID_INPUT');}
}
export function createFinalDocumentReview(input:unknown):Result{
 const r=inspect(input);if(!r.valid)return r;
 const isCurrent=(next:unknown):boolean=>{
  const n=inspect(next);if(!n.valid||n.basis!==r.basis||canonical(n.presentation)!==canonical(r.presentation))return false;
  if(r.recorded&&(!n.recordedArgs||!r.recorded.review.isCurrent(...n.recordedArgs)))return false;
  if(r.assessment&&!r.assessment.review.isCurrent(n.assessmentArgs))return false;
  return true;
 };
 const confirm=(next:unknown):Confirmation=>isCurrent(next)?{valid:true,confirmed:true,official:false,complete:false}:{valid:false};
 return {valid:true,review:Object.freeze({presentation:r.presentation,isCurrent,confirm})};
}
