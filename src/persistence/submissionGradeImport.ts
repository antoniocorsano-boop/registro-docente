import type {
  ClassData, Grade, OnlineSubmission, OnlineTest, UdaRecord
} from '../types';
import {
  isAssessmentUdaSelectionAllowed, normalizeAssessmentClassName
} from '../library/assessmentUdaScope';

/**
 * IMPORT-01: teacher chooses each import scope explicitly. Sharing, Padlet
 * previews and the global analysis selector do not authorize grade imports.
 */
export interface SubmissionImportSelection {
  classId: string;
  testId: string;
  period: 'Q1' | 'Q2';
  /** Explicit teacher decision at import, never inferred historical provenance. */
  targetUdaId: string | null;
}

export type SubmissionImportBlockReason =
  | 'CLASS_AMBIGUOUS'
  | 'STUDENT_UNMATCHED'
  | 'STUDENT_AMBIGUOUS'
  | 'MISSING_TEST'
  | 'TEST_METADATA_MISMATCH'
  | 'UDA_INVALID'
  | 'INVALID_SCORE'
  | 'INVALID_DATE'
  | 'DUPLICATE_SUBMISSION'
  | 'GRADE_CONFLICT';

export interface SubmissionImportPreview {
  scopeCount: number;
  creatableCount: number;
  unchangedCount: number;
  blockedCount: number;
  blockedByReason: Partial<Record<SubmissionImportBlockReason, number>>;
  /** Opaque, local-only freshness token; never log or persist it. */
  signature: string;
}

export interface SubmissionImportOptions {
  selection: SubmissionImportSelection;
  tests: Record<string, OnlineTest>;
  udas: readonly UdaRecord[];
}

export interface SubmissionImportResult {
  classes: ClassData[];
  importedCount: number;
  importedCountByClassId: Record<string, number>;
  preview: SubmissionImportPreview;
}

function normalizeStudentName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it');
}

function validSubmissionDate(value: string): boolean {
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function isUnchangedGrade(existing: Grade, next: Grade): boolean {
  // Additional fields (such as a teacher's subsequent edit marker) are
  // meaningful: do not silently replace a previously touched grade.
  const left = existing as unknown as Record<string, unknown>;
  const right = next as unknown as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && left[key] === right[key]);
}

function gradeFromSubmission(
  submission: OnlineSubmission,
  studentId: string,
  verifiedTestTitle: string,
  period: SubmissionImportSelection['period'],
  udaId?: string
): Grade {
  const grade10 = Math.round((submission.score / submission.total) * 100) / 10;
  return {
    id: `online_grade_${submission.id}`,
    batchId: `online_${submission.id}`,
    studentId,
    date: submission.date.slice(0, 10),
    type: 'test',
    period,
    title: `Flashcard: ${verifiedTestTitle}`,
    value: String(grade10),
    ...(udaId ? { udaId } : {})
  };
}

/**
 * Pure and deterministic reconciliation. No partial matching of names, no
 * reassignments, no substitution of testId for UDA id, and no inferred historical
 * UDA provenance from a mutable current test record.
 *
 * Every blocked submission stays in the source submissions collection.
 * Existing grades are never overwritten in this operation.
 */
export function reconcileSubmissionGrades(
  classes: ClassData[],
  submissions: OnlineSubmission[],
  options: SubmissionImportOptions
): SubmissionImportResult {
  const { selection, tests, udas } = options;
  const selectedClass = classes.find(item => item.id === selection.classId);
  if (!selectedClass || !selection.testId || !['Q1', 'Q2'].includes(selection.period)
    || !Object.prototype.hasOwnProperty.call(selection, 'targetUdaId')
    || (selection.targetUdaId !== null
      && (typeof selection.targetUdaId !== 'string' || !selection.targetUdaId.trim()))) {
    throw new Error('Selezionare classe, verifica, periodo e destinazione UDA espliciti.');
  }

  const selectedClassKey = normalizeAssessmentClassName(selectedClass.name);
  if (!selectedClassKey) throw new Error('Classe priva di denominazione valida.');

  // Exact, private preview signature. It binds teacher consent to the
  // precise current snapshot even if a queued persistence task runs later.
  const signature = JSON.stringify({
    classes, submissions, selection, tests, udas
  });
  const preview: SubmissionImportPreview = {
    scopeCount: 0,
    creatableCount: 0,
    unchangedCount: 0,
    blockedCount: 0,
    blockedByReason: {},
    signature
  };

  const scoped = submissions.filter(item =>
    item.testId === selection.testId
    && normalizeAssessmentClassName(item.class) === selectedClassKey
  );
  preview.scopeCount = scoped.length;
  const classMatches = classes.filter(item =>
    normalizeAssessmentClassName(item.name) === selectedClassKey
  );
  const canonicalClassIds = classes.filter(item => item.id === selection.classId);

  const sourceTest = tests[selection.testId];
  const testExists = sourceTest?.id === selection.testId;
  const classNames = classes.map(item => item.name);
  // Submission does not retain an historical UDA. Never infer that UDA from
  // the CURRENT mutable test record. Only a teacher's explicit destination
  // choice may set a grade's optional UDA relation.
  const chosenUdaId = selection.targetUdaId ?? undefined;
  const udaIdentityUnique = !chosenUdaId
    || udas.filter(item => item.id === chosenUdaId).length === 1;
  const udaAllowed = udaIdentityUnique && isAssessmentUdaSelectionAllowed(
    chosenUdaId, udas as UdaRecord[], selectedClass.name, classNames
  );

  const idCounts = new Map<string, number>();
  for (const submission of submissions) {
    idCounts.set(submission.id, (idCounts.get(submission.id) || 0) + 1);
  }

  const additions: Grade[] = [];
  const markBlocked = (reason: SubmissionImportBlockReason): void => {
    preview.blockedCount += 1;
    preview.blockedByReason[reason] = (preview.blockedByReason[reason] || 0) + 1;
  };

  for (const submission of scoped) {
    if (classMatches.length !== 1 || canonicalClassIds.length !== 1) {
      markBlocked('CLASS_AMBIGUOUS');
      continue;
    }
    if (!testExists) {
      markBlocked('MISSING_TEST');
      continue;
    }
    // Test metadata are editable, but the submission records the original
    // title and size. Reject detectable drift rather than silently attributing
    // a historical outcome to the currently edited assessment.
    if (submission.testTitle !== sourceTest.title
      || (sourceTest.questions.length > 0 && submission.total !== sourceTest.questions.length)) {
      markBlocked('TEST_METADATA_MISMATCH');
      continue;
    }
    if (!udaAllowed) {
      markBlocked('UDA_INVALID');
      continue;
    }
    if (!submission.id.trim() || (idCounts.get(submission.id) || 0) !== 1) {
      markBlocked('DUPLICATE_SUBMISSION');
      continue;
    }
    if (!Number.isFinite(submission.score) || !Number.isFinite(submission.total)
      || submission.total <= 0 || submission.score < 0 || submission.score > submission.total) {
      markBlocked('INVALID_SCORE');
      continue;
    }
    if (!validSubmissionDate(submission.date)) {
      markBlocked('INVALID_DATE');
      continue;
    }

    const students = selectedClass.students.filter(item =>
      normalizeStudentName(item.name) === normalizeStudentName(submission.name)
    );
    if (students.length !== 1) {
      markBlocked(students.length === 0 ? 'STUDENT_UNMATCHED' : 'STUDENT_AMBIGUOUS');
      continue;
    }
    // A student name can be unique while its canonical ID is duplicated.
    // Grade writes key by studentId, so that identity must be unique as well.
    if (selectedClass.students.filter(item => item.id === students[0].id).length !== 1) {
      markBlocked('STUDENT_AMBIGUOUS');
      continue;
    }

    const nextGrade = gradeFromSubmission(
      submission, students[0].id, sourceTest.title, selection.period, chosenUdaId
    );
    const existingGrades = classes.flatMap(item =>
      (item.grades || []).filter(grade =>
        grade.batchId === nextGrade.batchId || grade.id === nextGrade.id
      )
    );

    if (existingGrades.length > 0) {
      if (existingGrades.length === 1
        && selectedClass.grades?.includes(existingGrades[0])
        && isUnchangedGrade(existingGrades[0], nextGrade)) {
        preview.unchangedCount += 1;
      } else {
        markBlocked('GRADE_CONFLICT');
      }
      continue;
    }

    additions.push(nextGrade);
    preview.creatableCount += 1;
  }

  if (additions.length === 0) {
    return { classes, importedCount: 0, importedCountByClassId: {}, preview };
  }

  return {
    classes: classes.map(item =>
      item.id === selectedClass.id
        ? { ...item, grades: [...(item.grades || []), ...additions] }
        : item
    ),
    importedCount: additions.length,
    importedCountByClassId: { [selectedClass.id]: additions.length },
    preview
  };
}
