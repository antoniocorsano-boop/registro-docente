/** VAL-01/S6c.1 — isolated exact-revision board projection; no writes or inference. */
import {validateAssessmentEvidenceV1} from './assessmentEvidence';
import type {AssessmentEvidenceV1,AssessmentScopeV1,IndividualEvidenceRevision} from './assessmentEvidence';
import {snapshotAssessmentData} from './assessmentRevisionBindings';

type ActiveEvidence=Exclude<IndividualEvidenceRevision,{state:'withdrawn'}>;
export interface EvidenceBoardRow {
  readonly studentId:string;
  readonly entries:readonly ActiveEvidence[];
}
export type EvidenceBoardResult=
 | {readonly valid:false;readonly issue:'INVALID_DOCUMENT'|'INVALID_SELECTION'}
 | {readonly valid:true;readonly rows:readonly EvidenceBoardRow[]};

/** Keep distinct events and exact frozen links. Empty entries mean no active
 * record for the selected pair, never an explicit not_observed decision.
 * Withdrawn evidence is excluded; historical source revisions remain intact. */
export function projectEvidenceBoard(document:unknown,scope:unknown,assessmentRevisionId:unknown,criterionRevisionId:unknown):EvidenceBoardResult {
  try {
    const d=snapshotAssessmentData(document),s=snapshotAssessmentData(scope);
    if(!validateAssessmentEvidenceV1(d,s).valid)return {valid:false,issue:'INVALID_DOCUMENT'};
    const data=d as AssessmentEvidenceV1,context=s as AssessmentScopeV1;
    const a=data.assessments.find(x=>x.revisionId===assessmentRevisionId);
    if(!a||a.status!=='completed'||data.assessments.some(x=>x.supersedesRevisionId===a.revisionId)||
      !a.criteria.some(c=>c.criterionRevisionId===criterionRevisionId))return {valid:false,issue:'INVALID_SELECTION'};
    const superseded=new Set(data.evidence.flatMap(e=>e.supersedesRevisionId?[e.supersedesRevisionId]:[]));
    const byStudent=new Map<string,ActiveEvidence[]>();
    for(const e of data.evidence){
      if(e.assessmentRevisionId!==assessmentRevisionId||e.criterionRevisionId!==criterionRevisionId||
        superseded.has(e.revisionId)||e.state==='withdrawn')continue;
      const entries=byStudent.get(e.studentId)||[];entries.push(e);byStudent.set(e.studentId,entries);
    }
    return {valid:true,rows:context.studentIds.map(studentId=>({studentId,entries:(byStudent.get(studentId)||[])
      .sort((a,b)=>a.observedOn.localeCompare(b.observedOn)||a.revisionId.localeCompare(b.revisionId))}))};
  }catch{return {valid:false,issue:'INVALID_DOCUMENT'};}
}
