import { describe, expect, test } from 'bun:test';
import type { UdaRecord } from '../types';
import type { LibraryStateV1 } from '../library/types';
import type { ResolvedLibraryTeachingContext } from '../library/teachingContext';
import type { TeachingProposalContent, TeachingProposalV1 } from '../library/teachingProposal';
import type { SecureMeta } from '../security/secureAppStorage';
import { deriveTeachingProposalOutcomeCandidate } from './teachingProposalOutcomeMutation';

const content: TeachingProposalContent = {
  title: 'Centrale elettrica: trasformazioni',
  objective: 'Comprendere le trasformazioni energetiche.',
  teacherSetup: 'Predisporre uno schema.',
  studentTask: 'Ricostruire la sequenza.',
  steps: ['Osserva', 'Ordina'],
  questions: ['Quale trasformazione avviene?'],
  adaptationHint: 'Schema guidato.'
};

const proposal: TeachingProposalV1 = {
  schemaVersion: 1,
  kind: 'activity',
  ...content,
  sourceId: 'source-origin',
  context: { udaId: 'uda-energy' },
  provenance: {
    mode: 'remote',
    provider: 'google-gemini',
    model: 'gemini-3.8-flash',
    generatedAt: '2026-10-26T12:00:00.000Z'
  }
};

const teachingContext: ResolvedLibraryTeachingContext = {
  udaId: 'uda-energy',
  className: '3ª A',
  period: 'Q1'
};

function currentState(): { library: LibraryStateV1; udas: UdaRecord[]; meta: SecureMeta } {
  return {
    library: { schemaVersion: 1, sources: [] },
    udas: [{
      id: 'uda-energy',
      title: 'Energia',
      className: '3ª A',
      hours: 8,
      period: 'Q1',
      startMonth: 0,
      durationMonths: 2,
      lessons: [],
      dependencies: []
    }],
    meta: { changes: 7, lastBackup: '2026-10-20T10:00:00.000Z' }
  };
}

const input = {
  proposal,
  content,
  teachingContext,
  sourceId: 'adopted-source-stable',
  lessonId: 'adopted-lesson-stable',
  capturedAt: '2026-10-26T14:00:00.000Z',
  lessonDate: '2026-10-26'
};

describe('AIC-02 compound proposal outcome mutation', () => {
  test('derives Library UDA and meta together and increments backup changes exactly once', () => {
    const current = currentState();
    const snapshot = structuredClone(current);

    const candidate = deriveTeachingProposalOutcomeCandidate(current, input);

    expect(candidate.meta).toEqual({
      changes: 8,
      lastBackup: '2026-10-20T10:00:00.000Z'
    });
    expect(candidate.library.sources).toHaveLength(1);
    expect(candidate.library.sources[0]?.id).toBe('adopted-source-stable');
    expect(candidate.udas[0]?.lessons).toHaveLength(1);
    expect(candidate.udas[0]?.lessons?.[0]?.id).toBe('adopted-lesson-stable');
    expect(candidate.receipt).toEqual({
      sourceId: 'adopted-source-stable',
      udaId: 'uda-energy',
      lessonId: 'adopted-lesson-stable',
      mode: 'new-lesson'
    });
    expect(current).toEqual(snapshot);
  });

  test('uses stable caller IDs and fails before a candidate can be persisted when context drifted', () => {
    const current = currentState();
    current.udas[0]!.className = '3ª B';

    expect(() => deriveTeachingProposalOutcomeCandidate(current, input))
      .toThrow('AIC02_CONTEXT_CHANGED_REVIEW_REQUIRED');
    expect(current.library.sources).toHaveLength(0);
    expect(current.meta.changes).toBe(7);
  });
});
