import { describe, expect, test } from 'bun:test';
import type { AppSettings, ClassData } from '../types';
import { buildCouncilEvidenceOverview } from '../council/councilEvidenceOverview';

const settings: AppSettings = {
  school: 'Istituto sintetico', year: '2026/27', teacher: 'Docente',
  subject: 'Tecnologia', theme: 'cyan'
};

function makeClass(): ClassData {
  return {
    id: 'C', name: '2C sintetica',
    students: [
      { id: 'a', name: 'Alunno sintetico A' },
      { id: 'b', name: 'Alunno sintetico B' },
      { id: 'c', name: 'Alunno sintetico C' },
      { id: 'd', name: 'Alunno sintetico D' }
    ],
    grades: [
      { id: 'g1', studentId: 'a', date: '2026-10-10', type: 'test', period: 'Q1', title: 'Prima', value: '8' },
      { id: 'g2', studentId: 'a', date: '2026-11-20', type: 'orale', period: 'Q1', title: 'Dopo limite', value: '6' },
      { id: 'g3', studentId: 'b', date: '2026-10-10', type: 'test', period: 'Q1', title: 'Assente', value: 'NC' },
      { id: 'g4', studentId: 'c', date: '2025-10-10', type: 'test', period: 'Q1', title: 'Altro anno', value: '9' }
    ],
    behaviors: [],
    councilAssessments: [
      { studentId: 'a', schoolYear: '2026/27', moment: 'ingresso', value: '7', updatedAt: '2026-11-09T12:00:00Z' },
      { studentId: 'b', schoolYear: '2026/27', moment: 'ingresso', value: '6', updatedAt: '2026-11-09T12:00:00Z' },
      { studentId: 'c', schoolYear: '2026/27', moment: 'intermedia', value: '8', updatedAt: '2026-11-09T12:00:00Z' }
    ]
  };
}

describe('CDC-02/S2a: read-only council evidence overview', () => {
  test('keeps without-evidence distinct from without-saved-proposal and respects cutoff', () => {
    const klass = makeClass();
    const original = structuredClone(klass);
    const result = buildCouncilEvidenceOverview(klass, '2026/2027', '2026-11-09', settings);
    expect(result).toEqual({
      schoolYear: '2026/2027', requestedCutoff: '2026-11-09',
      effectiveCutoff: '2026-11-09', cutoffClampedToSchoolYear: false,
      totalStudents: 4, withNumericEvidence: 1, withoutNumericEvidence: 3,
      numericEvidenceCount: 1, withSavedTeacherProposal: 2, withoutSavedTeacherProposal: 2
    });
    expect(klass).toEqual(original);
    expect(result!.withNumericEvidence + result!.withoutNumericEvidence).toBe(4);
    expect(result!.withSavedTeacherProposal + result!.withoutSavedTeacherProposal).toBe(4);
  });

  test('year boundary caps future cutoff without borrowing the following year', () => {
    const klass = makeClass();
    klass.grades.push({ id: 'g5', studentId: 'd', date: '2027-09-10', type: 'test', period: 'Q1', title: 'Altro anno', value: '10' });
    const result = buildCouncilEvidenceOverview(klass, '2026/27', '2027-12-01', settings);
    expect(result?.effectiveCutoff).toBe('2027-08-31');
    expect(result?.cutoffClampedToSchoolYear).toBe(true);
    expect(result?.numericEvidenceCount).toBe(2);
  });

  test('intermediate proposals remain separate from incoming proposals', () => {
    const result = buildCouncilEvidenceOverview(makeClass(), '2026/27', '2026-11-09', settings, 'intermedia');
    expect(result?.withSavedTeacherProposal).toBe(1);
  });

  test('fails closed for ambiguous identities, invalid dates and invalid years', () => {
    expect(buildCouncilEvidenceOverview(makeClass(), '2026/27', '2027-02-29', settings)).toBeNull();
    expect(buildCouncilEvidenceOverview(makeClass(), '2026/28', '2026-11-09', settings)).toBeNull();
    const klass = makeClass();
    klass.students.push({ id: 'a', name: 'Duplicato sintetico' });
    expect(buildCouncilEvidenceOverview(klass, '2026/27', '2026-11-09', settings)).toBeNull();
  });

  test('empty class never invents percentages or evidence', () => {
    const klass = makeClass();
    klass.students = [];
    klass.grades = [];
    klass.councilAssessments = [];
    const result = buildCouncilEvidenceOverview(klass, '2026/27', '2026-11-09', settings);
    expect(result?.totalStudents).toBe(0);
    expect(result?.numericEvidenceCount).toBe(0);
    expect(result?.withoutSavedTeacherProposal).toBe(0);
  });
});
