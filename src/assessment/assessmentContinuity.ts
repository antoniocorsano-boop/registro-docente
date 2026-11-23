/**
 * F3-CONT-01 — fail-closed, read-only continuity gates for roster/settings changes.
 * These helpers confer no authority, migrate nothing and never inspect student names.
 * Historical evidence remains in the encrypted local archive until a dedicated
 * teacher-reviewed retirement mechanism can preserve both identities and proofs.
 */
import type {AppData,AppSettings,ClassData} from '../types';
import type {PlanningState} from '../planning/types';
import {resolveApprovedAssessmentScopes} from './approvedAssessmentScopes';
import {validateAssessmentArchiveV1} from './assessmentArchive';
import {canonicalAssessmentSchoolYear} from './assessmentSchoolYear';
import {resolveAssessmentSubjectCode} from './assessmentSubjectScope';

export type ContinuityDecision={readonly allowed:true}|
 {readonly allowed:false;readonly reason:'UNKNOWN_STUDENT'|'HISTORICAL_RECORD'|'INVALID_ARCHIVE'|'SCOPE_NOT_APPROVED'};

const permitted:ContinuityDecision={allowed:true};
const blocked=(reason:Exclude<ContinuityDecision,{allowed:true}>['reason']):ContinuityDecision=>
 ({allowed:false,reason});
const owns=(x:object,key:string)=>Object.prototype.hasOwnProperty.call(x,key);

/** Never delete any student-linked record, even if an observation was withdrawn. */
export function checkStudentRemovalContinuity(c:ClassData,studentId:string):ContinuityDecision {
 if(!c||typeof studentId!=='string'||!Array.isArray(c.students)||
    !c.students.some(s=>s?.id===studentId))return blocked('UNKNOWN_STUDENT');
 if(!Array.isArray(c.grades)||!Array.isArray(c.behaviors))return blocked('INVALID_ARCHIVE');
 if(c.grades.some(g=>g?.studentId===studentId)||
    c.behaviors.some(b=>b?.studentId===studentId))return blocked('HISTORICAL_RECORD');
 if(c.councilAssessments!==undefined){
  if(!Array.isArray(c.councilAssessments))return blocked('INVALID_ARCHIVE');
  if(c.councilAssessments.some(a=>a?.studentId===studentId))return blocked('HISTORICAL_RECORD');
 }
 // Confirmed snapshots describe an entire roster, not just a particular pupil.
 if(c.councilEvidenceSnapshots!==undefined){
  if(!Array.isArray(c.councilEvidenceSnapshots))return blocked('INVALID_ARCHIVE');
  if(c.councilEvidenceSnapshots.length>0)return blocked('HISTORICAL_RECORD');
 }
 if(!owns(c,'assessmentEvidenceV1'))return permitted;
 const descriptor=Object.getOwnPropertyDescriptor(c,'assessmentEvidenceV1');
 if(!descriptor||!('value' in descriptor))return blocked('INVALID_ARCHIVE');
 const archive=descriptor.value;
 if(!archive||archive.version!==1||!Array.isArray(archive.documents)||
    archive.documents.length===0)return blocked('INVALID_ARCHIVE');
 for(const section of archive.documents){
  if(!section||!section.document||!Array.isArray(section.document.evidence)||
     !Array.isArray(section.bindings))return blocked('INVALID_ARCHIVE');
  if(section.document.evidence.some((e:{studentId?:unknown})=>e?.studentId===studentId)||
     section.bindings.some((binding:{link?:{individual?:{studentId?:unknown}}})=>
      binding?.link?.individual?.studentId===studentId))
   return blocked('HISTORICAL_RECORD');
 }
 return permitted;
}

/** Unrelated preferences are unaffected. A changed year/subject must
 * independently authorize every existing V1 document, including other classes.
 * Neither the document nor its bound proof can self-authorize a prior scope.
 */
export function checkSettingsAssessmentContinuity(
 app:AppData,planning:PlanningState,current:AppSettings,next:AppSettings
):ContinuityDecision {
 if(current.year===next.year&&current.subject===next.subject)return permitted;
 const oldYear=canonicalAssessmentSchoolYear(current.year);
 const newYear=canonicalAssessmentSchoolYear(next.year);
 const oldSubject=resolveAssessmentSubjectCode(current.subject);
 const newSubject=resolveAssessmentSubjectCode(next.subject);
 if(oldYear!==null&&newYear!==null&&oldYear===newYear&&
    oldSubject!==null&&oldSubject===newSubject)return permitted;
 if(!Array.isArray(app?.classes))return blocked('INVALID_ARCHIVE');
 if(!app.classes.some(c=>c&&owns(c,'assessmentEvidenceV1')))return permitted;
 const approved=resolveApprovedAssessmentScopes(app,planning,next);
 return validateAssessmentArchiveV1(app,approved).valid
  ?permitted:blocked('SCOPE_NOT_APPROVED');
}

export class AssessmentContinuityError extends Error {
 constructor(readonly kind:'student'|'settings') {
  super(kind==='student'
   ?'Rimozione sospesa: sono presenti dati o evidenze da conservare, oppure la classe richiede una verifica. Non eliminare lo studente: mantieni il suo storico nel registro cifrato. È necessaria una procedura dedicata di archiviazione prima della rimozione.'
   :'Modifica non salvata: alcune evidenze storiche perderebbero l’ambito autorizzato. Mantieni le impostazioni precedenti e approva/adotta la programmazione storica pertinente prima di riprovare.');
  this.name='AssessmentContinuityError';
 }
}
