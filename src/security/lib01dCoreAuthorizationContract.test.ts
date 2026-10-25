import { describe, expect, test } from 'bun:test';
import type { LibrarySource } from '../library/types';
import type { ResolvedLibraryTeachingContext } from '../library/teachingContext';

const CONTEXT: ResolvedLibraryTeachingContext = {
  udaId: 'uda-lib01d',
  className: '3C',
  period: 'Q1',
  lessonId: 'lesson-lib01d',
  activityType: 'laboratorio'
};

const makeSource = (privacy: LibrarySource['privacy']): LibrarySource => ({
  id: 'source-lib01d-core',
  kind: 'note',
  title: 'Titolo da non esportare nel ContextSnapshot',
  capturedAt: '2026-10-25T05:35:00.000Z',
  payload: { text: 'CONTENUTO_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT' },
  extractedText: 'ESTRATTO_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT',
  notes: 'NOTA_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT',
  status: 'ready',
  privacy,
  links: []
});

type Adapter = typeof import('../library/contextualCoreAdapter') & {
  resolveLibraryRemoteProposalActions?: (
    source: LibrarySource,
    teachingContext: ResolvedLibraryTeachingContext,
    explicitRemoteOptIn: boolean
  ) => Promise<readonly { id: string }[]>;
  buildLibraryRemoteProposalSnapshot?: (
    source: LibrarySource,
    teachingContext: ResolvedLibraryTeachingContext,
    explicitRemoteOptIn: boolean
  ) => unknown;
};

async function loadAdapter(): Promise<Adapter> {
  return await import('../library/contextualCoreAdapter') as Adapter;
}

describe('LIB-01D request-scoped Core authorization', () => {
  test('keeps the default local resolver unchanged and generative actions hidden', async () => {
    const adapter = await loadAdapter();
    const actions = await adapter.resolveLibraryContextActions(makeSource('teacher-professional'), CONTEXT);
    expect(actions.map(action => action.id)).toEqual(['review-source', 'link-source-to-uda']);
  });

  test('materializes a dedicated request-scoped remote proposal resolver', async () => {
    const adapter = await loadAdapter();
    expect(typeof adapter.resolveLibraryRemoteProposalActions).toBe('function');
    expect(typeof adapter.buildLibraryRemoteProposalSnapshot).toBe('function');
  });

  test('exposes PREPARE only for professional sources with explicit one-shot opt-in', async () => {
    const adapter = await loadAdapter();
    if (!adapter.resolveLibraryRemoteProposalActions) return;

    const withoutOptIn = await adapter.resolveLibraryRemoteProposalActions(
      makeSource('teacher-professional'), CONTEXT, false
    );
    expect(withoutOptIn.map(action => action.id)).not.toContain('prepare-from-source');

    const withOptIn = await adapter.resolveLibraryRemoteProposalActions(
      makeSource('teacher-professional'), CONTEXT, true
    );
    expect(withOptIn.map(action => action.id)).toEqual([
      'review-source',
      'link-source-to-uda',
      'prepare-from-source'
    ]);
    expect(withOptIn.map(action => action.id)).not.toContain('summarize-source');
  });

  test('keeps unknown and student-personal sources fail-closed even when opt-in is forced', async () => {
    const adapter = await loadAdapter();
    if (!adapter.resolveLibraryRemoteProposalActions) return;

    for (const privacy of ['unknown', 'student-personal'] as const) {
      const actions = await adapter.resolveLibraryRemoteProposalActions(makeSource(privacy), CONTEXT, true);
      expect(actions.map(action => action.id)).not.toContain('prepare-from-source');
    }
  });

  test('remote proposal snapshot stays metadata-only and only professional opt-in can authorize a provider', async () => {
    const adapter = await loadAdapter();
    if (!adapter.buildLibraryRemoteProposalSnapshot) return;

    const allowed = adapter.buildLibraryRemoteProposalSnapshot(
      makeSource('teacher-professional'), CONTEXT, true
    ) as { privacy: { remoteProviderAllowed: boolean; dataClasses: string[] } };
    expect(allowed.privacy.remoteProviderAllowed).toBe(true);
    expect(allowed.privacy.dataClasses).toEqual(['TEACHER_PROFESSIONAL', 'CURRICOLO']);

    const denied = adapter.buildLibraryRemoteProposalSnapshot(
      makeSource('unknown'), CONTEXT, true
    ) as { privacy: { remoteProviderAllowed: boolean; dataClasses: string[] } };
    expect(denied.privacy.remoteProviderAllowed).toBe(false);
    expect(denied.privacy.dataClasses).toContain('STUDENT_PERSONAL');

    const serialized = JSON.stringify(allowed);
    expect(serialized).not.toContain('CONTENUTO_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT');
    expect(serialized).not.toContain('ESTRATTO_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT');
    expect(serialized).not.toContain('NOTA_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT');
    expect(serialized).not.toContain('Titolo da non esportare nel ContextSnapshot');
  });
});
