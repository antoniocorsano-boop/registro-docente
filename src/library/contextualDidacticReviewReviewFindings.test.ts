import { describe, expect, test } from 'bun:test';
import type { UdaRecord } from '../types';
import type { LibraryPlanningContextResolution } from './planningContextBridge';
import type { ResolvedLibraryTeachingContext } from './teachingContext';
import type { LibrarySource } from './types';
import { resolveContextualDidacticReview } from './contextualDidacticReview';

const teachingContext: ResolvedLibraryTeachingContext = {
  udaId: 'uda-energy',
  className: '3C',
  period: 'Q1',
  lessonId: 'lesson-wind',
  activityType: 'teoria'
};

const source: LibrarySource = {
  id: 'source-wind',
  kind: 'text',
  title: 'Energia eolica e turbina',
  capturedAt: '2026-10-27T07:00:00.000Z',
  payload: { text: 'Il vento aziona una turbina che produce energia elettrica.' },
  extractedText: 'Il vento aziona una turbina per produrre energia elettrica.',
  status: 'ready',
  privacy: 'teacher-professional',
  links: []
};

const uda: UdaRecord = {
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
  }]
};

const planningProfile = {
  id: 'profile-tech-3',
  schoolYear: '2026-2027',
  schoolOrder: 'lower_secondary',
  gradeLevel: 3,
  cohortRef: '2026-2027:secondaria:classe-iii',
  subjectCode: 'tecnologia',
  normativeRegime: 'IN2025'
};

const resolvedWithoutArena = {
  status: 'resolved',
  reason: 'RESOLVED',
  teachingContext,
  profile: planningProfile,
  arenaContext: null
} as unknown as LibraryPlanningContextResolution;

const resolvedWithUnrelatedArena = {
  status: 'resolved',
  reason: 'RESOLVED',
  teachingContext,
  profile: planningProfile,
  arenaContext: {
    id: 'arena-tech-3',
    authorityState: 'APPROVED',
    vigencyStatus: 'VIGENTE',
    privacyClass: 'PROFESSIONAL_NON_PERSONAL',
    curricoloItems: [{
      id: 'curr-drawing',
      kind: 'obiettivo',
      sourceSection: 'Disegno tecnico',
      text: 'Proiezioni ortogonali e rappresentazione grafica.'
    }]
  }
} as unknown as LibraryPlanningContextResolution;

describe('AIC-03 review findings — alignment evidence', () => {
  test('resolved planning without positive curriculum evidence remains unverified', () => {
    const result = resolveContextualDidacticReview({
      source,
      udas: [uda],
      teachingContext,
      planningContext: resolvedWithoutArena
    });

    expect(result.status).toBe('reviewed');
    if (result.status !== 'reviewed') return;

    expect(result.review.alignment.planningMatches).toEqual([]);
    expect(result.review.alignment.status).toBe('unverified');
  });

  test('authoritative Arena without a source match still remains unverified', () => {
    const result = resolveContextualDidacticReview({
      source,
      udas: [uda],
      teachingContext,
      planningContext: resolvedWithUnrelatedArena
    });

    expect(result.status).toBe('reviewed');
    if (result.status !== 'reviewed') return;

    expect(result.review.alignment.planningMatches).toEqual([]);
    expect(result.review.alignment.status).toBe('unverified');
  });
});
