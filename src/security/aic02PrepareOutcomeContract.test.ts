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
const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);
const PANEL = new URL('../components/LibraryProposalPanel.tsx', import.meta.url);

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

  test('App serializes one committed-state compound task and publishes only after atomic persistence', async () => {
    const app = await Bun.file(APP).text();
    const callback = app.split('const handleAdoptTeachingProposalToUda = useCallback(', 2)[1]
      ?.split('const handleAddLibrarySource = useCallback(', 1)[0] ?? '';

    expect(app).toContain("from './persistence/teachingProposalOutcomeMutation'");
    expect(callback).toContain('mutationCoordinator.enqueueTask(async () =>');
    expect(callback).toContain('library: libraryRef.current');
    expect(callback).toContain('udas: udasRef.current');
    expect(callback).toContain('meta: metaRef.current');
    expect(callback).toContain('deriveTeachingProposalOutcomeCandidate({');
    expect(callback).toContain('await secureStorage.saveLibraryUdasAndMeta(candidate.library, candidate.udas, candidate.meta)');
    expect(callback).toContain('libraryRef.current = candidate.library');
    expect(callback).toContain('udasRef.current = candidate.udas');
    expect(callback).toContain('metaRef.current = candidate.meta');
    expect(callback.indexOf('await secureStorage.saveLibraryUdasAndMeta')).toBeLessThan(
      callback.indexOf('libraryRef.current = candidate.library')
    );
    expect(callback).toContain("toast('Proposta aggiunta all’UDA')");
    expect(callback).toContain('return candidate.receipt');
  });

  test('exposes two explicit adoption destinations with stable retry IDs and no hidden UDA write', async () => {
    const app = await Bun.file(APP).text();
    const composer = await Bun.file(COMPOSER).text();
    const panel = await Bun.file(PANEL).text();

    expect(app).toContain('onAdoptProposalToUda={handleAdoptTeachingProposalToUda}');
    expect(composer).toContain('onAdoptProposalToUda:');
    expect(composer).toContain('onAdoptProposalToUda={onAdoptProposalToUda}');
    expect(panel).toContain('onAdoptProposalToUda:');
    expect(panel).toContain("const adoptionSourceIdRef = useRef<string | null>(null)");
    expect(panel).toContain("const adoptionLessonIdRef = useRef<string | null>(null)");
    expect(panel).toContain('Adotta in Biblioteca');
    expect(panel).toContain("Adotta e aggiungi all'UDA");
    expect(panel).toContain('adoptLibraryContent');
    expect(panel).toContain('adoptUdaContent');
    expect(panel).toContain('await onAddSource(adopted)');
    expect(panel).toContain('await onAdoptProposalToUda({');
    expect(panel).not.toContain('type="checkbox"');
    expect(panel).not.toContain("'Adotta'}");
  });
});
