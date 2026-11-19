/** VAL-01/S6c.2 — exact, frozen interpretation options for a selected completed assessment. */
import {validateAssessmentEvidenceV1} from './assessmentEvidence';
import type {AssessmentEvidenceV1,RubricRevision} from './assessmentEvidence';
import {snapshotAssessmentData} from './assessmentRevisionBindings';

type Level=RubricRevision['criteria'][number]['levels'][number];
export type EvidenceInterpretationOptions=
 | {readonly valid:false;readonly issue:'INVALID_DOCUMENT'|'INVALID_SELECTION'}
 | {readonly valid:true;readonly mode:'rubric';readonly rubricRevisionId:string;readonly levels:readonly Level[]}
 | {readonly valid:true;readonly mode:'descriptive'};

/** No automatic level, no lookup of newer catalogue revisions, no inferred grade.
 * Pending is always an explicit caller choice; descriptions are permitted only
 * where the selected binding has no rubric, in agreement with the domain validator. */
export function listEvidenceInterpretationOptions(document:unknown,scope:unknown,assessmentRevisionId:unknown,criterionRevisionId:unknown):EvidenceInterpretationOptions{
 try{
  const d=snapshotAssessmentData(document),s=snapshotAssessmentData(scope);
  if(!validateAssessmentEvidenceV1(d,s).valid)return {valid:false,issue:'INVALID_DOCUMENT'};
  const data=d as AssessmentEvidenceV1;
  const a=data.assessments.find(x=>x.revisionId===assessmentRevisionId);
  const binding=a?.criteria.find(c=>c.criterionRevisionId===criterionRevisionId);
  if(!a||a.status!=='completed'||data.assessments.some(x=>x.supersedesRevisionId===a.revisionId)||!binding)
   return {valid:false,issue:'INVALID_SELECTION'};
  if(!binding.rubricRevisionId)return {valid:true,mode:'descriptive'};
  const rubric=data.rubrics.find(r=>r.revisionId===binding.rubricRevisionId);
  const criterion=rubric?.criteria.find(c=>c.criterionRevisionId===criterionRevisionId);
  if(!rubric||!criterion)return {valid:false,issue:'INVALID_DOCUMENT'};
  return {valid:true,mode:'rubric',rubricRevisionId:rubric.revisionId,levels:criterion.levels};
 }catch{return {valid:false,issue:'INVALID_DOCUMENT'};}
}
