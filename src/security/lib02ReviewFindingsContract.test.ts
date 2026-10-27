import { describe, expect, test } from 'bun:test';
import { buildAiBudgetActivityKey } from '../copilot/aiBudgetGovernor';
import { buildCapturedWebTextPatch } from '../library/intake';
import { buildLibraryProposalRequest } from '../library/teachingProposal';
import type { LibrarySource } from '../library/types';
import type { ResolvedLibraryTeachingContext } from '../library/teachingContext';
import { handleLibraryProposalRequest } from '../server/libraryProposalRoute';
import type { UdaRecord } from '../types';

const UDA: UdaRecord = {
  id: 'uda-lib02-review',
  title: 'Energia e trasformazioni',
  className: '3C',
  hours: 4,
  period: 'Q1',
  startMonth: 1,
  durationMonths: 1,
  lessons: []
};

const CONTEXT: ResolvedLibraryTeachingContext = {
  udaId: UDA.id,
  className: UDA.className,
  period: UDA.period
};

const VALID_PROVIDER_OUTPUT = {
  title: 'Dalla fonte alla trasformazione energetica',
  objective: 'Riconoscere le trasformazioni di energia.',
  teacherSetup: 'Presentare la fonte strutturata.',
  studentTask: 'Individuare dati e trasformazioni rilevanti.',
  steps: ['Leggi la fonte', 'Individua i dati', 'Confronta le trasformazioni'],
  questions: ['Quale informazione è centrale?', 'Quale trasformazione descrive?'],
  adaptationHint: 'Ridurre i dati e usare una tabella guida.'
};

function readyProfessionalFile(mimeType: string, text: string): LibrarySource {
  return {
    id: `source-${mimeType}`,
    kind: 'file',
    title: 'Fonte testuale strutturata',
    capturedAt: '2026-10-25T10:00:00.000Z',
    payload: {
      mimeType,
      dataUrl: `data:${mimeType};base64,ZmFrZQ==`,
      text
    },
    extractedText: text,
    status: 'ready',
    privacy: 'teacher-professional',
    links: []
  };
}

describe('LIB-02 review findings regression contract', () => {
  test('allows explicit completion of legacy URL-only sources that were persisted as ready before LIB-02', () => {
    const legacyWeb: LibrarySource = {
      id: 'legacy-web-ready-without-content',
      kind: 'web',
      title: 'Pagina salvata prima di LIB-02',
      capturedAt: '2026-10-24T12:00:00.000Z',
      origin: 'example.org',
      sourceUrl: 'https://example.org/legacy',
      payload: {},
      status: 'ready',
      privacy: 'unknown',
      links: []
    };

    expect(buildCapturedWebTextPatch(legacyWeb, '  Contenuto acquisito successivamente.  ')).toEqual({
      extractedText: 'Contenuto acquisito successivamente.',
      status: 'ready'
    });
  });

  test('uses locally extracted JSON and XML as bounded text in the existing proposal request', () => {
    for (const [mimeType, text] of [
      ['application/json', '{"tema":"energia"}'],
      ['application/xml', '<tema>energia</tema>']
    ] as const) {
      const request = buildLibraryProposalRequest({
        source: readyProfessionalFile(mimeType, text),
        teachingContext: CONTEXT,
        uda: UDA,
        explicitTeacherOptIn: true
      });

      expect(request.source).toEqual({
        id: `source-${mimeType}`,
        kind: 'file',
        title: 'Fonte testuale strutturata',
        text,
        mimeType
      });
      expect(request.source.dataBase64).toBeUndefined();
    }
  });

  test('accepts locally extracted structured-text file requests at the governed server boundary', async () => {
    for (const [mimeType, text] of [
      ['application/json', '{"tema":"energia"}'],
      ['application/xml', '<tema>energia</tema>']
    ] as const) {
      const calls: unknown[] = [];
      const result = await handleLibraryProposalRequest(
        {
          schemaVersion: 1,
          action: 'prepare-activity',
          classification: 'TEACHER_PROFESSIONAL',
          explicitTeacherOptIn: true,
          source: {
            id: `source-${mimeType}`,
            kind: 'file',
            title: 'Fonte testuale strutturata',
            text,
            mimeType
          },
          context: {
            udaId: UDA.id,
            udaTitle: UDA.title,
            className: UDA.className,
            period: String(UDA.period)
          },
          budget: {
            schemaVersion: 1,
            profile: 'balanced',
            activityKey: buildAiBudgetActivityKey(UDA.id)
          }
        },
        {
          id: 'fake-provider',
          model: 'fake-model-v1',
          async generate(input) {
            calls.push(input);
            return VALID_PROVIDER_OUTPUT;
          }
        }
      );

      expect(result.status).toBe(200);
      expect(calls).toHaveLength(1);
    }
  });
});