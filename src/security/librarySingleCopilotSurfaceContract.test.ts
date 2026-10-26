import { describe, expect, test } from 'bun:test';

const appSource = await Bun.file(new URL('../App.tsx', import.meta.url)).text();
const composerSource = await Bun.file(new URL('../components/LibraryCopilotComposer.tsx', import.meta.url)).text();
const libraryViewSource = await Bun.file(new URL('../components/LibraryView.tsx', import.meta.url)).text();
const sourceCardSource = await Bun.file(new URL('../components/LibrarySourceCard.tsx', import.meta.url)).text();

describe('single contextual Copilot surface contract', () => {
  test('App owns the session launch handoff and passes it to the global Composer', () => {
    expect(appSource).toContain("from './library/copilotLaunchContext'");
    expect(appSource).toContain('launchRequest=');
    expect(appSource).toContain('onOpenCopilot=');
    expect(composerSource).toContain('launchRequest');
  });

  test('Library can hand a selected source and teaching context to the Copilot', () => {
    expect(libraryViewSource).toContain('onOpenCopilot');
    expect(sourceCardSource).toContain('onOpenCopilot');
    expect(sourceCardSource).toContain('Usa con Copilota');
  });

  test('LibrarySourceCard is no longer a second transformation engine', () => {
    expect(sourceCardSource).not.toContain("import { LibraryProposalPanel } from './LibraryProposalPanel'");
    expect(sourceCardSource).not.toContain('resolveLibraryContextActions');
    expect(sourceCardSource).not.toContain('dispatchLibraryContextAction');
    expect(sourceCardSource).not.toContain('<LibraryProposalPanel');
  });
});
