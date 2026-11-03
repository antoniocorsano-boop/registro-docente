import type { UdaRecord } from '../types';
import { resolveCanonicalRegistroClass } from '../teaching/classIdentity';

export type ScopeClass = Readonly<{ id: string; name: string }>;

/** Class ownership is determined by an unambiguous canonical Registro identity,
 * not by comparing the shortened UDA label to the displayed class label.
 */
export function udaBelongsToActiveClass(
  udaClassName: string,
  currentClassName: string,
  classes: readonly ScopeClass[] = []
): boolean {
  const source = udaClassName.trim();
  const active = currentClassName.trim();
  if (!source || !active) return false;
  if (classes.length === 0) return source === active;

  const configured = classes.map(item => ({ id: item.id, name: item.name }));
  const sourceResolution = resolveCanonicalRegistroClass(source, configured);
  const activeResolution = resolveCanonicalRegistroClass(active, configured);
  if (sourceResolution.status === 'ambiguous' || activeResolution.status === 'ambiguous') return false;
  if (sourceResolution.status === 'resolved' && activeResolution.status === 'resolved') {
    return sourceResolution.classId === activeResolution.classId;
  }
  // Non-standard labels may match only one exact configured class.
  return source === active
    && configured.filter(item => item.name.trim() === active).length === 1;
}

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
  currentClassName: string | null | undefined,
  classes: readonly ScopeClass[] = []
): boolean {
  if (currentClassName == null) return true;
  const activeClass = currentClassName.trim();
  if (!activeClass) return false;

  const previousById = new Map(previous.map(uda => [uda.id, uda]));
  const nextById = new Map(next.map(uda => [uda.id, uda]));
  if (previousById.size !== previous.length || nextById.size !== next.length) return false;

  for (const uda of previous) {
    if (!uda.id || !uda.className) return false;
    if (!udaBelongsToActiveClass(uda.className, activeClass, classes)) {
      const unchanged = nextById.get(uda.id);
      if (!unchanged || JSON.stringify(unchanged) !== JSON.stringify(uda)) return false;
    }
  }
  for (const uda of next) {
    if (!uda.id || !uda.className) return false;
    if (!udaBelongsToActiveClass(uda.className, activeClass, classes)) {
      const unchanged = previousById.get(uda.id);
      if (!unchanged || JSON.stringify(unchanged) !== JSON.stringify(uda)) return false;
    }
  }
  return true;
}
