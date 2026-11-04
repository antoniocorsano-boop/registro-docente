import type { ActiveTab } from '../types';

// History contains only this opaque token. Sensitive selection identifiers remain
// in a per-unlocked-session map owned by App and are discarded on vault lock.
export const SPECIALIST_TARGET_HISTORY_KEY = '__registroSpecialistTargetEntry';

export type SpecialistTarget =
  | { kind: 'evaluation'; batchId: string }
  | { kind: 'student'; studentId: string };

export interface SavedSpecialistTarget {
  classId: string;
  tab: 'voti' | 'report';
  target: SpecialistTarget;
}

export type SpecialistTargetMemory = Map<string, SavedSpecialistTarget>;

function isValidTarget(tab: ActiveTab, target: SpecialistTarget): boolean {
  return (tab === 'voti' && target.kind === 'evaluation' && Boolean(target.batchId))
    || (tab === 'report' && target.kind === 'student' && Boolean(target.studentId));
}

export function rememberSpecialistTarget(
  memory: SpecialistTargetMemory,
  token: string,
  classId: string | null,
  tab: ActiveTab,
  target: SpecialistTarget
): boolean {
  if (!token || !classId || !isValidTarget(tab, target)) return false;
  memory.set(token, { classId, tab: tab as 'voti' | 'report', target: { ...target } });
  return true;
}

export function recallSpecialistTarget(
  memory: SpecialistTargetMemory,
  token: unknown,
  classId: string | null,
  tab: ActiveTab
): SpecialistTarget | null {
  if (typeof token !== 'string' || !classId) return null;
  const saved = memory.get(token);
  if (!saved || saved.classId !== classId || saved.tab !== tab) return null;
  return isValidTarget(tab, saved.target) ? { ...saved.target } : null;
}

export function updateStudentSpecialistTarget(
  memory: SpecialistTargetMemory,
  token: unknown,
  classId: string | null,
  studentId: string
): boolean {
  const current = recallSpecialistTarget(memory, token, classId, 'report');
  if (!current || current.kind !== 'student' || !studentId) return false;
  memory.set(token as string, {
    classId: classId as string,
    tab: 'report',
    target: { kind: 'student', studentId }
  });
  return true;
}
