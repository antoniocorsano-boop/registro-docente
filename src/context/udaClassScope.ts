import type { UdaRecord } from '../types';

/**
 * Guard the entire persisted UDA snapshot against cross-class changes.
 *
 * This is deliberately independent of the Gantt's editable filter state:
 * a class-first mission may create, edit, or remove its own UDA, but must
 * preserve every other class exactly, including dependencies and lessons.
 * Without an active class, existing cross-class specialist workflows remain
 * unchanged.
 */
export function classScopedUdaMutationAllowed(
  previous: readonly UdaRecord[],
  next: readonly UdaRecord[],
  currentClassName: string | null | undefined
): boolean {
  if (currentClassName == null) return true;
  const activeClass = currentClassName.trim();
  if (!activeClass) return false;

  const previousById = new Map(previous.map(uda => [uda.id, uda]));
  const nextById = new Map(next.map(uda => [uda.id, uda]));
  if (previousById.size !== previous.length || nextById.size !== next.length) return false;

  for (const uda of previous) {
    if (!uda.id || !uda.className) return false;
    if (uda.className !== activeClass) {
      const unchanged = nextById.get(uda.id);
      if (!unchanged || JSON.stringify(unchanged) !== JSON.stringify(uda)) return false;
    }
  }
  for (const uda of next) {
    if (!uda.id || !uda.className) return false;
    if (uda.className !== activeClass) {
      const unchanged = previousById.get(uda.id);
      if (!unchanged || JSON.stringify(unchanged) !== JSON.stringify(uda)) return false;
    }
  }
  return true;
}
