import { describe, expect, test } from 'bun:test';
import type { PlanningStateV1, TeachingProfile } from '../planning/types';
import type { UdaRecord } from '../types';
import type { LibraryRelevanceCandidate } from './relevanceResolver';
import type { ResolvedLibraryTeachingContext } from './teachingContext';

async function loadPresentation() {
  const moduleUrl = new URL('./relevancePresentation.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  const modulePath = './' + 'relevancePresentation';
  return import(modulePath);
}

function profile(overrides: Partial<TeachingProfile> = {}): TeachingProfile {
  return {
    id: 'profile-tech-3',
    schoolYear: '2026/27',
    schoolOrder: 'lower_secondary',
    gradeLevel: 3,
    cohortRef: '2026-2027:secondaria:classe-iii',
    subjectCode: 'tecnologia',
    normativeRegime: 'Regime 2025',
    normativeReference: {
      id: 'norm-tech',
      sourceRef: 'DPR_89_2009_ART5_TABLE_3',
      version: 'DPR-89-2009',
      nationalHoursDefined: true,
      nationalWeeklyHours: 2,
      nationalAnnualHours: 66,
      allocationScope: 'discipline'
    },
    reservePercent: 15,
    assessmentPeriods: [],
    calendar: {
      startDate: '2026-09-14',
      endDate: '2027-06-08',
      closureDates: [],
      weeklySlots: []
    },
    ...overrides
  };
}

function planning(profiles: TeachingProfile[]): PlanningStateV1 {
  return {
    schemaVersion: 1,
    profiles,
    arenaContexts: [],
    resources: [],
    masterPrograms: [],
    classInstances: []
  };
}

const teachingContext: ResolvedLibraryTeachingContext = {
  udaId: 'uda-energia',
  className: '3C',
  period: 'Q1'
};

function uda(overrides: Partial<UdaRecord> = {}): UdaRecord {
  return {
    id: 'uda-energia',
    title: 'Energia e trasformazioni',
    className: '3C',
    hours: 12,
    period: 'Q1',
    startMonth: 0,
    durationMonths: 4,
    lessons: [{ id: 'lesson-eolica', date: '2026-10-25', topic: 'Energia eolica', hours: 1 }],
    ...overrides
  };
}

function candidate(overrides: Partial<LibraryRelevanceCandidate> = {}): LibraryRelevanceCandidate {
  return {
    targetType: 'uda',
    targetId: 'uda-energia',
    udaId: 'uda-energia',
    score: 125,
    signals: ['CURRENT_UDA', 'CURRENT_CLASS', 'PLANNING_GRADE_MATCH', 'SOURCE_TITLE_MATCH'],
    matchedTerms: ['energia'],
    ...overrides
  };
}

describe('LIB-03C relevance presentation — planning identity', () => {
  test('resolves planning context only when grade-compatible profiles converge on one year and subject identity', async () => {
    const { resolvePlanningContextForLibraryRelevance } = await loadPresentation();
    const result = resolvePlanningContextForLibraryRelevance(
      teachingContext,
      planning([profile({ schoolYear: '2026/27', subjectCode: ' Tecnologia ' })])
    );

    expect(result?.status).toBe('resolved');
    if (result?.status !== 'resolved') return;
    expect(result.profile.id).toBe('profile-tech-3');
    expect(result.teachingContext).toEqual(teachingContext);
  });

  test('fails closed when same-grade profiles expose different annual identities', async () => {
    const { resolvePlanningContextForLibraryRelevance } = await loadPresentation();
    const result = resolvePlanningContextForLibraryRelevance(
      teachingContext,
      planning([
        profile({ id: 'tech', subjectCode: 'tecnologia' }),
        profile({ id: 'science', subjectCode: 'scienze' })
      ])
    );

    expect(result).toBeNull();
  });

  test('does not invent planning identity without a valid teaching grade', async () => {
    const { resolvePlanningContextForLibraryRelevance } = await loadPresentation();

    expect(resolvePlanningContextForLibraryRelevance(null, planning([profile()]))).toBeNull();
    expect(resolvePlanningContextForLibraryRelevance(
      { ...teachingContext, className: 'classe terza C' },
      planning([profile()])
    )).toBeNull();
  });

  test('delegates duplicate profiles on the same identity to LIB-03A ambiguity', async () => {
    const { resolvePlanningContextForLibraryRelevance } = await loadPresentation();
    const result = resolvePlanningContextForLibraryRelevance(
      teachingContext,
      planning([
        profile({ id: 'profile-a', cohortRef: 'cohort-a' }),
        profile({ id: 'profile-b', cohortRef: 'cohort-b' })
      ])
    );

    expect(result).toEqual({ status: 'ambiguous', reason: 'PLANNING_PROFILE_AMBIGUOUS' });
  });
});

describe('LIB-03C relevance presentation — candidate copy', () => {
  test('describes a UDA only from real target data and resolver signals', async () => {
    const { describeLibraryRelevanceCandidate } = await loadPresentation();
    const result = describeLibraryRelevanceCandidate(candidate(), [uda()]);

    expect(result).toEqual({
      targetType: 'uda',
      targetId: 'uda-energia',
      udaId: 'uda-energia',
      title: 'Energia e trasformazioni',
      subtitle: 'UDA · 3C',
      reasons: ['UDA corrente', 'Stessa classe', 'Coerente con il livello della programmazione', 'Parole in comune: energia'],
      matchedTerms: ['energia']
    });
  });

  test('describes a lesson with parent UDA and does not expose the numeric score', async () => {
    const { describeLibraryRelevanceCandidate } = await loadPresentation();
    const result = describeLibraryRelevanceCandidate(candidate({
      targetType: 'lesson',
      targetId: 'lesson-eolica',
      signals: ['CURRENT_LESSON', 'SOURCE_CONTENT_MATCH'],
      matchedTerms: ['eolica', 'energia']
    }), [uda()]);

    expect(result).toEqual({
      targetType: 'lesson',
      targetId: 'lesson-eolica',
      udaId: 'uda-energia',
      title: 'Energia eolica',
      subtitle: 'Lezione · Energia e trasformazioni · 3C',
      reasons: ['Lezione corrente', 'Parole in comune: eolica, energia'],
      matchedTerms: ['eolica', 'energia']
    });
    expect(result).not.toHaveProperty('score');
  });

  test('returns null when the ranked target no longer exists', async () => {
    const { describeLibraryRelevanceCandidate } = await loadPresentation();

    expect(describeLibraryRelevanceCandidate(candidate({ targetId: 'missing' }), [uda()])).toBeNull();
    expect(describeLibraryRelevanceCandidate(candidate({
      targetType: 'lesson',
      targetId: 'missing-lesson'
    }), [uda()])).toBeNull();
  });
});
