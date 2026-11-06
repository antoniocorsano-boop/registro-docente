import type { ClassData } from '../types';

type StudentClass = Pick<ClassData, 'id' | 'students'>;

/**
 * History state belongs to the currently unlocked browser session.
 * The student identifier is deliberately kept OUT of the address bar.
 */
export interface StudentReportHistoryState {
  classId: string;
  tab: 'report';
  studentId: string;
}

export function createStudentReportHistoryState(
  classId: string,
  studentId: string
): StudentReportHistoryState {
  return { classId, tab: 'report', studentId };
}

/**
 * Browser history is untrusted input: never restore a student from a
 * different class, from a deleted student, or from malformed state.
 */
export function restoreStudentReportFromHistory(
  state: unknown,
  classId: string | null,
  classes: readonly StudentClass[]
): string | null {
  if (!state || typeof state !== 'object' || !classId) return null;
  const candidate = state as Record<string, unknown>;
  if (
    candidate.tab !== 'report'
    || candidate.classId !== classId
    || typeof candidate.studentId !== 'string'
  ) return null;

  const selectedClass = classes.find(c => c.id === classId);
  return selectedClass?.students?.some(student => student.id === candidate.studentId)
    ? candidate.studentId
    : null;
}
