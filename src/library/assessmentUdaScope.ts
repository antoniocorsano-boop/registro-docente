import type { UdaRecord } from '../types';

// The register uses full class names (e.g. "3ª A - Secondaria I Grado"),
// while historical UDA records may use the short form ("3ª A").
// Compare the whole class code, never a startsWith prefix ("3ª A" != "3ª AA").
export function normalizeAssessmentClassName(value: string): string | null {
  const leading = value.trim().split(/\s+[-–—]\s+/, 1)[0];
  const canonical = leading.replace(/[ªº°]/g, '').replace(/\s+/g, '').toLocaleLowerCase('it');
  return canonical.length > 0 ? canonical : null;
}

export function isAssessmentUdaForClass(
  uda: Pick<UdaRecord, 'className'>, className: string
): boolean {
  const context = normalizeAssessmentClassName(className);
  const candidate = normalizeAssessmentClassName(uda.className);
  return context !== null && candidate !== null && context === candidate;
}

export function isAssessmentUdaSelectionAllowed(
  udaId: string | undefined,
  udas: Pick<UdaRecord, 'id' | 'className'>[],
  className: string
): boolean {
  if (!udaId) return true; // No implicit association, by design.
  return udas.some(uda => uda.id === udaId && isAssessmentUdaForClass(uda, className));
}
