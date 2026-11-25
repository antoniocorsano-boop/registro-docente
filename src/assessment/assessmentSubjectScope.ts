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
