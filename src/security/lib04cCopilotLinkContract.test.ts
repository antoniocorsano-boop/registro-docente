import { describe, expect, test } from 'bun:test';
import type { ResolvedLibraryTeachingContext } from '../library/teachingContext';

const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);
const APP = new URL('../App.tsx', import.meta.url);
const TARGET_HELPER = new URL('../library/copilotLinkTarget.ts', import.meta.url);

async function loadTargetHelper(): Promise<{
  module: null | {
    resolveCopilotLinkTarget?: (context: ResolvedLibraryTeachingContext | null) => unknown;
  };
  error: unknown;
}> {
  try {
    const module = await import('../library/copilotLinkTarget') as {
      resolveCopilotLinkTarget?: (context: ResolvedLibraryTeachingContext | null) => unknown;
    };
    return { module, error: null };
  } catch (error) {
    return { module: null, error };
  }
}

const udaContext: ResolvedLibraryTeachingContext = {
  udaId: 'uda-lib04c',
  className: '3A',
  period: 'Q1'
};

const lessonContext: ResolvedLibraryTeachingContext = {
  ...udaContext,
  lessonId: 'lesson-lib04c',
  activityType: 'laboratorio'
};

describe('LIB-04C deterministic LINK target', () => {
  test('materializes a dedicated target helper before wiring the composer', async () => {
    expect(await Bun.file(TARGET_HELPER).exists()).toBe(true);

    const loaded = await loadTargetHelper();
    expect(loaded.error).toBeNull();
    expect(typeof loaded.module?.resolveCopilotLinkTarget).toBe('function');
  });

  test('prefers lesson target, falls back to UDA and fails closed without context', async () => {
    const loaded = await loadTargetHelper();
    expect(loaded.error).toBeNull();
    if (typeof loaded.module?.resolveCopilotLinkTarget !== 'function') return;

    expect(loaded.module.resolveCopilotLinkTarget(lessonContext)).toEqual({
      targetType: 'lesson',
      targetId: 'lesson-lib04c'
    });
    expect(loaded.module.resolveCopilotLinkTarget(udaContext)).toEqual({
      targetType: 'uda',
      targetId: 'uda-lib04c'
    });
    expect(loaded.module.resolveCopilotLinkTarget(null)).toBeNull();
  });
});

describe('LIB-04C governed Composer LINK contract', () => {
  test('requires a durable onLink callback and a Core-governed two-step dispatch', async () => {
    const composer = await Bun.file(COMPOSER).text();

    expect(composer).toContain("import type { LibrarySource, LibrarySourceLink, LibraryStateV1 } from '../library/types'");
    expect(composer).toContain('dispatchLibraryContextAction');
    expect(composer).toContain('resolveCopilotLinkTarget');
    expect(composer).toContain('onLink: (sourceId: string, link: LibrarySourceLink) => Promise<void>');
    expect(composer).toContain("actionId: 'link-source-to-uda'");
    expect(composer).toContain('executor: async () => undefined');
    expect(composer).toContain("result.status === 'HUMAN_CONFIRMATION_REQUIRED'");
    expect(composer).toContain('humanConfirmed: true');
    expect(composer).toContain('executor: () => onLink(selectedSource.id, target)');
    expect(composer).toContain("result.status !== 'EXECUTED'");
  });

  test('makes only LINK operational and keeps a retryable explicit confirmation surface', async () => {
    const composer = await Bun.file(COMPOSER).text();

    expect(composer).toContain("action.id === 'link-source-to-uda'");
    expect(composer).toContain('data-testid="library-copilot-link-action"');
    expect(composer).toContain('data-testid="library-copilot-link-confirmation"');
    expect(composer).toContain('Conferma collegamento');
    expect(composer).toContain('Annulla');
    expect(composer).toContain('Salvataggio…');
    expect(composer).toContain('Il collegamento è stato salvato nella Biblioteca.');
    expect(composer).toContain('Puoi riprovare senza perdere la proposta.');
    expect(composer).not.toContain("actionId: 'review-source'");
    expect(composer).not.toContain("actionId: 'prepare-from-source'");
    expect(composer).not.toContain("actionId: 'summarize-source'");
  });

  test('wires the Composer to the existing durable Library handler', async () => {
    const app = await Bun.file(APP).text();
    expect(app).toContain('onLink={handleLinkLibrarySource}');
  });
});
