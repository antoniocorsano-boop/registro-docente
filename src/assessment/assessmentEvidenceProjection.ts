/**
 * VAL-01/D1a.2b.1 — minimal local projection, not a competence assessment.
 * No runtime integration or authority to disclose these references externally.
 */
import { validateAssessmentEvidenceV1 } from './assessmentEvidence';
import type { AssessmentEvidenceV1, AssessmentScopeV1, IndividualEvidenceRevision } from './assessmentEvidence';

type ActiveState = Exclude<IndividualEvidenceRevision['state'], 'withdrawn'>;
export interface IndividualEvidenceEntry {
  readonly evidenceRevisionId: string;
  readonly assessmentRevisionId: string;
  readonly criterionRevisionId: string;
  readonly targetReferenceRevisionIds: readonly string[];
  readonly state: ActiveState;
}
export type IndividualEvidenceProjection =
  | { readonly valid: true; readonly entries: readonly IndividualEvidenceEntry[];
      readonly counts: { readonly observed: number; readonly notObserved: number; readonly notApplicable: number };
      readonly coverage: 'undetermined' }
  | { readonly valid: false; readonly issue: 'INVALID_DOCUMENT' | 'INVALID_STUDENT' };

const invalid = (issue: 'INVALID_DOCUMENT' | 'INVALID_STUDENT'): IndividualEvidenceProjection => ({valid:false,issue});

/**
 * Materialize ordinary JSON-shaped own data before validating and projecting.
 * Never invoke a getter, input collection method, or toJSON. The same detached
 * graph is used for both operations, so a caller cannot swap values between them.
 * Shared references in a synthetic fixture are allowed; cycles are not.
 */
function snapshot(value: unknown, ancestors = new Set<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
      typeof value === 'number' || typeof value === 'undefined') return value;
  if (typeof value !== 'object' || ancestors.has(value)) throw new Error('INVALID_DOCUMENT');
  ancestors.add(value);
  try {
    const proto = Object.getPrototypeOf(value);
    const keys = Reflect.ownKeys(value);
    if (Array.isArray(value)) {
      if (proto !== Array.prototype) throw new Error('INVALID_DOCUMENT');
      const length = Object.getOwnPropertyDescriptor(value,'length')?.value;
      if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) throw new Error('INVALID_DOCUMENT');
      const result: unknown[] = [];
      for (let i=0; i<length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value,String(i));
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('INVALID_DOCUMENT');
        result.push(snapshot(descriptor.value,ancestors));
      }
      return result;
    }
    if (proto !== Object.prototype && proto !== null) throw new Error('INVALID_DOCUMENT');
    const result: Record<string,unknown> = Object.create(null);
    for (const key of keys) {
      if (typeof key !== 'string') throw new Error('INVALID_DOCUMENT');
      const descriptor = Object.getOwnPropertyDescriptor(value,key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('INVALID_DOCUMENT');
      result[key] = snapshot(descriptor.value,ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}
const compare = (a:string,b:string):number => a < b ? -1 : a > b ? 1 : 0;

/** Explicitly select one student; retain frozen references and count one active
 * evidence per validated identity, not one per target. Historical revisions
 * stay in the source. No opportunity denominator or pedagogical inference.
 */
export function projectIndividualAssessmentEvidence(
  document: unknown, scope: unknown, studentId: unknown
): IndividualEvidenceProjection {
  try {
    const localDocument = snapshot(document);
    const localScope = snapshot(scope);
    if (!validateAssessmentEvidenceV1(localDocument,localScope).valid) return invalid('INVALID_DOCUMENT');
    const data = localDocument as AssessmentEvidenceV1;
    const context = localScope as AssessmentScopeV1;
    if (typeof studentId !== 'string' || !context.studentIds.includes(studentId)) return invalid('INVALID_STUDENT');

    const superseded = new Set(data.evidence.flatMap(e => e.supersedesRevisionId ? [e.supersedesRevisionId] : []));
    const active = data.evidence.filter(e => e.studentId === studentId &&
      !superseded.has(e.revisionId) && e.state !== 'withdrawn')
      .sort((a,b) => compare(a.observedOn,b.observedOn) || compare(a.revisionId,b.revisionId));
    const criteria = new Map(data.criteria.map(c => [c.revisionId,c]));
    const counts = {observed:0,notObserved:0,notApplicable:0};
    const entries: IndividualEvidenceEntry[] = [];
    for (const e of active) {
      const criterion = criteria.get(e.criterionRevisionId);
      if (!criterion || e.state === 'withdrawn') return invalid('INVALID_DOCUMENT');
      if (e.state === 'observed') counts.observed++;
      else if (e.state === 'not_observed') counts.notObserved++;
      else counts.notApplicable++;
      entries.push({evidenceRevisionId:e.revisionId,assessmentRevisionId:e.assessmentRevisionId,
        criterionRevisionId:e.criterionRevisionId,targetReferenceRevisionIds:[...criterion.targetReferenceRevisionIds],
        state:e.state});
    }
    return {valid:true,entries,counts,coverage:'undetermined'};
  } catch {
    return invalid('INVALID_DOCUMENT');
  }
}
