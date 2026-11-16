/**
 * VAL-01/D1a.2b.2 — pure proposal of explicit, frozen local revision links.
 * This is not a persistence format, an authenticated teacher confirmation,
 * a current-status projection of historical links, or a competence judgment.
 */
import { validateAssessmentEvidenceV1 } from './assessmentEvidence';
import type { AssessmentEvidenceV1, AssessmentScopeV1, AssessmentDefinitionRevision, IndividualEvidenceRevision } from './assessmentEvidence';
import { resolveAssessmentBatchLink } from './assessmentBatchLink';
import type { AssessmentBatchLink, AssessmentBatchProof, IndividualGradeIdentity } from './assessmentBatchLink';

type BatchOnly = Omit<AssessmentBatchLink,'individual'>;
type IndividualLink = BatchOnly & { readonly individual: IndividualGradeIdentity };
export type AssessmentRevisionBinding =
  | { readonly kind:'assessment'; readonly assessmentRevisionId:string; readonly link:BatchOnly }
  | { readonly kind:'evidence'; readonly evidenceRevisionId:string; readonly link:IndividualLink };
type Issue = 'INVALID_DOCUMENT'|'INVALID_BINDINGS'|'INVALID_REQUEST'|'CONFLICT'|'UNRESOLVED_LINK';
export type AssessmentBindingProposal =
  | { readonly valid:true; readonly status:'added'|'unchanged'; readonly bindings:readonly AssessmentRevisionBinding[] }
  | { readonly valid:false; readonly issue:Issue };
type Row = Record<string,unknown>;
const invalid=(issue:Issue):AssessmentBindingProposal=>({valid:false,issue});
const own=(o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
const id=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);

/** Detach plain own data before validation; never invoke getters or toJSON. */
function snapshot(value:unknown, ancestors=new Set<object>()):unknown {
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'||typeof value==='undefined')return value;
  if(typeof value!=='object'||ancestors.has(value))throw new Error('INVALID_DATA');
  ancestors.add(value);
  try{
    const proto=Object.getPrototypeOf(value),keys=Reflect.ownKeys(value);
    if(Array.isArray(value)){
      if(proto!==Array.prototype)throw new Error('INVALID_DATA');
      const length=Object.getOwnPropertyDescriptor(value,'length')?.value;
      if(!Number.isSafeInteger(length)||length<0||keys.length!==length+1)throw new Error('INVALID_DATA');
      const out:unknown[]=[];
      for(let i=0;i<length;i++){
        const d=Object.getOwnPropertyDescriptor(value,String(i));
        if(!d||!('value' in d)||!d.enumerable)throw new Error('INVALID_DATA');
        out.push(snapshot(d.value,ancestors));
      }
      return out;
    }
    if(proto!==Object.prototype&&proto!==null)throw new Error('INVALID_DATA');
    const out:Row=Object.create(null);
    for(const k of keys){
      if(typeof k!=='string')throw new Error('INVALID_DATA');
      const d=Object.getOwnPropertyDescriptor(value,k);
      if(!d||!('value' in d)||!d.enumerable)throw new Error('INVALID_DATA');
      out[k]=snapshot(d.value,ancestors);
    }
    return out;
  }finally{ancestors.delete(value);}
}
function exact(x:unknown,required:readonly string[],optional:readonly string[]=[]):x is Row {
  return x!==null&&typeof x==='object'&&!Array.isArray(x)&&
    required.every(k=>own(x,k))&&Object.keys(x).every(k=>required.includes(k)||optional.includes(k))&&
    optional.every(k=>!own(x,k)||(x as Row)[k]!==undefined);
}
function validBatchId(x:unknown):x is string{
  return id(x)&&!x.startsWith('online_')&&(!x.startsWith('daily_')||
    /^daily_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x));
}
function validProof(x:unknown,year:string):x is Row{
  if(!exact(x,['batchId','date','type','period','title'],['udaId']))return false;
  const date=x.date;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const t=Date.parse(date+'T00:00:00.000Z');
  return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===date&&
    date>=year.slice(0,4)+'-09-01'&&date<=year.slice(5)+'-08-31'&&
    validBatchId(x.batchId)&&['test','verifica','orale','disegno','osserv'].includes(x.type as string)&&
    (x.period==='Q1'||x.period==='Q2')&&typeof x.title==='string'&&x.title.trim().length>0&&x.title.length<=2000&&
    (!own(x,'udaId')||id(x.udaId));
}
function shape(x:unknown,scope:AssessmentScopeV1):x is AssessmentRevisionBinding{
  if(!exact(x,['kind','link'],['assessmentRevisionId','evidenceRevisionId']))return false;
  const isEvidence=x.kind==='evidence';
  if(isEvidence?!exact(x,['kind','evidenceRevisionId','link'])||!id(x.evidenceRevisionId):
    x.kind!=='assessment'||!exact(x,['kind','assessmentRevisionId','link'])||!id(x.assessmentRevisionId))return false;
  const l=x.link;
  if(!exact(l,['classId','schoolYear','subjectCode','proof','confirmedByTeacher'],isEvidence?['individual']:[])||
    l.classId!==scope.classId||l.schoolYear!==scope.schoolYear||l.subjectCode!==scope.subjectCode||
    l.confirmedByTeacher!==true||!validProof(l.proof,scope.schoolYear))return false;
  if(!isEvidence)return true;
  return exact(l.individual,['studentId','gradeId'])&&id(l.individual.studentId)&&id(l.individual.gradeId)&&
    !l.individual.gradeId.startsWith('online_grade_')&&scope.studentIds.includes(l.individual.studentId);
}
function sameProof(a:AssessmentBatchProof,b:AssessmentBatchProof):boolean{
  return a.batchId===b.batchId&&a.date===b.date&&a.type===b.type&&a.period===b.period&&a.title===b.title&&a.udaId===b.udaId;
}
function sameBinding(a:AssessmentRevisionBinding,b:AssessmentRevisionBinding):boolean{
  if(a.kind!==b.kind||!sameProof(a.link.proof,b.link.proof))return false;
  if(a.kind==='assessment'&&b.kind==='assessment')return a.assessmentRevisionId===b.assessmentRevisionId;
  if(a.kind==='evidence'&&b.kind==='evidence')return a.evidenceRevisionId===b.evidenceRevisionId&&
    a.link.individual.studentId===b.link.individual.studentId&&a.link.individual.gradeId===b.link.individual.gradeId;
  return false;
}
function definitionMatches(a:AssessmentDefinitionRevision|undefined,p:AssessmentBatchProof):a is AssessmentDefinitionRevision{
  return a!==undefined&&a.status==='completed'&&a.date===p.date&&a.period===p.period&&a.title===p.title;
}
function key(b:AssessmentRevisionBinding):string{return b.kind==='assessment'?b.assessmentRevisionId:b.evidenceRevisionId;}
function copy(b:AssessmentRevisionBinding):AssessmentRevisionBinding{
  const l=b.link,p=l.proof;
  const link:BatchOnly={classId:l.classId,schoolYear:l.schoolYear,subjectCode:l.subjectCode,confirmedByTeacher:true,
    proof:{batchId:p.batchId,date:p.date,type:p.type,period:p.period,title:p.title,...(p.udaId!==undefined?{udaId:p.udaId}:{})}};
  return b.kind==='assessment'?{kind:'assessment',assessmentRevisionId:b.assessmentRevisionId,link}:
    {kind:'evidence',evidenceRevisionId:b.evidenceRevisionId,link:{...link,
      individual:{studentId:b.link.individual.studentId,gradeId:b.link.individual.gradeId}}};
}
function superseded(rows:readonly {readonly supersedesRevisionId?:string}[]):Set<string>{
  return new Set(rows.flatMap(r=>r.supersedesRevisionId?[r.supersedesRevisionId]:[]));
}
function validateCollection(bindings:readonly AssessmentRevisionBinding[],data:AssessmentEvidenceV1):boolean{
  const assessments=new Map(data.assessments.map(a=>[a.revisionId,a]));
  const evidence=new Map(data.evidence.map(e=>[e.revisionId,e]));
  const seen=new Set<string>(),batchOwner=new Map<string,string>(),assessmentBatch=new Map<string,string>();
  const proofByRevision=new Map<string,AssessmentBatchProof>();
  const gradeByEvidence=new Map<string,string>(),gradeOwner=new Map<string,string>();
  for(const b of bindings){
    const k=key(b);
    if(seen.has(k))return false;
    seen.add(k);
    if(b.kind!=='assessment')continue;
    const a=assessments.get(b.assessmentRevisionId),p=b.link.proof;
    if(!definitionMatches(a,p))return false;
    if((batchOwner.has(p.batchId)&&batchOwner.get(p.batchId)!==a.assessmentId)||
       (assessmentBatch.has(a.assessmentId)&&assessmentBatch.get(a.assessmentId)!==p.batchId))return false;
    batchOwner.set(p.batchId,a.assessmentId);assessmentBatch.set(a.assessmentId,p.batchId);
    proofByRevision.set(a.revisionId,p);
  }
  for(const b of bindings){
    if(b.kind!=='evidence')continue;
    const e=evidence.get(b.evidenceRevisionId),i=b.link.individual;
    if(!e||e.state!=='observed'||e.studentId!==i.studentId)return false;
    const p=proofByRevision.get(e.assessmentRevisionId);
    if(!p||!sameProof(p,b.link.proof))return false;
    if(gradeByEvidence.has(e.evidenceId)&&gradeByEvidence.get(e.evidenceId)!==i.gradeId)return false;
    gradeByEvidence.set(e.evidenceId,i.gradeId);
    const owner=JSON.stringify([p.batchId,i.studentId]);
    if(gradeOwner.has(i.gradeId)&&gradeOwner.get(i.gradeId)!==owner)return false;
    gradeOwner.set(i.gradeId,owner);
  }
  return true;
}

/** Validate history independently from the current archive. Only the explicitly
 * requested active revision must resolve against that archive; a stale retry
 * fails closed, but cannot erase or reassign earlier frozen identities. */
export function proposeAssessmentRevisionBinding(
  document:unknown,scope:unknown,archive:unknown,bindings:unknown,request:unknown
):AssessmentBindingProposal{
  let data:AssessmentEvidenceV1,context:AssessmentScopeV1;
  try{
    const d=snapshot(document),s=snapshot(scope);
    if(!validateAssessmentEvidenceV1(d,s).valid)return invalid('INVALID_DOCUMENT');
    data=d as AssessmentEvidenceV1;context=s as AssessmentScopeV1;
  }catch{return invalid('INVALID_DOCUMENT');}
  let history:AssessmentRevisionBinding[];
  try{
    const b=snapshot(bindings);
    if(!Array.isArray(b)||!b.every(x=>shape(x,context)))return invalid('INVALID_BINDINGS');
    history=b as AssessmentRevisionBinding[];
    if(!validateCollection(history,data))return invalid('INVALID_BINDINGS');
  }catch{return invalid('INVALID_BINDINGS');}
  try{
    const r=snapshot(request);
    if(!shape(r,context))return invalid('INVALID_REQUEST');
    const aIndex=new Map(data.assessments.map(a=>[a.revisionId,a]));
    const aSuperseded=superseded(data.assessments),eSuperseded=superseded(data.evidence);
    let a:AssessmentDefinitionRevision|undefined;
    if(r.kind==='assessment'){
      a=aIndex.get(r.assessmentRevisionId);
    }else{
      const e:IndividualEvidenceRevision|undefined=data.evidence.find(e=>e.revisionId===r.evidenceRevisionId);
      if(!e||e.state!=='observed'||eSuperseded.has(e.revisionId)||e.studentId!==r.link.individual.studentId)return invalid('INVALID_REQUEST');
      a=aIndex.get(e.assessmentRevisionId);
    }
    if(!definitionMatches(a,r.link.proof)||aSuperseded.has(a.revisionId))return invalid('INVALID_REQUEST');
    const prior=history.find(b=>key(b)===key(r));
    if(prior&&!sameBinding(prior,r))return invalid('CONFLICT');
    const next=prior?history:[...history,r];
    if(!validateCollection(next,data))return invalid('CONFLICT');
    const localArchive=snapshot(archive);
    const resolved=resolveAssessmentBatchLink(localArchive,
      {classId:context.classId,schoolYear:context.schoolYear,subjectCode:context.subjectCode},r.link);
    if(!resolved.valid)return invalid('UNRESOLVED_LINK');
    return {valid:true,status:prior?'unchanged':'added',bindings:next.map(copy)};
  }catch{return invalid('INVALID_REQUEST');}
}
