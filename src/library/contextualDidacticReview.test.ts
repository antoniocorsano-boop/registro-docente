import { describe, expect, test } from 'bun:test';
import type { UdaRecord } from '../types';
import type { LibraryPlanningContextResolution } from './planningContextBridge';
import type { ResolvedLibraryTeachingContext } from './teachingContext';
import type { LibrarySource } from './types';

async function loadReview() {
  const moduleUrl = new URL('./contextualDidacticReview.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  const modulePath = './' + 'contextualDidacticReview';
  return import(modulePath);
}

const teachingContext: ResolvedLibraryTeachingContext = {
  udaId: 'uda-energy',
  className: '3C',
  period: 'Q1',
  lessonId: 'lesson-wind',
  activityType: 'teoria'
};

function source(overrides: Partial<LibrarySource> = {}): LibrarySource {
  return {
    id: 'source-wind',
    kind: 'text',
    title: 'Energia eolica e turbina',
    capturedAt: '2026-10-27T07:00:00.000Z',
    payload: { text: 'Il vento aziona una turbina che produce energia elettrica.' },
    extractedText: 'Il vento aziona una turbina per produrre energia elettrica.',
    status: 'ready',
    privacy: 'teacher-professional',
    links: [],
    ...overrides
  };
}

function uda(overrides: Partial<UdaRecord> = {}): UdaRecord {
  return {
    id: 'uda-energy',
    title: 'Energia e trasformazioni',
    className: '3C',
    hours: 12,
    period: 'Q1',
    startMonth: 1,
    durationMonths: 4,
    description: 'Fonti rinnovabili e trasformazioni energetiche.',
    lessons: [{
      id: 'lesson-wind',
      date: '2026-10-27',
      topic: 'Energia eolica e turbina',
      hours: 1,
      notes: 'Trasformazione dell energia del vento in energia elettrica.',
      activityType: 'teoria'
    }],
    ...overrides
  };
}

function resolvedPlanningContext(options: {
  arena?: boolean;
  curriculumText?: string;
} = {}): LibraryPlanningContextResolution {
  const profile = {
    id: 'profile-tech-3',
    schoolYear: '2026-2027',
    schoolOrder: 'lower_secondary' as const,
    gradeLevel: 3,
    cohortRef: '2026-2027:secondaria:classe-iii',
    subjectCode: 'tecnologia',
    normativeRegime: 'IN2025',
    normativeReference: {
      id: 'norm-tech',
      sourceRef: 'DPR_89_2009_ART5_TABLE_3',
      version: 'DPR-89-2009',
      nationalHoursDefined: true,
      nationalWeeklyHours: 2,
      nationalAnnualHours: 66,
      allocationScope: 'discipline' as const
    },
    reservePercent: 15,
    assessmentPeriods: [],
    calendar: {
      startDate: '2026-09-14',
      endDate: '2027-06-08',
      closureDates: [],
      weeklySlots: []
    }
  };

  return {
    status: 'resolved',
    reason: 'RESOLVED',
    teachingContext,
    profile,
    arenaContext: options.arena === false ? null : {
      id: 'arena-tech-3',
      acceptedAt: '2026-09-01T08:00:00.000Z',
      profileId: profile.id,
      contract: 'ARENA_REGISTRO_PLANNING_CONTEXT_V1',
      contractVersion: 1,
      sourceProduct: 'ARENA',
      targetProduct: 'REGISTRO_DOCENTE',
      importMode: 'PREVIEW_ONLY',
      acceptanceRequired: true,
      automaticWriteAllowed: false,
      institutionRef: 'ic-test',
      schoolYear: '2026-2027',
      sourceSchoolYear: '2026-2027',
      schoolOrder: 'secondaria',
      subjectCode: 'tecnologia',
      gradeLevel: 3,
      cohortRef: profile.cohortRef,
      cohortRefKind: 'DERIVED_APPLICABILITY_KEY',
      applicabilityStatus: 'APPLICABLE',
      regimeRef: 'IN2025',
      authorityState: 'APPROVED',
      vigencyStatus: 'VIGENTE',
      authorityReceiptRef: 'receipt-1',
      masterId: 'master-tech',
      masterVersion: '1',
      structuralFingerprint: {
        scope: 'MASTER',
        algorithm: 'sha256',
        version: 1,
        hash: 'abc123'
      },
      provenance: {
        repository: 'arena',
        sourceCommit: 'abc123',
        sourceDocumentId: 'curricolo-tech',
        sourceRevisionId: 'rev-1'
      },
      curricoloItems: [{
        id: 'curr-energy',
        kind: 'obiettivo',
        schoolStage: 'secondaria',
        gradeLabel: '3',
        sourceSection: 'Energia',
        text: options.curriculumText ?? 'Analizzare trasformazioni energetiche e produzione di energia elettrica da fonti rinnovabili come il vento.'
      }],
      privacyClass: 'PROFESSIONAL_NON_PERSONAL'
    }
  };
}

describe('AIC-03 contextual didactic review — evidence semantics', () => {
  test('returns strong supported high-confidence review from lexical and authoritative curriculum evidence', async () => {
    const { resolveContextualDidacticReview } = await loadReview();
    const result = resolveContextualDidacticReview({
      source: source(),
      udas: [uda()],
      teachingContext,
      planningContext: resolvedPlanningContext()
    });

    expect(result.status).toBe('reviewed');
    if (result.status !== 'reviewed') return;
    expect(result.review.schema).toBe('registro.contextual-didactic-review/v2');
    expect(result.review.relevance.level).toBe('strong');
    expect(result.review.alignment.status).toBe('supported');
    expect(result.review.alignment.planningMatches[0]).toMatchObject({
      itemId: 'curr-energy',
      sourceSection: 'Energia'
    });
    expect(result.review.confidence.level).toBe('high');
    expect(result.review.rationale.length).toBeGreaterThan(0);
    expect(result.review.limitations.length).toBeGreaterThan(0);
  });

  test('keeps context-only relevance weak when lexical and curriculum evidence are absent', async () => {
    const { resolveContextualDidacticReview } = await loadReview();
    const result = resolveContextualDidacticReview({
      source: source({
        title: 'Materiali ceramici',
        payload: { text: 'Argille, cottura e proprietà della ceramica.' },
        extractedText: 'Argille e ceramica.'
      }),
      udas: [uda({
        title: 'Energia',
        description: 'Trasformazioni energetiche',
        lessons: [{ id: 'lesson-wind', date: '2026-10-27', topic: 'Centrale elettrica', hours: 1 }]
      })],
      teachingContext,
      planningContext: resolvedPlanningContext({ curriculumText: 'Disegno tecnico e rappresentazione grafica.' })
    });

    expect(result.status).toBe('reviewed');
    if (result.status !== 'reviewed') return;
    expect(result.review.relevance.level).toBe('weak');
  });

  test('uses lexical evidence without fabricating curriculum alignment', async () => {
    const { resolveContextualDidacticReview } = await loadReview();
    const result = resolveContextualDidacticReview({
      source: source(),
      udas: [uda()],
      teachingContext,
      planningContext: resolvedPlanningContext({ curriculumText: 'Disegno tecnico e proiezioni ortogonali.' })
    });

    expect(result.status).toBe('reviewed');
    if (result.status !== 'reviewed') return;
    expect(['plausible', 'strong']).toContain(result.review.relevance.level);
    expect(result.review.alignment.status).not.toBe('supported');
    expect(result.review.alignment.planningMatches).toEqual([]);
  });

  test('keeps review available but alignment unverified for ambiguous planning context', async () => {
    const { resolveContextualDidacticReview } = await loadReview();
    const result = resolveContextualDidacticReview({
      source: source(),
      udas: [uda()],
      teachingContext,
      planningContext: { status: 'ambiguous', reason: 'PLANNING_PROFILE_AMBIGUOUS' }
    });

    expect(result.status).toBe('reviewed');
    if (result.status !== 'reviewed') return;
    expect(result.review.alignment.status).toBe('unverified');
    expect(result.review.gaps.join(' ')).toMatch(/programmazione|allineamento/i);
    expect(result.review.confidence.level).not.toBe('high');
  });

  test('does not claim curriculum support when planning resolves without Arena context', async () => {
    const { resolveContextualDidacticReview } = await loadReview();
    const result = resolveContextualDidacticReview({
      source: source(),
      udas: [uda()],
      teachingContext,
      planningContext: resolvedPlanningContext({ arena: false })
    });

    expect(result.status).toBe('reviewed');
    if (result.status !== 'reviewed') return;
    expect(result.review.alignment.status).not.toBe('supported');
    expect(result.review.alignment.planningMatches).toEqual([]);
  });

  test('reviews an already-linked current target and excludes it from reuse suggestions', async () => {
    const { resolveContextualDidacticReview } = await loadReview();
    const alternative = uda({
      id: 'uda-alt',
      title: 'Fonti rinnovabili',
      lessons: [{ id: 'lesson-alt', date: '2026-11-02', topic: 'Energia eolica', hours: 1 }]
    });
    const result = resolveContextualDidacticReview({
      source: source({ links: [{ targetType: 'lesson', targetId: 'lesson-wind' }] }),
      udas: [uda(), alternative],
      teachingContext,
      planningContext: resolvedPlanningContext()
    });

    expect(result.status).toBe('reviewed');
    if (result.status !== 'reviewed') return;
    expect(result.review.relevance.level).toBe('strong');
    expect(result.review.reuseSuggestions.some((item: { targetId: string }) => item.targetId === 'lesson-wind')).toBe(false);
    expect(result.review.reuseSuggestions.length).toBeLessThanOrEqual(3);
  });

  test('title-only professional source remains reviewable but cannot reach high confidence', async () => {
    const { resolveContextualDidacticReview } = await loadReview();
    const result = resolveContextualDidacticReview({
      source: source({ payload: {}, extractedText: undefined, notes: undefined }),
      udas: [uda()],
      teachingContext,
      planningContext: resolvedPlanningContext()
    });

    expect(result.status).toBe('reviewed');
    if (result.status !== 'reviewed') return;
    expect(result.review.gaps.join(' ')).toMatch(/contenuto|testo/i);
    expect(result.review.confidence.level).not.toBe('high');
  });

  test('rejects unknown and student-personal privacy before detailed review', async () => {
    const { resolveContextualDidacticReview } = await loadReview();
    for (const privacy of ['unknown', 'student-personal'] as const) {
      expect(resolveContextualDidacticReview({
        source: source({ privacy }),
        udas: [uda()],
        teachingContext,
        planningContext: resolvedPlanningContext()
      })).toMatchObject({ status: 'unavailable', reason: 'SOURCE_NOT_PROFESSIONAL' });
    }
  });

  test('rejects restricted and failed sources before detailed review', async () => {
    const { resolveContextualDidacticReview } = await loadReview();
    for (const status of ['restricted', 'failed'] as const) {
      expect(resolveContextualDidacticReview({
        source: source({ status }),
        udas: [uda()],
        teachingContext,
        planningContext: resolvedPlanningContext()
      })).toMatchObject({ status: 'unavailable', reason: 'SOURCE_NOT_USABLE' });
    }
  });

  test('fails closed without Teaching Context', async () => {
    const { resolveContextualDidacticReview } = await loadReview();
    expect(resolveContextualDidacticReview({
      source: source(),
      udas: [uda()],
      teachingContext: null,
      planningContext: null
    })).toMatchObject({ status: 'unavailable', reason: 'TEACHING_CONTEXT_MISSING' });
  });
});