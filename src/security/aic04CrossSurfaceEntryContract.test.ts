import { describe, expect, test } from 'bun:test';

const composerSource = await Bun.file(new URL('../components/LibraryCopilotComposer.tsx', import.meta.url)).text();
const appSource = await Bun.file(new URL('../App.tsx', import.meta.url)).text();

describe('AIC-04 cross-surface Copilot entry contract', () => {
  test('allows a teacher objective to be submitted without selecting a Library source first', () => {
    expect(composerSource).toContain('if (!message.trim() || isResolving) return;');
    expect(composerSource).not.toContain('if (!selectedSource || !message.trim() || isResolving) return;');
    expect(composerSource).toContain('disabled={!message.trim() || isResolving}');
    expect(composerSource).not.toContain('disabled={!selectedSource || !message.trim() || isResolving}');

    expect(composerSource).toContain('source: selectedSource ?? null');
    expect(composerSource).toContain("if (routed.kind === 'SOURCE_REQUIRED')");
    expect(composerSource).toContain('seleziona o aggiungi una fonte');
  });

  test('source-less agent fallback fails closed instead of invoking source-based local intent discovery', () => {
    const fallbackStart = composerSource.indexOf('const runLocalFallback = async () => {');
    const discoveryStart = composerSource.indexOf('discoverLibraryCopilotIntent', fallbackStart);
    expect(fallbackStart).toBeGreaterThan(-1);
    expect(discoveryStart).toBeGreaterThan(fallbackStart);

    const fallbackPrefix = composerSource.slice(fallbackStart, discoveryStart);
    expect(fallbackPrefix).toContain('if (!selectedSource)');
    expect(fallbackPrefix).toContain('setGuidanceMessage');
  });

  test('source-less async identity includes the teacher message and projected surface instead of collapsing to an empty snapshot', () => {
    expect(composerSource).toContain('const currentResolutionSnapshot = JSON.stringify({');
    expect(composerSource).toContain('sourceRequest: selectedSource');
    expect(composerSource).toContain('message: message.trim(),');
    expect(composerSource).toContain('contextProjection: copilotContextProjection');
    expect(composerSource).not.toContain("  : '';\n  const resolutionSnapshotRef");
  });

  test('priority teacher surfaces remain ambient professional metadata and source selection does not auto-replay a request', () => {
    expect(appSource).toContain("activeTab === 'dashboard' ? 'class-dashboard'");
    expect(appSource).toContain("activeTab === 'programmazione' ? 'planning'");
    expect(appSource).toContain("activeTab === 'verifiche-online' ? 'online-tests'");
    expect(appSource).toContain("activeTab === 'voti' ? 'evaluations'");
    expect(appSource).toContain("activeTab === 'tabellone' ? 'evaluations'");
    expect(appSource).not.toContain('ambientCopilotContext = { student');
    expect(appSource).not.toContain('ambientCopilotContext = { grades');
    expect(appSource).not.toContain('ambientCopilotContext = { behaviors');

    const sourceSelectStart = composerSource.indexOf('id="copilot-source"');
    const sourceSelectEnd = composerSource.indexOf('</select>', sourceSelectStart);
    expect(sourceSelectStart).toBeGreaterThan(-1);
    expect(sourceSelectEnd).toBeGreaterThan(sourceSelectStart);
    const sourceSelectionHandler = composerSource.slice(sourceSelectStart, sourceSelectEnd);
    expect(sourceSelectionHandler).not.toContain('handleResolve(');
    expect(sourceSelectionHandler).not.toContain('interpretCopilotIntent(');
  });
});
