/**
 * NAV-MOBILE-BACK-01: non-identifying browser-history entry for a Tabellone
 * row's expanded/collapsed UI. The student remains only in React memory.
 * Never write names, grades, student IDs or report-return snapshots here.
 */
export interface MobileMatrixDisclosureState {
  classId: string;
  tab: 'tabellone';
  matrixDisclosure: true;
}

export function createMobileMatrixDisclosureState(
  state: unknown,
  currentClassId: string
): MobileMatrixDisclosureState | null {
  if (!state || typeof state !== 'object') return null;
  const route = state as Record<string, unknown>;
  if (route.classId !== currentClassId || route.tab !== 'tabellone') return null;
  return { classId: currentClassId, tab: 'tabellone', matrixDisclosure: true };
}

export function isMobileMatrixDisclosureState(
  state: unknown,
  currentClassId: string
): state is MobileMatrixDisclosureState {
  if (!state || typeof state !== 'object') return false;
  const route = state as Record<string, unknown>;
  return route.classId === currentClassId
    && route.tab === 'tabellone'
    && route.matrixDisclosure === true;
}
