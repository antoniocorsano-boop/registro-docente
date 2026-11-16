/**
 * VAL-01/D1b.1 — isolated validation of the optional assessment archive.
 * Does not change ClassData, encrypt, persist, normalize, restore or authorize.
 * Historical links are checked structurally, never repaired from current grades.
 */
import { validateAssessmentEvidenceV1 } from './assessmentEvidence';
import type { AssessmentEvidenceV1, AssessmentScopeV1 } from './assessmentEvidence';
import { snapshotAssessmentData, validateAssessmentRevisionBindings } from './assessmentRevisionBindings';
import type { AssessmentRevisionBinding } from './assessmentRevisionBindings';

export interface AssessmentArchiveV1 {
  readonly version: 1;
  readonly documents: readonly {
    readonly document: AssessmentEvidenceV1;
    readonly bindings: readonly AssessmentRevisionBinding[];
  }[];
}
export type ApprovedAssessmentScope = Omit<AssessmentScopeV1,'studentIds'>;
type Issue = 'INVALID_ARCHIVE'|'INVALID_SCOPE'|'INVALID_EVIDENCE'|'INVALID_BINDINGS'|'CONFLICT';
export type AssessmentArchiveValidation =
  | {readonly valid:true;readonly state:'absent'|'present'}
  | {readonly valid:false;readonly issue:Issue};
type Row=Record<string,unknown>;
const fail=(issue:Issue):AssessmentArchiveValidation=>({valid:false,issue});
const own=(x:object,k:string)=>Object.prototype.hasOwnProperty.call(x,k);
const row=(x:unknown):x is Row=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
function exact(x:unknown,keys:readonly string[]):x is Row{
  return row(x)&&Object.keys(x).length===keys.length&&keys.every(k=>own(x,k));
}
function year(x:unknown):x is string{
  return typeof x==='string'&&/^\d{4}\/\d{4}$/.test(x)&&Number(x.slice(5))===Number(x.slice(0,4))+1;
}
function scopeKey(classId:string,schoolYear:string,subjectCode:string):string{
  return JSON.stringify([classId,schoolYear,subjectCode]);
}

/** The approved contexts are independently supplied; their roster is never
 * supplied by the caller but taken from the exact class of the detached archive.
 * The function assumes no institutional authority merely because data is valid.
 */
export function validateAssessmentArchiveV1(
  appData:unknown,approvedScopes:unknown
):AssessmentArchiveValidation{
  let archive:unknown;
  try{archive=snapshotAssessmentData(appData);}catch{return fail('INVALID_ARCHIVE');}
  if(!row(archive)||!Array.isArray(archive.classes))return fail('INVALID_ARCHIVE');
  const classes=new Map<string,{data:Row;studentIds:string[]}>();
  for(const c of archive.classes){
    if(!row(c)||!id(c.id)||classes.has(c.id)||!Array.isArray(c.students))return fail('INVALID_ARCHIVE');
    const roster=new Set<string>();
    for(const student of c.students){
      if(!row(student)||!id(student.id)||roster.has(student.id))return fail('INVALID_ARCHIVE');
      roster.add(student.id);
    }
    classes.set(c.id,{data:c,studentIds:[...roster]});
  }
  let scopes:unknown;
  try{scopes=snapshotAssessmentData(approvedScopes);}catch{return fail('INVALID_SCOPE');}
  if(!Array.isArray(scopes))return fail('INVALID_SCOPE');
  const approved=new Map<string,AssessmentScopeV1>();
  for(const s of scopes){
    if(!exact(s,['classId','schoolYear','subjectCode'])||!id(s.classId)||!year(s.schoolYear)||!id(s.subjectCode))
      return fail('INVALID_SCOPE');
    const cls=classes.get(s.classId),key=scopeKey(s.classId,s.schoolYear,s.subjectCode);
    if(!cls||approved.has(key))return fail('INVALID_SCOPE');
    approved.set(key,{classId:s.classId,schoolYear:s.schoolYear,subjectCode:s.subjectCode,studentIds:cls.studentIds});
  }

  let present=false;
  const seen=new Set<string>(),batchOwner=new Map<string,string>(),gradeOwner=new Map<string,string>();
  for(const [classId,{data}] of classes){
    if(!own(data,'assessmentEvidenceV1'))continue;
    present=true;
    const envelope=data.assessmentEvidenceV1;
    if(!exact(envelope,['version','documents'])||envelope.version!==1||
       !Array.isArray(envelope.documents)||envelope.documents.length===0)return fail('INVALID_ARCHIVE');
    for(const section of envelope.documents){
      if(!exact(section,['document','bindings'])||!row(section.document))return fail('INVALID_EVIDENCE');
      const d=section.document;
      if(d.classId!==classId||!year(d.schoolYear)||!id(d.subjectCode))return fail('INVALID_SCOPE');
      const key=scopeKey(classId,d.schoolYear,d.subjectCode),scope=approved.get(key);
      if(!scope)return fail('INVALID_SCOPE');
      if(seen.has(key))return fail('CONFLICT');
      seen.add(key);
      if(!validateAssessmentEvidenceV1(d,scope).valid)return fail('INVALID_EVIDENCE');
      if(!validateAssessmentRevisionBindings(d,scope,section.bindings))return fail('INVALID_BINDINGS');
      // Within-document ownership is established by the same qualified validator.
      // Here prohibit reusing any historical batch or grade across documents.
      for(const binding of section.bindings as readonly AssessmentRevisionBinding[]){
        const batch=binding.link.proof.batchId;
        if(batchOwner.has(batch)&&batchOwner.get(batch)!==key)return fail('CONFLICT');
        batchOwner.set(batch,key);
        if(binding.kind==='evidence'){
          const grade=binding.link.individual.gradeId;
          if(gradeOwner.has(grade)&&gradeOwner.get(grade)!==key)return fail('CONFLICT');
          gradeOwner.set(grade,key);
        }
      }
    }
  }
  return {valid:true,state:present?'present':'absent'};
}
