import type { ClassData } from '../types';

/**
 * Ephemeral context for one student-report detour. This object never enters
 * history.state, the URL, Secure Local Vault, or any professional record.
 * It contains IDs and view preferences, never student names or grades.
 */
interface ReturnBase {
  classId: string;
  studentId: string;
  scrollY: number;
}

export type StudentReportReturnContext =
  | (ReturnBase & {
      originTab: 'tabellone';
      ui: {
        periodFilter: 'ALL' | 'Q1' | 'Q2';
        viewMode: 'cron' | 'type' | 'avg';
        showProposedGrade: boolean;
        expandedStudentId: string | null;
      };
    })
  | (ReturnBase & {
      originTab: 'analytics';
      ui: {
        periodFilter: 'ALL' | 'Q1' | 'Q2';
        useWeighted: boolean;
        studentSearch: string;
        studentSort: 'register' | 'name' | 'average';
        studentDetailOpen: boolean;
        expandedAnalyticsStudentId?: string | null;
      };
    });

type StudentClass = Pick<ClassData, 'id' | 'students'>;

export function resolveStudentReportReturnContext(
  context: StudentReportReturnContext | null,
  classId: string | null,
  tab: string,
  classes: readonly StudentClass[]
): StudentReportReturnContext | null {
  if (!context || !classId || context.classId !== classId || context.originTab !== tab) {
    return null;
  }
  const selectedClass = classes.find(c => c.id === classId);
  if (!selectedClass?.students?.some(s => s.id === context.studentId)) return null;

  if (context.originTab === 'tabellone' && context.ui.expandedStudentId
    && !selectedClass.students.some(s => s.id === context.ui.expandedStudentId)) {
    return null;
  }
  if (context.originTab === 'analytics' && context.ui.expandedAnalyticsStudentId
    && !selectedClass.students.some(s => s.id === context.ui.expandedAnalyticsStudentId)) {
    return null;
  }
  return context;
}

/** A viewport offset is optional UX context, not a security authority. */
export function captureReturnScrollY(): number {
  return typeof window === 'undefined'
    ? 0
    : Math.max(0, Math.round(window.scrollY));
}
