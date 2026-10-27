import { describe, expect, test } from 'bun:test';
import type { UdaRecord } from '../types';
import type { ResolvedLibraryTeachingContext } from './teachingContext';
import type { TeachingProposalContent, TeachingProposalV1 } from './teachingProposal';
import { buildTeachingProposalUdaAdoption } from './teachingProposalOutcome';

const content: TeachingProposalContent = {
  title: 'Come funziona una centrale elettrica',
  objective: 'Comprendere la catena delle trasformazioni energetiche.',
  teacherSetup: 'Predisporre uno schema della centrale.',
  studentTask: 'Ricostruire il percorso dell’energia.',
  steps: ['Osserva lo schema', 'Ordina le trasformazioni', 'Confronta i risultati'],
  questions: ['Dove avviene la trasformazione principale?'],
  adaptationHint: 'Usare parole-chiave e uno schema guidato.'
};

function proposal(context: TeachingProposalV1['context']): TeachingProposalV1 {
  return {
    schemaVersion: 1,
    kind: 'activity',
    ...content,
    sourceId: 'source-origin',
    context,
    provenance: {
      mode: 'remote',
      provider: 'google-gemini',
      model: 'gemini-3.8-flash',
      generatedAt: '2026-10-26T12:00:00.000Z'
    }
  };
}

function uda(overrides: Partial<UdaRecord> = {}): UdaRecord {
  return {
    id: 'uda-energy',
    title: 'Energia e centrale elettrica',
    className: '3ª A',
    hours: 10,
    period: 'Q1',
    startMonth: 1,
    durationMonths: 2,
    lessons: [],
    dependencies: [],
    ...overrides
  };
}

function context(overrides: Partial<ResolvedLibraryTeachingContext> = {}): ResolvedLibraryTeachingContext {
  return {
    udaId: 'uda-energy',
    className: '3ª A',
    period: 'Q1',
    ...overrides
  };
}

const common = {
  content,
  sourceId: 'adopted-source-1',
  lessonId: 'generated-lesson-1',
  capturedAt: '2026-10-26T14:00:00.000Z',
  lessonDate: '2026-10-26'
} as const;

describe('AIC-02 teaching proposal outcome mapping', () => {
  test('UDA-only adoption creates exactly one lesson and links the adopted source to UDA and lesson', () => {
    const original = uda();
    const originalSnapshot = structuredClone(original);

    const result = buildTeachingProposalUdaAdoption({
      ...common,
      proposal: proposal({ udaId: 'uda-energy' }),
      teachingContext: context(),
      udas: [original]
    });

    expect(result.receipt).toEqual({
      sourceId: 'adopted-source-1',
      udaId: 'uda-energy',
      lessonId: 'generated-lesson-1',
      mode: 'new-lesson'
    });
    expect(result.udas).toHaveLength(1);
    expect(result.udas[0]?.lessons).toHaveLength(1);
    expect(result.udas[0]?.lessons?.[0]).toEqual({
      id: 'generated-lesson-1',
      date: '2026-10-26',
      topic: content.title,
      hours: 1,
      notes: result.source.payload.text
    });
    expect(result.source.privacy).toBe('teacher-professional');
    expect(result.source.links).toEqual([
      { targetType: 'uda', targetId: 'uda-energy' },
      { targetType: 'lesson', targetId: 'generated-lesson-1' }
    ]);
    expect(original).toEqual(originalSnapshot);
  });

  test('explicit lesson adoption enriches that lesson in place without adding another lesson', () => {
    const original = uda({
      lessons: [{
        id: 'lesson-existing',
        date: '2026-10-20',
        topic: 'Trasformazioni energetiche',
        hours: 2,
        notes: 'Nota già presente',
        activityType: 'teoria'
      }]
    });

    const result = buildTeachingProposalUdaAdoption({
      ...common,
      proposal: proposal({ udaId: 'uda-energy', lessonId: 'lesson-existing' }),
      teachingContext: context({ lessonId: 'lesson-existing', activityType: 'teoria' }),
      udas: [original]
    });

    expect(result.receipt).toEqual({
      sourceId: 'adopted-source-1',
      udaId: 'uda-energy',
      lessonId: 'lesson-existing',
      mode: 'existing-lesson'
    });
    expect(result.udas[0]?.lessons).toHaveLength(1);
    const lesson = result.udas[0]?.lessons?.[0];
    expect(lesson?.id).toBe('lesson-existing');
    expect(lesson?.date).toBe('2026-10-20');
    expect(lesson?.topic).toBe('Trasformazioni energetiche');
    expect(lesson?.hours).toBe(2);
    expect(lesson?.activityType).toBe('teoria');
    expect(lesson?.notes).toContain('Nota già presente');
    expect(lesson?.notes).toContain('---');
    expect(lesson?.notes).toContain(result.source.payload.text ?? '');
    expect(result.source.links).toEqual([
      { targetType: 'uda', targetId: 'uda-energy' },
      { targetType: 'lesson', targetId: 'lesson-existing' }
    ]);
  });

  test('fails closed when the generated proposal no longer matches the current UDA context', () => {
    expect(() => buildTeachingProposalUdaAdoption({
      ...common,
      proposal: proposal({ udaId: 'uda-other' }),
      teachingContext: context(),
      udas: [uda()]
    })).toThrow('AIC02_CONTEXT_CHANGED_REVIEW_REQUIRED');
  });

  test('fails closed when the explicit lesson no longer exists', () => {
    expect(() => buildTeachingProposalUdaAdoption({
      ...common,
      proposal: proposal({ udaId: 'uda-energy', lessonId: 'lesson-missing' }),
      teachingContext: context({ lessonId: 'lesson-missing' }),
      udas: [uda()]
    })).toThrow('AIC02_CONTEXT_CHANGED_REVIEW_REQUIRED');
  });
});
