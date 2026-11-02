import { describe, expect, test } from 'bun:test';
import { resolveProfessionalContext } from '../context/professionalContext';

describe('CTX-01 professional context resolver', () => {
  test('resolves the current class without inventing a teaching target', () => {
    const result = resolveProfessionalContext({
      surface: 'class-dashboard',
      currentClass: { id: '2c', name: '2C' }
    });

    expect(result).toEqual({
      status: 'resolved',
      context: {
        schema: 'registro.professional-context/v1',
        surface: 'class-dashboard',
        classId: '2c',
        className: '2C',
        time: { kind: 'unspecified' },
        privacyScope: 'TEACHER_PROFESSIONAL'
      }
    });
  });

  test('resolves UDA and lesson from an already validated teaching context', () => {
    const result = resolveProfessionalContext({
      surface: 'lesson',
      currentClass: { id: '2c', name: '2C' },
      teachingContext: {
        udaId: 'uda-agricoltura',
        className: '2C',
        period: 'Q1',
        lessonId: 'lesson-1',
        activityType: 'theory'
      }
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.context.classId).toBe('2c');
    expect(result.context.className).toBe('2C');
    expect(result.context.udaId).toBe('uda-agricoltura');
    expect(result.context.lessonId).toBe('lesson-1');
  });

  test('adds only resolved planning identifiers', () => {
    const result = resolveProfessionalContext({
      surface: 'planning',
      planningContext: {
        status: 'resolved',
        reason: 'RESOLVED',
        teachingContext: {
          udaId: 'uda-energia',
          className: '3C',
          period: 'Q1'
        },
        profile: {
          id: 'profile-3',
          schoolYear: '2026-2027',
          schoolOrder: 'secondary',
          subjectCode: 'TEC',
          gradeLevel: 3,
          cohortRef: 'cohort-3',
          normativeRegime: 'IN2025'
        },
        arenaContext: {
          id: 'arena-3',
          profileId: 'profile-3',
          schoolYear: '2026-2027',
          schoolOrder: 'secondaria',
          subjectCode: 'TEC',
          gradeLevel: 3,
          cohortRef: 'cohort-3',
          regimeRef: 'IN2025',
          privacyClass: 'PROFESSIONAL_NON_PERSONAL',
          authorityState: 'APPROVED',
          vigencyStatus: 'VIGENTE'
        }
      } as any
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.context.planningProfileId).toBe('profile-3');
    expect(result.context.arenaContextId).toBe('arena-3');
  });

  test('trims explicit routing fields and applies safe defaults', () => {
    const result = resolveProfessionalContext({
      surface: 'library',
      sourceId: ' source-1 ',
      assessmentId: ' assessment-1 ',
      goal: ' Preparare una attività ',
      time: null,
      privacyScope: undefined
    });

    expect(result).toEqual({
      status: 'resolved',
      context: {
        schema: 'registro.professional-context/v1',
        surface: 'library',
        sourceId: 'source-1',
        assessmentId: 'assessment-1',
        goal: 'Preparare una attività',
        time: { kind: 'unspecified' },
        privacyScope: 'TEACHER_PROFESSIONAL'
      }
    });
  });

  test('omits blank routing fields', () => {
    const result = resolveProfessionalContext({
      surface: 'library',
      sourceId: '   ',
      assessmentId: '',
      goal: '\n'
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.context).not.toHaveProperty('sourceId');
    expect(result.context).not.toHaveProperty('assessmentId');
    expect(result.context).not.toHaveProperty('goal');
  });

  test('fails closed when current class and teaching context disagree', () => {
    const result = resolveProfessionalContext({
      surface: 'uda',
      currentClass: { id: '2c', name: '2C' },
      teachingContext: {
        udaId: 'uda-3c',
        className: '3C',
        period: 'Q1'
      }
    });

    expect(result).toEqual({
      status: 'conflict',
      conflicts: ['CLASS_MISMATCH']
    });
  });

  test('fails closed on an ambiguous planning context', () => {
    const result = resolveProfessionalContext({
      surface: 'planning',
      planningContext: {
        status: 'ambiguous',
        reason: 'PLANNING_PROFILE_AMBIGUOUS'
      }
    });

    expect(result).toEqual({
      status: 'conflict',
      conflicts: ['PLANNING_CONTEXT_AMBIGUOUS']
    });
  });

  test('carries an explicit student-sensitive scope without student payload fields', () => {
    const result = resolveProfessionalContext({
      surface: 'evaluations',
      currentClass: { id: '2c', name: '2C' },
      privacyScope: 'STUDENT_PERSONAL_PRESENT'
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.context.privacyScope).toBe('STUDENT_PERSONAL_PRESENT');
    expect(Object.keys(result.context)).not.toContain('studentId');
    expect(Object.keys(result.context)).not.toContain('students');
    expect(Object.keys(result.context)).not.toContain('grades');
    expect(Object.keys(result.context)).not.toContain('behaviors');
  });
});