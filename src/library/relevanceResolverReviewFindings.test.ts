import { describe, expect, test } from 'bun:test';
import type { LibraryPlanningContextResolution } from './planningContextBridge';
import { resolveLibraryRelevance } from './relevanceResolver';
import type { LibrarySource } from './types';
import type { UdaRecord } from '../types';

const sourceWithoutText: LibrarySource = {
  id: 'source-review',
  kind: 'text',
  title: ' ',
  capturedAt: '2026-10-25T10:00:00.000Z',
  payload: {},
  status: 'ready',
  privacy: 'teacher-professional',
  links: []
};

const sourceWithTitle: LibrarySource = {
  ...sourceWithoutText,
  title: 'Energia'
};

const currentUda: UdaRecord = {
  id: 'uda-current',
  title: 'Energia',
  className: '3C',
  hours: 10,
  period: 'Q1',
  startMonth: 0,
  durationMonths: 4,
  lessons: [{ id: 'lesson-current', date: '2026-10-25', topic: 'Trasformazioni', hours: 1 }]
};

function resolvedPlanningContext(): LibraryPlanningContextResolution {
  return {
    status: 'resolved',
    reason: 'RESOLVED',
    teachingContext: {
      udaId: 'uda-current',
      className: '3C',
      period: 'Q1',
      lessonId: 'lesson-current',
      activityType: 'teoria'
    },
    profile: {
      id: 'profile-tech',
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
      }
    },
    arenaContext: null
  };
}

describe('LIB-03B review findings — planning context binding', () => {
  test('uses the resolved LIB-03A teaching context when no separate context is supplied', () => {
    const result = resolveLibraryRelevance({
      source: sourceWithoutText,
      udas: [currentUda],
      planningContext: resolvedPlanningContext()
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates[0]).toMatchObject({
      targetType: 'lesson',
      targetId: 'lesson-current',
      score: 225,
      signals: ['CURRENT_LESSON', 'CURRENT_UDA', 'CURRENT_CLASS', 'PLANNING_GRADE_MATCH']
    });
  });

  test('does not reuse a planning profile resolved for a different explicit teaching context', () => {
    const result = resolveLibraryRelevance({
      source: sourceWithTitle,
      udas: [{ ...currentUda, id: 'uda-grade-3', className: '3A', lessons: [] }],
      teachingContext: {
        udaId: 'uda-other',
        className: '2A',
        period: 'Q1'
      },
      planningContext: resolvedPlanningContext()
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates[0]?.score).toBe(20);
    expect(result.candidates[0]?.signals).toEqual(['SOURCE_TITLE_MATCH']);
  });

  test('tokenizes source title and content once per full relevance resolution', () => {
    let titleReads = 0;
    let contentReads = 0;
    const payload: LibrarySource['payload'] = {};
    const source: LibrarySource = {
      ...sourceWithTitle,
      payload
    };

    Object.defineProperty(source, 'title', {
      enumerable: true,
      get() {
        titleReads += 1;
        return 'Energia eolica';
      }
    });
    Object.defineProperty(payload, 'text', {
      enumerable: true,
      get() {
        contentReads += 1;
        return 'Energia eolica, vento e turbina.';
      }
    });

    const candidates = Array.from({ length: 6 }, (_, index) => ({
      ...currentUda,
      id: `uda-${index}`,
      title: `Energia ${index}`,
      lessons: Array.from({ length: 5 }, (_, lessonIndex) => ({
        id: `lesson-${index}-${lessonIndex}`,
        date: '2026-10-25',
        topic: `Energia eolica ${lessonIndex}`,
        hours: 1
      }))
    }));

    const result = resolveLibraryRelevance({ source, udas: candidates });

    expect(result.status).toBe('ranked');
    expect(titleReads).toBe(1);
    expect(contentReads).toBe(1);
  });
});
