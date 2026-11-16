/**
 * VAL-01/D1a.2a — read-only explicit batch/grade identity resolver.
 * The caller supplies a local, independently verified teaching context.
 * This does not validate curriculum authority, attest an observed fact, persist
 * links, or repair a stale link. Never use it to compute a competence outcome.
 */
import type { EvaluationType } from '../types';
import { normalizeGrade } from '../utils';

export interface AssessmentBatchScope {
  readonly classId: string;
  readonly schoolYear: string;
  readonly subjectCode: string;
}
export interface AssessmentBatchProof {
  readonly batchId: string;
  readonly date: string;
  readonly type: EvaluationType;
  readonly period: 'Q1' | 'Q2';
  readonly title: string;
  readonly udaId?: string;
}
export interface IndividualGradeIdentity {
  readonly studentId: string;
  readonly gradeId: string;
}
export interface AssessmentBatchLink extends AssessmentBatchScope {
  readonly proof: AssessmentBatchProof;
  readonly confirmedByTeacher: true;
  readonly individual?: IndividualGradeIdentity;
}
export type BatchLinkIssue = 'INVALID_CONTEXT' | 'INVALID_SELECTION' | 'INVALID_ARCHIVE' |
  'CLASS_UNAVAILABLE' | 'BATCH_UNAVAILABLE' | 'BATCH_CONFLICT' | 'GRADE_UNAVAILABLE';
export type AssessmentBatchLinkResult =
  | { readonly valid: true; readonly link: AssessmentBatchLink }
  | { readonly valid: false; readonly issue: BatchLinkIssue };

type Row = Record<string, unknown>;
const types: readonly EvaluationType[] = ['test','verifica','orale','disegno','osserv'];
const scopeKeys = ['classId','schoolYear','subjectCode'];

// The accepted input boundary is ordinary local JSON-shaped data, not active
// objects. Inspect own data properties before using any input-controlled value.
function record(x: unknown): x is Row {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false;
  const proto = Object.getPrototypeOf(x);
  return (proto === Object.prototype || proto === null) &&
    Reflect.ownKeys(x).every(k => typeof k === 'string' &&
      Object.prototype.propertyIsEnumerable.call(x,k) &&
      'value' in Object.getOwnPropertyDescriptor(x,k)!);
}
function own(o: Row, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o,k);
}
function read(o: Row, k: string): unknown {
  return Object.getOwnPropertyDescriptor(o,k)?.value;
}
function exact(x: unknown, required: readonly string[], optional: readonly string[] = []): x is Row {
  return record(x) && required.every(k=>own(x,k)) &&
    Object.keys(x).every(k=>required.includes(k)||optional.includes(k)) &&
    optional.every(k=>!own(x,k)||read(x,k)!==undefined);
}
function array(x: unknown): x is unknown[] {
  if (!Array.isArray(x) || Object.getPrototypeOf(x)!==Array.prototype ||
      Reflect.ownKeys(x).length!==x.length+1) return false;
  for(let i=0;i<x.length;i++){
    const d=Object.getOwnPropertyDescriptor(x,String(i));
    if(!d||!('value' in d)||!d.enumerable)return false;
  }
  return true;
}
function id(x: unknown): x is string {
  return typeof x==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
}
function year(x: unknown): x is string {
  return typeof x==='string' && /^\d{4}\/\d{4}$/.test(x) &&
    Number(x.slice(5))===Number(x.slice(0,4))+1;
}
function validScope(x: Row): boolean {
  return id(read(x,'classId')) && year(read(x,'schoolYear')) && id(read(x,'subjectCode'));
}
function dateInYear(x: unknown, schoolYear: string): x is string {
  if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
  const time=Date.parse(x+'T00:00:00.000Z');
  // Italian civil school-year boundary; the term is an explicit metadata
  // field, not inferred from dates or the institution's calendar.
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===x &&
    x>=schoolYear.slice(0,4)+'-09-01' && x<=schoolYear.slice(5)+'-08-31';
}
function batchId(x: unknown): x is string {
  if(!id(x)||x.startsWith('online_'))return false;
  // Same daily namespace and UUID v4 format as dailyMatrixWorkspace.
  return !x.startsWith('daily_') ||
    /^daily_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
}
function validProof(x: unknown, schoolYear: string): x is Row {
  if(!exact(x,['batchId','date','type','period','title'],['udaId']))return false;
  const title=read(x,'title');
  return batchId(read(x,'batchId')) && dateInYear(read(x,'date'),schoolYear) &&
    types.includes(read(x,'type') as EvaluationType) &&
    (read(x,'period')==='Q1'||read(x,'period')==='Q2') &&
    typeof title==='string' && title.trim().length>0 && title.length<=2000 &&
    (!own(x,'udaId')||id(read(x,'udaId')));
}
function validIndividual(x: unknown): x is Row {
  return exact(x,['studentId','gradeId']) && id(read(x,'studentId')) && id(read(x,'gradeId'));
}
const reject=(issue:BatchLinkIssue):AssessmentBatchLinkResult=>({valid:false,issue});
function copyProof(x: Row): AssessmentBatchProof {
  const udaId=read(x,'udaId');
  return {batchId:read(x,'batchId') as string,date:read(x,'date') as string,
    type:read(x,'type') as EvaluationType,period:read(x,'period') as 'Q1'|'Q2',
    title:read(x,'title') as string,...(typeof udaId==='string'?{udaId}:{})};
}

/** Resolve only the explicitly selected identity against the current archive.
 * Return a minimal copy, never the original Grade/Student or a grade value.
 * Failure codes do not include any input values. No writes or side effects.
 */
export function resolveAssessmentBatchLink(
  data: unknown, context: unknown, selection: unknown
): AssessmentBatchLinkResult {
  try {
    if(!exact(context,scopeKeys)||!validScope(context))return reject('INVALID_CONTEXT');
    if(!exact(selection,[...scopeKeys,'proof','confirmedByTeacher'],['individual'])||
        !validScope(selection)||read(selection,'confirmedByTeacher')!==true||
        scopeKeys.some(k=>read(context,k)!==read(selection,k)))return reject('INVALID_SELECTION');
    const schoolYear=read(context,'schoolYear') as string;
    const requestedProof=read(selection,'proof');
    const requestedIndividual=read(selection,'individual');
    if(!validProof(requestedProof,schoolYear)||
        (own(selection,'individual')&&!validIndividual(requestedIndividual)))return reject('INVALID_SELECTION');
    const proof=copyProof(requestedProof);
    const classId=read(context,'classId') as string;
    const subjectCode=read(context,'subjectCode') as string;

    if(!record(data))return reject('INVALID_ARCHIVE');
    const classes=read(data,'classes');
    if(!array(classes))return reject('INVALID_ARCHIVE');
    // Inspect globally, not merely the active class or the selected date.
    const gradeCounts=new Map<string,number>();
    const selectedRows:Row[]=[];
    const classIds=new Set<string>();
    let target:Row|undefined;
    for(const c of classes){
      if(!record(c))return reject('INVALID_ARCHIVE');
      const cid=read(c,'id'), grades=read(c,'grades');
      if(!id(cid)||classIds.has(cid)||!array(grades))return reject('INVALID_ARCHIVE');
      classIds.add(cid);
      if(cid===classId)target=c;
      for(const g of grades){
        if(!record(g))return reject('INVALID_ARCHIVE');
        const gid=read(g,'id'), bid=read(g,'batchId');
        if(!id(gid)||(bid!==undefined&&!id(bid)))return reject('INVALID_ARCHIVE');
        gradeCounts.set(gid,(gradeCounts.get(gid)??0)+1);
        if(bid!==proof.batchId)continue;
        if(cid!==classId)return reject('BATCH_CONFLICT');
        selectedRows.push(g);
      }
    }
    if(!target)return reject('CLASS_UNAVAILABLE');
    if(selectedRows.length===0)return reject('BATCH_UNAVAILABLE');

    const students=read(target,'students');
    if(!array(students))return reject('INVALID_ARCHIVE');
    const roster=new Set<string>();
    for(const s of students){
      if(!record(s))return reject('INVALID_ARCHIVE');
      const sid=read(s,'id');
      if(!id(sid)||roster.has(sid))return reject('INVALID_ARCHIVE');
      roster.add(sid);
    }
    const seenStudents=new Set<string>();
    let individual:IndividualGradeIdentity|undefined;
    for(const g of selectedRows){
      const gid=read(g,'id') as string, sid=read(g,'studentId'), value=read(g,'value');
      const delayed=read(g,'delayed');
      if(!id(sid)||!roster.has(sid)||seenStudents.has(sid)||gradeCounts.get(gid)!==1||
          gid.startsWith('online_grade_')||
          typeof value!=='string'||!normalizeGrade(value)||
          (delayed!==undefined&&typeof delayed!=='boolean')||
          read(g,'date')!==proof.date||read(g,'type')!==proof.type||
          read(g,'period')!==proof.period||read(g,'title')!==proof.title||
          read(g,'udaId')!==proof.udaId)return reject('BATCH_CONFLICT');
      seenStudents.add(sid);
      if(record(requestedIndividual)&&read(requestedIndividual,'studentId')===sid&&
          read(requestedIndividual,'gradeId')===gid)individual={studentId:sid,gradeId:gid};
    }
    if(own(selection,'individual')&&!individual)return reject('GRADE_UNAVAILABLE');
    return {valid:true,link:{classId,schoolYear,subjectCode,proof,confirmedByTeacher:true,
      ...(individual?{individual}:{})}};
  } catch {
    return reject('INVALID_ARCHIVE');
  }
}
