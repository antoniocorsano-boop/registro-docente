import { describe, expect, test } from 'bun:test';
import { resolveCurricularSubjectCode } from '../planning/curricularSubjectCode';
import { getFirstCycleNormativeReference } from '../planning/normative/italianFirstCycle';
import { validateTeachingProfile } from '../planning/validation';
import { resolvePlanningFrame } from '../planning/planningFrameResolver';
import type { PlanningState, TeachingProfile } from '../planning/types';

const year = '2026/27';
const schoolOrder = 'lower_secondary' as const;

function profile(subjectCode: string): TeachingProfile {
  return {
    id: 'technology-2', schoolYear: year, schoolOrder,
    gradeLevel: 2, cohortRef: 'secondaria-2', subjectCode,
    normativeRegime: 'IN2025',
    normativeReference: getFirstCycleNormativeReference({ schoolOrder, schoolYear: year, subjectCode }),
    reservePercent: 15,
    assessmentPeriods: [{
      id: 'term-one', label: 'Unico periodo', startDate: '2026-09-14',
      endDate: '2027-06-08', ordinal: 1
    }],
    calendar: {
      startDate: '2026-09-14', endDate: '2027-06-08',
      closureDates: [], weeklySlots: []
    }
  };
}

const planning = (p: TeachingProfile): PlanningState => ({
  schemaVersion: 2, profiles: [p], arenaContexts: [],
  resources: [], masterPrograms: [], classInstances: [], docenteOsProjections: []
});

describe('INT-01 canonical subject identity with default teacher settings', () => {
  test('maps the exact default display label to the normative curriculum code', () => {
    expect(resolveCurricularSubjectCode('Tecnologia & Disegno Tecnico')).toBe('tecnologia');
    expect(resolveCurricularSubjectCode('  TECNOLOGIA  &  Disegno   Tecnico ')).toBe('tecnologia');
    expect(resolveCurricularSubjectCode('Tecnologia')).toBe('tecnologia');
    expect(resolveCurricularSubjectCode('inglese')).toBe('inglese');
  });

  test('does not guess that unrelated or ambiguous labels are tecnologia', () => {
    for (const unknown of ['Disegno Tecnico', 'Tecnologia & Informatica', 'Scienze e tecnologia']) {
      expect(resolveCurricularSubjectCode(unknown)).not.toBe('tecnologia');
    }
  });

  test('default settings yield the existing national 66-hour technology reference and a savable profile', () => {
    const subjectCode = resolveCurricularSubjectCode('Tecnologia & Disegno Tecnico');
    const candidate = profile(subjectCode);
    expect(candidate.subjectCode).toBe('tecnologia');
    expect(candidate.normativeReference.nationalHoursDefined).toBe(true);
    expect(candidate.normativeReference.nationalWeeklyHours).toBe(2);
    expect(candidate.normativeReference.nationalAnnualHours).toBe(66);
    expect(validateTeachingProfile(candidate)).toEqual([]);
  });

  test('Programmazione resolves a profile created from the default display label', () => {
    const subjectCode = resolveCurricularSubjectCode('Tecnologia & Disegno Tecnico');
    const candidate = profile(subjectCode);
    expect(resolvePlanningFrame({
      className: '2C', planning: planning(candidate),
      schoolYear: '2026/2027', subjectCode
    })).toEqual({
      status: 'resolved', reason: 'RESOLVED',
      className: '2C', profile: candidate, arenaContext: null
    });
  });

  test('App uses one code for frame lookup and editor defaults, without altering the visible setting', async () => {
    const app = await Bun.file('src/App.tsx').text();
    const defaults = await Bun.file('src/utils.ts').text();
    expect(defaults).toContain("subject: 'Tecnologia & Disegno Tecnico'");
    expect(app).toContain('resolveCurricularSubjectCode(settings.subject)');
    expect(app).toContain('subjectCode: curricularSubjectCode');
    expect(app).toContain('defaultSubjectCode={curricularSubjectCode}');
    expect(app).not.toContain('defaultSubjectCode={settings.subject}');
    expect(app).toContain('settings.subject');
  });
});
