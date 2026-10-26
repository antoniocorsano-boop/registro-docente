import { describe, expect, test } from 'bun:test';

const appSource = await Bun.file(new URL('../App.tsx', import.meta.url)).text();
const composerSource = await Bun.file(new URL('../components/LibraryCopilotComposer.tsx', import.meta.url)).text();
const libraryViewSource = await Bun.file(new URL('../components/LibraryView.tsx', import.meta.url)).text();
const sourceCardSource = await Bun.file(new URL('../components/LibrarySourceCard.tsx', import.meta.url)).text();

describe('single contextual Copilot surface contract', () => {
  test('App owns a session-only launch handoff and passes it to the global Composer', () => {
    expect(appSource).toContain("from './library/copilotLaunchContext'");
    expect(appSource).toContain('LibraryCopilotLaunchRequest');
    expect(appSource).toContain('CopilotLaunchContext');
    expect(appSource).toContain('launchRequest');
    expect(appSource).toContain('openLibraryCopilot');
    expect(appSource).toContain('launchRequest=');
    expect(appSource).toContain('onOpenCopilot=');
    expect(composerSource).toContain('launchRequest');

    expect(appSource).not.toContain('saveCopilotLaunch');
    expect(appSource).not.toContain('copilotLaunchRef.current = initialSnapshot');
  });

  test('global launch context is ambient metadata only and excludes student data', () => {
    expect(appSource).toContain('ambientCopilotContext');
    expect(appSource).toContain('className: currentClass?.name');
    expect(appSource).not.toContain('ambientCopilotContext = { student');
    expect(appSource).not.toContain('ambientCopilotContext = { grades');
    expect(appSource).not.toContain('ambientCopilotContext = { behaviors');
  });

  test('Library can hand a selected source and teaching context to the Copilot', () => {
    expect(libraryViewSource).toContain('onOpenCopilot');
    expect(sourceCardSource).toContain('onOpenCopilot');
    expect(sourceCardSource).toContain('sourceId: source.id');
    expect(sourceCardSource).toContain('udaId: resolvedTeachingContext?.udaId');
    expect(sourceCardSource).toContain('lessonId: resolvedTeachingContext?.lessonId');
    expect(sourceCardSource).toContain('Usa con Copilota');
  });

  test('Composer binds an explicit launch request before deterministic fallback', () => {
    expect(composerSource).toContain('resolveLaunchTeachingContext');
    expect(composerSource).toContain('launchRequest?.nonce');
    expect(composerSource).toContain('launchRequest.context.sourceId');
    expect(composerSource).toContain('setIsOpen(true)');
    expect(composerSource).toContain('Il contesto richiesto non è più disponibile.');
    expect(composerSource).toContain('hasExplicitLaunchTarget');
  });

  test('LibrarySourceCard is no longer a second transformation engine', () => {
    expect(sourceCardSource).not.toContain("import { LibraryProposalPanel } from './LibraryProposalPanel'");
    expect(sourceCardSource).not.toContain('resolveLibraryContextActions');
    expect(sourceCardSource).not.toContain('dispatchLibraryContextAction');
    expect(sourceCardSource).not.toContain('<LibraryProposalPanel');
  });
});
