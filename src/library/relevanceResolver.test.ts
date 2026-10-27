import { describe, expect, test } from 'bun:test';
import type { LibrarySource } from './types';
import type { UdaRecord } from '../types';
import type { LibraryPlanningContextResolution } from './planningContextBridge';
import type { ResolvedLibraryTeachingContext } from './teachingContext';

async function loadResolver() {
  const moduleUrl = new URL('./relevanceResolver.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  const modulePath = './' + 'relevanceResolver';
  return import(modulePath);
}

function source(overrides: Partial<LibrarySource> = {}): LibrarySource {
  return {
    id: 'source-1',
    kind: 'text',
    title: 'Energia eolica',
    capturedAt: '2026-10-25T09:00:00.000Z',
    payload: { text: 'Il vento muove una turbina e genera energia elettrica.' },
    status: 'ready',
    privacy: 'teacher-professional',
    links: [],
    ...overrides
  };
}

function uda(overrides: Partial<UdaRecord> = {}): UdaRecord {
  return {
    id: 'uda-energia',
    title: 'Energia e trasformazioni',
    className: '3C',
    hours: 12,
    period: 'Q1',
    startMonth: 0,
    durationMonths: 4,
    description: 'Fonti rinnovabili, trasformazioni energetiche e produzione elettrica.',
    lessons: [],
    ...overrides
  };
}

const teachingContext: ResolvedLibraryTeachingContext = {
  udaId: 'uda-current',
  className: '3C',
  period: 'Q1',
  lessonId: 'lesson-current',
  activityType: 'teoria'
};

function resolvedPlanningContext(gradeLevel = 3): LibraryPlanningContextResolution {
  return {
    status: 'resolved',
    reason: 'RESOLVED',
    teachingContext,
    profile: {
      id: 'profile-tech',
      schoolYear: '2026/27',
      schoolOrder: 'lower_secondary',
      gradeLevel,
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
      }
    },
    arenaContext: null
  };
}

describe('LIB-03B relevance resolver — deterministic lexical core', () => {
  test('ranks the lexically relevant UDA before unrelated candidates', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const candidates = [
      uda({ id: 'uda-materiali', title: 'Materiali', description: 'Proprietà dei materiali.' }),
      uda({ id: 'uda-energia', title: 'Energia e trasformazioni' })
    ];

    const result = resolveLibraryRelevance({ source: source(), udas: candidates });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates[0]?.targetType).toBe('uda');
    expect(result.candidates[0]?.targetId).toBe('uda-energia');
    expect(result.candidates[0]?.signals).toContain('SOURCE_TITLE_MATCH');
    expect(result.candidates[0]?.matchedTerms).toContain('energia');
  });

  test('adds a title-match signal to a lesson whose topic matches the source title', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const result = resolveLibraryRelevance({
      source: source({ title: 'Turbina eolica' }),
      udas: [uda({
        lessons: [{ id: 'lesson-turbina', date: '2026-10-25', topic: 'La turbina eolica', hours: 1 }]
      })]
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    const lesson = result.candidates.find((candidate: { targetId: string }) => candidate.targetId === 'lesson-turbina');
    expect(lesson?.targetType).toBe('lesson');
    expect(lesson?.signals).toContain('SOURCE_TITLE_MATCH');
    expect(lesson?.matchedTerms).toEqual(expect.arrayContaining(['turbina', 'eolica']));
  });

  test('counts lexical terms as sets so repeated source words do not inflate the score', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const once = resolveLibraryRelevance({
      source: source({ title: 'Energia', payload: { text: '' } }),
      udas: [uda({ title: 'Energia' })]
    });
    const repeated = resolveLibraryRelevance({
      source: source({ title: 'Energia energia energia', payload: { text: '' } }),
      udas: [uda({ title: 'Energia' })]
    });

    expect(once.status).toBe('ranked');
    expect(repeated.status).toBe('ranked');
    if (once.status !== 'ranked' || repeated.status !== 'ranked') return;
    expect(repeated.candidates[0]?.score).toBe(once.candidates[0]?.score);
  });

  test('fails closed when neither local source text nor teaching context is available', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const result = resolveLibraryRelevance({
      source: source({ title: '   ', payload: {}, extractedText: undefined, notes: undefined }),
      udas: [uda()]
    });

    expect(result).toEqual({
      status: 'unavailable',
      reason: 'SOURCE_AND_CONTEXT_UNAVAILABLE',
      candidates: []
    });
  });

  test('uses deterministic tie-breaks independent of input order', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const tiedUda = uda({ id: 'b-uda', title: 'Energia' });
    const tiedUdaA = uda({ id: 'a-uda', title: 'Energia' });
    const parent = uda({
      id: 'z-parent',
      title: 'Altro',
      lessons: [{ id: 'a-lesson', date: '2026-10-25', topic: 'Energia', hours: 1 }]
    });

    const first = resolveLibraryRelevance({
      source: source({ title: 'Energia', payload: { text: '' } }),
      udas: [tiedUda, parent, tiedUdaA]
    });
    const second = resolveLibraryRelevance({
      source: source({ title: 'Energia', payload: { text: '' } }),
      udas: [parent, tiedUdaA, tiedUda]
    });

    expect(first.status).toBe('ranked');
    expect(second.status).toBe('ranked');
    if (first.status !== 'ranked' || second.status !== 'ranked') return;
    expect(first.candidates.map((candidate: { targetType: string; targetId: string }) => `${candidate.targetType}:${candidate.targetId}`))
      .toEqual(second.candidates.map((candidate: { targetType: string; targetId: string }) => `${candidate.targetType}:${candidate.targetId}`));
    expect(first.candidates.slice(0, 2).map((candidate: { targetId: string }) => candidate.targetId)).toEqual(['a-uda', 'b-uda']);
  });
});

describe('LIB-03B relevance resolver — teaching and planning context', () => {
  test('ranks the current lesson and UDA from context even when the source has no local text', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const current = uda({
      id: 'uda-current',
      title: 'Energia',
      className: '3C',
      lessons: [{ id: 'lesson-current', date: '2026-10-25', topic: 'Trasformazioni', hours: 1 }]
    });
    const result = resolveLibraryRelevance({
      source: source({ title: ' ', payload: {}, extractedText: undefined, notes: undefined }),
      udas: [current],
      teachingContext
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates[0]).toMatchObject({
      targetType: 'lesson',
      targetId: 'lesson-current',
      score: 210,
      signals: ['CURRENT_LESSON', 'CURRENT_UDA', 'CURRENT_CLASS']
    });
    expect(result.candidates[1]).toMatchObject({
      targetType: 'uda',
      targetId: 'uda-current',
      score: 110,
      signals: ['CURRENT_UDA', 'CURRENT_CLASS']
    });
  });

  test('adds current-class relevance without conflating a different section', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const result = resolveLibraryRelevance({
      source: source({ title: ' ', payload: {} }),
      udas: [
        uda({ id: 'uda-current', className: '3C' }),
        uda({ id: 'uda-same-class', className: '3C' }),
        uda({ id: 'uda-other-section', className: '3A' })
      ],
      teachingContext: { ...teachingContext, lessonId: undefined, activityType: undefined }
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    const sameClass = result.candidates.find((candidate: { targetId: string }) => candidate.targetId === 'uda-same-class');
    const otherSection = result.candidates.find((candidate: { targetId: string }) => candidate.targetId === 'uda-other-section');
    expect(sameClass?.score).toBe(30);
    expect(sameClass?.signals).toEqual(['CURRENT_CLASS']);
    expect(otherSection).toBeUndefined();
  });

  test('uses a resolved planning profile only as a grade-level boost', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const result = resolveLibraryRelevance({
      source: source({ title: 'Energia', payload: { text: '' } }),
      udas: [
        uda({ id: 'uda-grade-2', className: '2A', title: 'Energia' }),
        uda({ id: 'uda-grade-3', className: '3A', title: 'Energia' })
      ],
      planningContext: resolvedPlanningContext(3)
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    const grade3 = result.candidates.find((candidate: { targetId: string }) => candidate.targetId === 'uda-grade-3');
    const grade2 = result.candidates.find((candidate: { targetId: string }) => candidate.targetId === 'uda-grade-2');
    expect(grade3?.score).toBe((grade2?.score ?? 0) + 15);
    expect(grade3?.signals).toContain('PLANNING_GRADE_MATCH');
    expect(grade2?.signals).not.toContain('PLANNING_GRADE_MATCH');
  });

  test('does not invent a planning boost when the planning context is ambiguous', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const result = resolveLibraryRelevance({
      source: source({ title: 'Energia', payload: { text: '' } }),
      udas: [uda({ id: 'uda-grade-3', className: '3A', title: 'Energia' })],
      planningContext: { status: 'ambiguous', reason: 'PLANNING_PROFILE_AMBIGUOUS' }
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates[0]?.score).toBe(20);
    expect(result.candidates[0]?.signals).not.toContain('PLANNING_GRADE_MATCH');
  });

  test('excludes exact UDA and lesson destinations already linked by the source', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const result = resolveLibraryRelevance({
      source: source({
        title: 'Energia',
        payload: { text: '' },
        links: [
          { targetType: 'uda', targetId: 'uda-linked' },
          { targetType: 'lesson', targetId: 'lesson-linked' }
        ]
      }),
      udas: [
        uda({ id: 'uda-linked', title: 'Energia' }),
        uda({
          id: 'uda-open',
          title: 'Energia',
          lessons: [{ id: 'lesson-linked', date: '2026-10-25', topic: 'Energia', hours: 1 }]
        })
      ]
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates.some((candidate: { targetType: string; targetId: string }) => candidate.targetType === 'uda' && candidate.targetId === 'uda-linked')).toBe(false);
    expect(result.candidates.some((candidate: { targetType: string; targetId: string }) => candidate.targetType === 'lesson' && candidate.targetId === 'lesson-linked')).toBe(false);
    expect(result.candidates.some((candidate: { targetId: string }) => candidate.targetId === 'uda-open')).toBe(true);
  });

  test('legacy activity links neither suppress nor generate UDA or lesson candidates', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const result = resolveLibraryRelevance({
      source: source({
        title: 'Energia',
        payload: { text: '' },
        links: [{ targetType: 'activity', targetId: 'uda-energy' }]
      }),
      udas: [uda({ id: 'uda-energy', title: 'Energia' })]
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.targetType).toBe('uda');
    expect(result.candidates[0]?.targetId).toBe('uda-energy');
  });

  test('ranks restricted student-personal sources locally without authorizing remote processing', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const result = resolveLibraryRelevance({
      source: source({
        title: 'Energia',
        payload: { text: '' },
        status: 'restricted',
        privacy: 'student-personal'
      }),
      udas: [uda({ id: 'uda-energy', title: 'Energia' })]
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates[0]?.targetId).toBe('uda-energy');
  });
});

describe('AIC-03 direct current-target relevance evidence', () => {
  test('evaluates an already-linked current lesson without treating the link as ineligibility', async () => {
    const { resolveLibraryRelevanceTarget } = await loadResolver();
    const current = uda({
      id: 'uda-current',
      title: 'Energia e trasformazioni',
      className: '3C',
      lessons: [{
        id: 'lesson-current',
        date: '2026-10-25',
        topic: 'Energia eolica e turbina',
        hours: 1
      }]
    });

    const candidate = resolveLibraryRelevanceTarget({
      source: source({
        title: 'Energia eolica',
        links: [{ targetType: 'lesson', targetId: 'lesson-current' }]
      }),
      udas: [current],
      teachingContext,
      targetType: 'lesson',
      targetId: 'lesson-current'
    });

    expect(candidate).not.toBeNull();
    expect(candidate?.signals).toEqual(expect.arrayContaining([
      'CURRENT_LESSON',
      'CURRENT_UDA',
      'CURRENT_CLASS',
      'SOURCE_TITLE_MATCH'
    ]));
    expect(candidate?.matchedTerms).toEqual(expect.arrayContaining(['energia', 'eolica']));
  });

  test('evaluates an already-linked current UDA directly', async () => {
    const { resolveLibraryRelevanceTarget } = await loadResolver();
    const currentContext = { ...teachingContext, lessonId: undefined, activityType: undefined };
    const current = uda({ id: 'uda-current', className: '3C', title: 'Energia eolica' });

    const candidate = resolveLibraryRelevanceTarget({
      source: source({
        title: 'Energia eolica',
        links: [{ targetType: 'uda', targetId: 'uda-current' }]
      }),
      udas: [current],
      teachingContext: currentContext,
      targetType: 'uda',
      targetId: 'uda-current'
    });

    expect(candidate).toMatchObject({
      targetType: 'uda',
      targetId: 'uda-current',
      udaId: 'uda-current'
    });
    expect(candidate?.signals).toEqual(expect.arrayContaining(['CURRENT_UDA', 'CURRENT_CLASS', 'SOURCE_TITLE_MATCH']));
  });

  test('returns null for an unknown direct target', async () => {
    const { resolveLibraryRelevanceTarget } = await loadResolver();
    expect(resolveLibraryRelevanceTarget({
      source: source(),
      udas: [uda()],
      teachingContext,
      targetType: 'lesson',
      targetId: 'lesson-missing'
    })).toBeNull();
  });

  test('keeps ordinary suggestions excluding already-linked destinations', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const result = resolveLibraryRelevance({
      source: source({
        title: 'Energia',
        payload: { text: '' },
        links: [
          { targetType: 'uda', targetId: 'uda-current' },
          { targetType: 'lesson', targetId: 'lesson-current' }
        ]
      }),
      udas: [uda({
        id: 'uda-current',
        title: 'Energia',
        lessons: [{ id: 'lesson-current', date: '2026-10-25', topic: 'Energia', hours: 1 }]
      })],
      teachingContext
    });

    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('NO_RELEVANT_CANDIDATE');
  });
});