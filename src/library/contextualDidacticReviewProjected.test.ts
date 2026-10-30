import { describe, expect, test } from 'bun:test';
import type { TeachingUdaCandidate } from '../teaching/teachingUdaCatalog';
import type { ResolvedLibraryTeachingContext } from './teachingContext';
import type { LibrarySource } from './types';

async function loadReview() {
  const modulePath = './' + 'contextualDidacticReview';
  return import(modulePath);
}

const projectedUda: TeachingUdaCandidate = {
  id: 'docente-os:uda-energy',
  origin: 'docente-os',
  classId: 'class-3c',
  classLabel: '3C',
  className: '3C',
  title: 'Energia e trasformazioni',
  periodLabel: 'Q1',
  period: 'Q1',
  plannedHours: 12,
  sourceRef: 'docente-os-uda-energy',
  writableByRegistro: false,
  lessons: [],
  focus: 'Fonti rinnovabili, energia eolica e trasformazioni energetiche'
};

const projectedContext: ResolvedLibraryTeachingContext = {
  udaId: projectedUda.id,
  className: projectedUda.className,
  period: projectedUda.period,
  udaOrigin: 'docente-os',
  writableByRegistro: false
};

const professionalSource: LibrarySource = {
  id: 'source-wind',
  kind: 'text',
  title: 'Energia eolica e trasformazioni',
  capturedAt: '2026-10-30T08:00:00.000Z',
  payload: { text: 'Il vento può essere trasformato in energia elettrica mediante una turbina.' },
  extractedText: 'Energia eolica, vento, turbina e trasformazione energetica.',
  status: 'ready',
  privacy: 'teacher-professional',
  links: []
};

describe('A4-R2B projected UDA contextual review', () => {
  test('reviews a projected Docente OS UDA from the unified catalog without cloning it into local UDA records', async () => {
    const { resolveContextualDidacticReview } = await loadReview();
    const result = (resolveContextualDidacticReview as unknown as (input: unknown) => any)({
      source: professionalSource,
      udas: [],
      teachingUdaCatalog: [projectedUda],
      teachingContext: projectedContext,
      planningContext: null
    });

    expect(result.status).toBe('reviewed');
    expect(result.review.context.udaId).toBe(projectedUda.id);
    expect(result.review.relevance.level).not.toBe('weak');
  });
});
