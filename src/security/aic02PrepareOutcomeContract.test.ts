import { describe, expect, test } from 'bun:test';
import {
  deriveTeachingProposalOutcomeCandidate,
  type TeachingProposalOutcomeMutationInput
} from '../persistence/teachingProposalOutcomeMutation';
import type { LibraryStateV1 } from '../library/types';
import type { UdaRecord } from '../types';
import type { SecureMeta } from './secureAppStorage';

const APP = new URL('../App.tsx', import.meta.url);
const MUTATION = new URL('../persistence/teachingProposalOutcomeMutation.ts', import.meta.url);

function mutationInput(): TeachingProposalOutcomeMutationInput {
  return {
    proposal: {
      schemaVersion: 1,
      kind: 'activity',
      title: 'Centrale elettrica: trasformazioni',
      objective: 'Comprendere le trasformazioni energetiche.',
      teacherSetup: 'Predisporre uno schema.',
      studentTask: 'Ricostruire la sequenza.',
      steps: ['Osserva', 'Ordina'],
      questions: ['Quale trasformazione avviene?'],
      adaptationHint: 'Schema guidato.',
      sourceId: 'source-origin',
      context: { udaId: 'uda-energy' },
      provenance: {
        mode: 'remote',
        provider: 'google-gemini',
        model: 'gemini-3.8-flash',
        generatedAt: '2026-10-26T12:00:00.000Z'
      }
    },
    content: {
      title: 'Centrale elettrica: trasformazioni',
      objective: 'Comprendere le trasformazioni energetiche.',
      teacherSetup: 'Predisporre uno schema.',
      studentTask: 'Ricostruire la sequenza.',
      steps: ['Osserva', 'Ordina'],
      questions: ['Quale trasformazione avviene?'],
      adaptationHint: 'Schema guidato.'
    },
    teachingContext: {
      udaId: 'uda-energy',
      className: '3ª A',
      period: 'Q1'
    },
    sourceId: 'adopted-source-stable',
    lessonId: 'adopted-lesson-stable',
    capturedAt: '2026-10-26T14:00:00.000Z',
    lessonDate: '2026-10-26'
  };
}

function committedState(): { library: LibraryStateV1; udas: UdaRecord[]; meta: SecureMeta } {
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
    meta: { changes: 7, lastBackup: null }
  };
}

describe('AIC-02 governed PREPARE outcome boundary', () => {
  test('materializes one compound candidate before App can persist a proposal into Library and UDA', async () => {
    const mutation = Bun.file(MUTATION);
    expect(await mutation.exists()).toBe(true);
    if (!(await mutation.exists())) return;

    const source = await mutation.text();
    expect(source).toContain('deriveTeachingProposalOutcomeCandidate');
    expect(source).toContain('buildTeachingProposalUdaAdoption');
    expect(source).toContain('addLibrarySource');
    expect(source).toContain('incrementBackupChanges');
  });

  test('executes the compound candidate against committed state with one backup increment', () => {
    const current = committedState();
    const snapshot = structuredClone(current);
    const candidate = deriveTeachingProposalOutcomeCandidate(current, mutationInput());

    expect(candidate.meta.changes).toBe(8);
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

  test('App commits Library UDA and meta through one coordinator entry and publishes only after persistence', async () => {
    const app = await Bun.file(APP).text();

    expect(app).toContain("from './persistence/teachingProposalOutcomeMutation'");
    expect(app).toContain('const handleAdoptTeachingProposalToUda = useCallback(');
    expect(app).toContain('library: libraryRef.current');
    expect(app).toContain('udas: udasRef.current');
    expect(app).toContain('meta: metaRef.current');
    expect(app).toContain('deriveTeachingProposalOutcomeCandidate(current, input)');
    expect(app).toContain('secureStorage.saveLibraryUdasAndMeta(candidate.library, candidate.udas, candidate.meta)');
    expect(app).toContain('libraryRef.current = candidate.library');
    expect(app).toContain('udasRef.current = candidate.udas');
    expect(app).toContain('metaRef.current = candidate.meta');
    expect(app).toContain("toast('Proposta aggiunta all’UDA')");
  });
});
