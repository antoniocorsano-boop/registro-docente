import { describe, expect, test } from 'bun:test';
import type { ClassData, OnlineSubmission, OnlineTest, UdaRecord } from '../types';
import {
  reconcileSubmissionGrades,
  type SubmissionImportSelection
} from '../persistence/submissionGradeImport';

function classes(): ClassData[] {
  return [
    {
      id: 'class-a', name: '2ª A - Secondaria I Grado',
      students: [{ id: 'student-a', name: 'Rossi Mario' }],
      grades: [], behaviors: []
    },
    {
      id: 'class-c', name: '2ª C - Secondaria I Grado',
      students: [{ id: 'student-c', name: 'Rossi Mario' }],
      grades: [], behaviors: []
    }
  ];
}

function tests(): Record<string, OnlineTest> {
  return {
    'test-a': { id: 'test-a', title: 'Agricoltura', questions: [], udaId: 'uda-a' },
    'test-c': { id: 'test-c', title: 'Energia', questions: [], udaId: 'uda-c' },
    'test-none': { id: 'test-none', title: 'Test libero', questions: [] }
  };
}

function udas(): UdaRecord[] {
  const base = { hours: 4, period: 'Q1' as const, startMonth: 1, durationMonths: 1 };
  return [
    { ...base, id: 'uda-a', className: '2ª A - Secondaria I Grado', title: 'Agricoltura' },
    { ...base, id: 'uda-c', className: '2ª C - Secondaria I Grado', title: 'Energia' }
  ];
}

function submission(
  id: string,
  overrides: Partial<OnlineSubmission> = {}
): OnlineSubmission {
  return {
    id, class: '2ª A - Secondaria I Grado', name: 'Rossi Mario',
    testId: 'test-a', testTitle: 'Agricoltura',
    score: 8, total: 10, date: '2026-11-08T10:00:00.000Z',
    ...overrides
  };
}

const selection = (overrides: Partial<SubmissionImportSelection> = {}): SubmissionImportSelection => ({
  classId: 'class-a', testId: 'test-a', period: 'Q1', ...overrides
});

const reconcile = (
  classRows = classes(), submissions = [submission('sub-a')],
  selected = selection(), testCatalog = tests(), udaCatalog = udas()
) => reconcileSubmissionGrades(classRows, submissions, {
  selection: selected, tests: testCatalog, udas: udaCatalog
});

describe('INT-02/IMPORT-01 — safe grade reconciliation', () => {
  test('only explicitly selected class and test are imported, with their own UDA', () => {
    const result = reconcile(classes(), [
      submission('a1'),
      submission('c1', {
        class: '2ª C - Secondaria I Grado',
        testId: 'test-c', testTitle: 'Energia', name: 'Rossi Mario'
      })
    ]);
    expect(result.importedCount).toBe(1);
    expect(result.importedCountByClassId).toEqual({ 'class-a': 1 });
    expect(result.classes[0].grades[0].udaId).toBe('uda-a');
    expect(result.classes[1].grades).toHaveLength(0);
  });

  test('no testId is ever substituted for udaId when a source has no UDA', () => {
    const result = reconcile(classes(), [
      submission('free', { testId: 'test-none', testTitle: 'Test libero' })
    ], selection({ testId: 'test-none' }));
    expect(result.importedCount).toBe(1);
    expect(result.classes[0].grades[0].udaId).toBeUndefined();
  });

  test('stale or foreign UDA prevents grade creation without losing the submission', () => {
    const catalog = tests();
    catalog['test-a'] = { ...catalog['test-a'], udaId: 'uda-c' };
    const result = reconcile(classes(), [submission('foreign')], selection(), catalog);
    expect(result.importedCount).toBe(0);
    expect(result.preview.blockedCount).toBe(1);
    expect(result.preview.blockedByReason.UDA_INVALID).toBe(1);
    expect(result.classes[0].grades).toHaveLength(0);
  });

  test('partial names, duplicated names and ambiguous classes fail closed', () => {
    const partial = reconcile(classes(), [submission('partial', { name: 'Mario' })]);
    expect(partial.importedCount).toBe(0);

    const repeated = classes();
    repeated[0].students.push({ id: 'other', name: '  ROSSI   MARIO  ' });
    const ambiguousStudent = reconcile(repeated, [submission('same-name')]);
    expect(ambiguousStudent.preview.blockedByReason.STUDENT_AMBIGUOUS).toBe(1);

    const sameClass = classes();
    sameClass.push({ ...classes()[0], id: 'class-duplicate' });
    const ambiguousClass = reconcile(sameClass, [submission('class-ambiguous')]);
    expect(ambiguousClass.preview.blockedByReason.CLASS_AMBIGUOUS).toBe(1);
  });

  test('duplicate canonical class IDs block every grade without modifying either class', () => {
    const rows = classes();
    rows[1] = { ...rows[1], id: rows[0].id };
    const result = reconcile(rows, [submission('duplicate-canonical-class')]);
    expect(result.importedCount).toBe(0);
    expect(result.preview.blockedByReason.CLASS_AMBIGUOUS).toBe(1);
    expect(result.classes).toEqual(rows);
  });

  test('duplicate canonical student IDs block even when names differ', () => {
    const rows = classes();
    rows[0].students.push({ id: 'student-a', name: 'Bianchi Lucia' });
    const result = reconcile(rows, [submission('duplicate-canonical-student')]);
    expect(result.importedCount).toBe(0);
    expect(result.preview.blockedByReason.STUDENT_AMBIGUOUS).toBe(1);
    expect(result.classes[0].grades).toHaveLength(0);
  });

  test('a duplicated UDA identifier cannot authorize imports across classes', () => {
    const catalog = udas();
    catalog.push({ ...catalog[1], id: 'uda-a' });
    const result = reconcile(classes(), [submission('duplicate-uda')], selection(), tests(), catalog);
    expect(result.importedCount).toBe(0);
    expect(result.preview.blockedByReason.UDA_INVALID).toBe(1);
  });

  test('changed test title or question count rejects stale submission metadata', () => {
    const renamed = tests();
    renamed['test-a'] = { ...renamed['test-a'], title: 'Agricoltura modificata' };
    const result = reconcile(classes(), [submission('old-title')], selection(), renamed);
    expect(result.importedCount).toBe(0);
    expect(result.preview.blockedByReason.TEST_METADATA_MISMATCH).toBe(1);

    const withQuestion = tests();
    withQuestion['test-a'] = {
      ...withQuestion['test-a'],
      questions: [{ q: 'Domanda sintetica', options: ['A', 'B'], correct: 0 }]
    };
    const staleCount = reconcile(classes(), [submission('old-question-count')], selection(), withQuestion);
    expect(staleCount.importedCount).toBe(0);
    expect(staleCount.preview.blockedByReason.TEST_METADATA_MISMATCH).toBe(1);
  });

  test('reimport never silently replaces a teacher-edited grade', () => {
    const first = reconcile();
    const original = first.classes[0].grades[0];
    expect(original.batchId).toBe('online_sub-a');
    const edited = classes();
    edited[0].grades = [{ ...original, value: '7', title: 'Corretto dal docente' }];
    const second = reconcile(edited);
    expect(second.importedCount).toBe(0);
    expect(second.preview.blockedByReason.GRADE_CONFLICT).toBe(1);
    expect(second.classes[0].grades[0]).toEqual(edited[0].grades[0]);
  });

  test('reimport of an unchanged grade is idempotent, never a write', () => {
    const first = reconcile();
    const second = reconcile(first.classes);
    expect(second.importedCount).toBe(0);
    expect(second.preview.unchangedCount).toBe(1);
    expect(second.classes).toEqual(first.classes);
  });

  test('period is explicit and invalid scores, duplicate submission ids are blocked', () => {
    const q2 = reconcile(classes(), [submission('period')], selection({ period: 'Q2' }));
    expect(q2.classes[0].grades[0].period).toBe('Q2');

    const invalid = reconcile(classes(), [submission('bad-score', { score: 11 })]);
    expect(invalid.preview.blockedByReason.INVALID_SCORE).toBe(1);

    const duplicate = reconcile(classes(), [submission('repeat'), submission('repeat')]);
    expect(duplicate.importedCount).toBe(0);
    expect(duplicate.preview.blockedByReason.DUPLICATE_SUBMISSION).toBe(2);
  });

  test('a preview signature changes when grades, submissions or UDA context changes', () => {
    const initial = reconcile();
    expect(initial.preview.creatableCount).toBe(1);
    expect(initial.preview.signature.length).toBeGreaterThan(0);
    expect(initial.preview.signature).not.toBe(
      reconcile(classes(), [submission('sub-a', { score: 9 })]).preview.signature
    );
    const changed = classes();
    changed[0].grades.push({
      id: 'manual', batchId: 'manual', studentId: 'student-a',
      date: '2026-11-08', type: 'orale', period: 'Q1', title: 'Interrogazione', value: '8'
    });
    expect(initial.preview.signature).not.toBe(reconcile(changed).preview.signature);
  });
});
