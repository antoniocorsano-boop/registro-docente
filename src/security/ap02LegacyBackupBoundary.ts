/**
 * AUDIT-PRE-01 / AP-02 — Fail-closed boundary for the existing V6 UI.
 * The ordinary user-facing V6 export/restore is not a V7 authority.
 * Keep it available only for archives that cannot contain assessmentEvidenceV1.
 * Do not inspect untrusted getters or infer authorization from incoming labels.
 */
const DOMAIN = 'assessmentEvidenceV1';

export function containsAssessmentEvidenceV7(value: unknown): boolean {
  const visited = new WeakSet<object>();
  const visit = (candidate: unknown): boolean => {
    if (candidate === null || typeof candidate !== 'object') return false;
    if (visited.has(candidate)) return true; // Malformed/cyclic input: refuse.
    visited.add(candidate);
    let descriptors: PropertyDescriptorMap;
    try {
      descriptors = Object.getOwnPropertyDescriptors(candidate);
    } catch {
      return true;
    }
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key === DOMAIN || !Object.hasOwn(descriptor, 'value')) return true;
      if (visit(descriptor.value)) return true;
    }
    return false;
  };
  return visit(value);
}

export function assertV6AssessmentExportAllowed(appData: unknown): void {
  if (containsAssessmentEvidenceV7(appData)) {
    throw new Error('L’archivio contiene evidenze valutative V7: la copia V6 non è completa e non può essere attestata.');
  }
}

export function assertHistoricalAssessmentRestoreAllowed(currentAppData: unknown, payload: unknown): void {
  if (containsAssessmentEvidenceV7(currentAppData)) {
    throw new Error('Il ripristino storico è sospeso: le evidenze valutative correnti richiedono il recupero V7 protetto.');
  }
  if (containsAssessmentEvidenceV7(payload)) {
    throw new Error('La copia contiene evidenze valutative: non può essere ripristinata come V6 o precedente.');
  }
}
