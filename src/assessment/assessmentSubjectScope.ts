import {resolveCurricularSubjectCode} from '../planning/curricularSubjectCode';

const code = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const historicalTechnologyLabel = 'Tecnologia';
const technologyCode = resolveCurricularSubjectCode(historicalTechnologyLabel);

/** Resolve the known professional label without changing opaque legacy codes. */
export function resolveAssessmentSubjectCode(display: string | undefined): string | null {
  if (typeof display !== 'string' || !display.trim()) return null;
  const value = display.trim();
  const curricular = resolveCurricularSubjectCode(value);
  if (value === historicalTechnologyLabel || !code(value)) return code(curricular) ? curricular : null;
  return value;
}

/** The old assessment resolver persisted this exact display label as a code. */
export function approvedAssessmentSubjectCodes(subjectCode: string): readonly string[] {
  if (subjectCode === technologyCode || subjectCode === historicalTechnologyLabel) {
    return [technologyCode, historicalTechnologyLabel];
  }
  return [subjectCode];
}

/** Equivalence is restricted to the explicitly recognized historical alias.
 * Opaque identifiers (including TECH) remain case-sensitive and distinct.
 * This predicate selects a context; it does not grant archive authority.
 */
export function sameAssessmentSubject(a:string,b:string):boolean {
  return approvedAssessmentSubjectCodes(a).includes(b);
}

type DocumentScope={readonly classId:string;readonly schoolYear:string;readonly subjectCode:string};
/** Use only after exact independent archive validation. A second equivalent
 * document is ambiguous, never a reason to merge, rewrite or choose one.
 */
export function selectUniqueAssessmentDocument<T extends DocumentScope>(
 documents:readonly T[],scope:DocumentScope
):T|undefined {
 const matching=documents.filter(d=>d.classId===scope.classId&&
  d.schoolYear===scope.schoolYear&&sameAssessmentSubject(d.subjectCode,scope.subjectCode));
 if(matching.length>1)throw Error('Ambiguous assessment document');
 return matching[0];
}
