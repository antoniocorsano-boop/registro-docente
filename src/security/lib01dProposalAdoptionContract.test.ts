import { describe, expect, test } from 'bun:test';
import { createBackupPayload, normalizeBackupPayload } from './backupPayload';
import type { CompleteSecureAppSnapshot } from './secureAppStorage';

const PANEL = new URL('../components/LibraryProposalPanel.tsx', import.meta.url);
const CARD = new URL('../components/LibrarySourceCard.tsx', import.meta.url);
const VIEW = new URL('../components/LibraryView.tsx', import.meta.url);

const PROPOSAL = {
  schemaVersion: 1 as const,
  kind: 'activity' as const,
  title: 'Dalla fonte alla catena energetica',
  objective: 'Riconoscere e rappresentare le trasformazioni di energia.',
  teacherSetup: 'Presentare la fonte e richiamare il lessico essenziale.',
  studentTask: 'Ricostruire la catena delle trasformazioni e motivare ogni passaggio.',
  steps: ['Osserva', 'Ricostruisci', 'Confronta'],
  questions: ['Quale energia entra?', 'Quale energia esce?'],
  adaptationHint: 'Fornire una tabella guida.',
  sourceId: 'source-origin',
  context: {
    udaId: 'uda-energy',
    lessonId: 'lesson-energy'
  },
  provenance: {
    mode: 'remote' as const,
    provider: 'fake-provider',
    model: 'fake-model-v1',
    generatedAt: '2026-10-25T06:00:00.000Z'
  }
};

const ADAPTED_CONTENT = {
  title: 'Catena energetica adattata dal docente',
  objective: PROPOSAL.objective,
  teacherSetup: PROPOSAL.teacherSetup,
  studentTask: 'Completa lo schema e giustifica due passaggi.',
  steps: PROPOSAL.steps,
  questions: PROPOSAL.questions,
  adaptationHint: PROPOSAL.adaptationHint
};

function currentSnapshot(library: any): CompleteSecureAppSnapshot {
  return {
    appData: { classes: [], currentClassId: null },
    settings: { school: 'IC Test', year: '2026/27', teacher: 'Docente', subject: 'Tecnologia', theme: 'cyan' },
    udas: [],
    customTests: {},
    submissions: [],
    planning: {
      schemaVersion: 1,
      profiles: [],
      arenaContexts: [],
      resources: [],
      masterPrograms: [],
      classInstances: []
    },
    library,
    meta: { changes: 0, lastBackup: null }
  } as CompleteSecureAppSnapshot;
}

describe('LIB-01D proposal adoption contract', () => {
  test('materializes a pure converter that creates a new internal source with teacher-edited content', async () => {
    const module = await import('../library/teachingProposal') as typeof import('../library/teachingProposal') & {
      createInternalSourceFromTeachingProposal?: (input: {
        id: string;
        proposal: typeof PROPOSAL;
        content: typeof ADAPTED_CONTENT;
        capturedAt: string;
      }) => any;
    };

    expect(typeof module.createInternalSourceFromTeachingProposal).toBe('function');
    if (!module.createInternalSourceFromTeachingProposal) return;

    const adopted = module.createInternalSourceFromTeachingProposal({
      id: 'derived-source',
      proposal: PROPOSAL,
      content: ADAPTED_CONTENT,
      capturedAt: '2026-10-25T06:05:00.000Z'
    });

    expect(adopted.id).toBe('derived-source');
    expect(adopted.id).not.toBe(PROPOSAL.sourceId);
    expect(adopted.kind).toBe('internal');
    expect(adopted.status).toBe('ready');
    expect(adopted.privacy).toBe('teacher-professional');
    expect(adopted.title).toBe(ADAPTED_CONTENT.title);
    expect(adopted.payload.text).toContain(ADAPTED_CONTENT.studentTask);
    expect(adopted.payload.text).not.toContain(PROPOSAL.studentTask);
    expect(adopted.links).toEqual([{ targetType: 'lesson', targetId: 'lesson-energy' }]);
    expect(adopted.provenance).toEqual({
      derivedFromSourceId: 'source-origin',
      generation: {
        provider: 'fake-provider',
        model: 'fake-model-v1',
        generatedAt: '2026-10-25T06:00:00.000Z',
        kind: 'activity'
      }
    });
  });

  test('falls back to an UDA link when the proposal has no lesson context', async () => {
    const module = await import('../library/teachingProposal') as any;
    if (typeof module.createInternalSourceFromTeachingProposal !== 'function') return;

    const adopted = module.createInternalSourceFromTeachingProposal({
      id: 'derived-uda-source',
      proposal: { ...PROPOSAL, context: { udaId: 'uda-energy' } },
      content: ADAPTED_CONTENT,
      capturedAt: '2026-10-25T06:06:00.000Z'
    });
    expect(adopted.links).toEqual([{ targetType: 'uda', targetId: 'uda-energy' }]);
  });

  test('backup v4 preserves valid provenance and rejects malformed generation provenance', async () => {
    const module = await import('../library/teachingProposal') as any;
    if (typeof module.createInternalSourceFromTeachingProposal !== 'function') return;

    const adopted = module.createInternalSourceFromTeachingProposal({
      id: 'derived-backup-source',
      proposal: PROPOSAL,
      content: ADAPTED_CONTENT,
      capturedAt: '2026-10-25T06:07:00.000Z'
    });
    const snapshot = currentSnapshot({ schemaVersion: 1, sources: [adopted] });
    const normalized = normalizeBackupPayload(createBackupPayload(snapshot), snapshot);
    expect(normalized.library.sources[0]).toEqual(adopted);

    const malformed = createBackupPayload(currentSnapshot({
      schemaVersion: 1,
      sources: [{
        ...adopted,
        provenance: {
          derivedFromSourceId: '',
          generation: {
            provider: '',
            model: 'fake-model-v1',
            generatedAt: 'not-a-date',
            kind: 'activity'
          }
        }
      }]
    }));
    expect(() => normalizeBackupPayload(malformed, snapshot)).toThrow(/backup v4|library|biblioteca/i);
  });

  test('threads the existing durable add-source callback to the proposal panel without a new persistence path', async () => {
    const view = await Bun.file(VIEW).text();
    const card = await Bun.file(CARD).text();
    const panel = await Bun.file(PANEL).text();

    expect(view).toContain('onAddSource={onAddSource}');
    expect(card).toContain('onAddSource: (source: LibrarySource) => Promise<void>');
    expect(card).toContain('onAddSource={onAddSource}');
    expect(panel).toContain('onAddSource: (source: LibrarySource) => Promise<void>');
    expect(panel).toContain('createInternalSourceFromTeachingProposal');
    expect(panel).toContain('await onAddSource');
  });

  test('exposes only explicit Adotta Adatta Lascia decisions and keeps failed persistence retryable', async () => {
    const panel = await Bun.file(PANEL).text();
    expect(panel).toContain('Adotta');
    expect(panel).toContain('Adatta');
    expect(panel).toContain('Lascia');
    expect(panel).toContain('setIsEditing(true)');
    expect(panel).toContain('setProposal(null)');
    expect(panel).toContain('setAdoptionError');
    expect(panel).toContain('catch');
    expect(panel).toMatch(/await onAddSource[\s\S]+setProposal\(null\)/);
  });

  test('adapting is local and does not trigger another proposal request', async () => {
    const panel = await Bun.file(PANEL).text();
    expect(panel).toContain('editedContent');
    expect(panel).toContain('setEditedContent');
    expect(panel).toContain('Salva adattamento');
    const requestCalls = panel.match(/requestLibraryTeachingProposal\(/g) ?? [];
    expect(requestCalls).toHaveLength(1);
  });
});
