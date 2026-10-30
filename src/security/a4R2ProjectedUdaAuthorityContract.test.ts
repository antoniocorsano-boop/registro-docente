import { describe, expect, test } from 'bun:test';
import type { UdaRecord } from '../types';
import type { LibraryStateV1 } from '../library/types';
import type { ResolvedLibraryTeachingContext } from '../library/teachingContext';
import type { TeachingProposalContent, TeachingProposalV1 } from '../library/teachingProposal';
import type { SecureMeta } from './secureAppStorage';
import { deriveTeachingProposalOutcomeCandidate } from '../persistence/teachingProposalOutcomeMutation';
import { assertTeachingUdaWritableByRegistro, type TeachingUdaCandidate } from '../teaching/teachingUdaCatalog';

const content: TeachingProposalContent = {
  title: 'Attività sui sistemi tecnologici',
  objective: 'Riconoscere relazioni tra bisogni, risorse e sistemi.',
  teacherSetup: 'Predisporre una mappa.',
  studentTask: 'Analizzare un sistema.',
  steps: ['Osserva', 'Confronta'],
  questions: ['Quali risorse entrano nel sistema?'],
  adaptationHint: 'Usa una traccia guidata.'
};

const proposal: TeachingProposalV1 = {
  schemaVersion: 1,
  kind: 'activity',
  ...content,
  sourceId: 'source-origin',
  context: { udaId: 'docente-os:section-1a:plan-generation-1:1-01' },
  provenance: {
    mode: 'remote',
    provider: 'provider-test',
    model: 'model-test',
    generatedAt: '2026-10-30T10:00:00.000Z'
  }
};

const teachingContext: ResolvedLibraryTeachingContext = {
  udaId: 'docente-os:section-1a:plan-generation-1:1-01',
  className: '1A',
  period: 'Settembre/Ottobre'
};

const projectedCandidate: TeachingUdaCandidate = {
  id: 'docente-os:section-1a:plan-generation-1:1-01',
  origin: 'docente-os',
  classId: 'class-1a',
  classLabel: '1A',
  title: 'Tecnologia, bisogni, risorse e sistemi',
  periodLabel: 'Settembre/Ottobre',
  plannedHours: 8,
  sourceRef: '1-01',
  writableByRegistro: false,
  provenance: {
    sourceSectionId: 'section-1a',
    sourceCommit: '0123456789abcdef0123456789abcdef01234567',
    projectionFingerprint: 'a'.repeat(64)
  }
};

function currentState(): { library: LibraryStateV1; udas: UdaRecord[]; meta: SecureMeta } {
  return {
    library: { schemaVersion: 1, sources: [] },
    udas: [],
    meta: { changes: 7, lastBackup: '2026-10-20T10:00:00.000Z' }
  };
}

describe('A4-R2B projected UDA authority', () => {
  test('projected UDA remains selectable as read-only professional context', () => {
    expect(() => assertTeachingUdaWritableByRegistro(projectedCandidate)).toThrow('A4_R2_PROJECTED_UDA_READ_ONLY');
    expect(projectedCandidate.writableByRegistro).toBe(false);
  });

  test('compound UDA mutation fails closed even if the UI boundary is bypassed', () => {
    const current = currentState();
    const snapshot = structuredClone(current);

    expect(() => deriveTeachingProposalOutcomeCandidate(current, {
      proposal,
      content,
      teachingContext,
      sourceId: 'adopted-source-stable',
      lessonId: 'adopted-lesson-stable',
      capturedAt: '2026-10-30T10:05:00.000Z',
      lessonDate: '2026-10-30',
      targetWritableByRegistro: false
    })).toThrow('A4_R2_PROJECTED_UDA_READ_ONLY');

    expect(current).toEqual(snapshot);
  });

  test('composer/panel source keeps the compound write action unavailable for projected UDA', async () => {
    const composer = await Bun.file(new URL('../components/LibraryCopilotComposer.tsx', import.meta.url)).text();
    const panel = await Bun.file(new URL('../components/LibraryProposalPanel.tsx', import.meta.url)).text();

    expect(composer).toContain('writableByRegistro={proposalUda.writableByRegistro}');
    expect(panel).toContain('writableByRegistro: boolean');
    expect(panel).toContain('writableByRegistro &&');
    expect(panel).toContain('targetWritableByRegistro: writableByRegistro');
  });
});
