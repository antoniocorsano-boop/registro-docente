/** VAL-01/S7b — explicit allowlist for the local recipient preview.
 * Only call with the reviewed result of prepare/confirmFormativeBalance.
 * Not a PDF/export format or a guarantee that teacher-authored text is safe
 * to disclose. No raw fact, method, support, product reference, notes,
 * rubric internals, roster, internal identifiers or digest in the projection.
 */
import type {FormativeBalancePreview} from './formativeBalance';

export interface RestitutionSource {
 readonly date:string;
 readonly activity:string;
 readonly criterion:string;
 readonly objectives:readonly string[];
 readonly state:'observed'|'not_observed'|'not_applicable';
}
export interface FormativeRestitutionPreview {
 readonly period:'Q1'|'Q2';
 readonly from:string;
 readonly to:string;
 readonly sources:readonly RestitutionSource[];
 readonly teacherText:{readonly learning:string;readonly progress:string;readonly nextStep:string};
}
export function projectFormativeRestitution(review:FormativeBalancePreview):FormativeRestitutionPreview{
 return {
  period:review.context.period,from:review.context.from,to:review.context.to,
  sources:review.sources.map(s=>({
   date:s.evidence.observedOn,activity:s.assessment.title,criterion:s.criterion.description,
   objectives:s.targets.map(t=>t.text),state:s.evidence.state
  })),
  teacherText:{learning:review.request.teacherText.learning,progress:review.request.teacherText.progress,nextStep:review.request.teacherText.nextStep}
 };
}
