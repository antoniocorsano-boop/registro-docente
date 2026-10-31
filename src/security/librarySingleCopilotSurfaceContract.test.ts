import { describe, expect, test } from 'bun:test';

const appSource = await Bun.file(new URL('../App.tsx', import.meta.url)).text();
const composerSource = await Bun.file(new URL('../components/LibraryCopilotComposer.tsx', import.meta.url)).text();
const libraryViewSource = await Bun.file(new URL('../components/LibraryView.tsx', import.meta.url)).text();
const sourceCardSource = await Bun.file(new URL('../components/LibrarySourceCard.tsx', import.meta.url)).text();
const launchContextSource = await Bun.file(new URL('../library/copilotLaunchContext.ts', import.meta.url)).text();
const udaWorkspaceSource = await Bun.file(new URL('../components/UdaWorkspaceView.tsx', import.meta.url)).text();

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
    expect(sourceCardSource).toContain('udaId: resolvedTeachingContext.udaId');
    expect(sourceCardSource).toContain('lessonId: resolvedTeachingContext.lessonId');
    expect(sourceCardSource).toContain('openCopilotForIntent');
    expect(sourceCardSource).toContain('Prepara un’attività');
    expect(sourceCardSource).toContain('Rivedi nel contesto');
    expect(sourceCardSource).toContain('Collega alla UDA');
    expect(launchContextSource).toContain("export type LibraryLaunchIntent = 'prepare' | 'review' | 'link';");
    expect(launchContextSource).toContain('intent?: LibraryLaunchIntent;');
  });

  test('Library handoff preserves whether Teaching Context is proposed or explicit', () => {
    expect(launchContextSource).toContain("teachingContextMode?: 'explicit' | 'proposed'");
    expect(sourceCardSource).toContain("teachingContextMode: contextSuggestion ? 'proposed' : 'explicit'");
    expect(composerSource).toContain("launchRequest?.context.teachingContextMode === 'proposed'");
    expect(composerSource).toContain('hasLaunchTeachingTarget');
    expect(composerSource).toContain('contextIsProposed');
  });

  test('a non-Library UDA surface can launch an explicit teaching context', () => {
    expect(appSource).toContain('onOpenCopilot={openLibraryCopilot}');
    expect(udaWorkspaceSource).toContain('onOpenCopilot');
    expect(udaWorkspaceSource).toContain("surface: 'uda'");
    expect(udaWorkspaceSource).toContain('className: uda.className');
    expect(udaWorkspaceSource).toContain('udaId: uda.id');
    expect(udaWorkspaceSource).toContain('Usa con Copilota');
  });

  test('Composer binds an explicit launch request before deterministic fallback', () => {
    expect(composerSource).toContain('resolveLaunchTeachingContext');
    expect(composerSource).toContain('launchRequest?.nonce');
    expect(composerSource).toContain('launchRequest?.context.sourceId');
    expect(composerSource).toContain('requestedLaunchSourceId');
    expect(composerSource).toContain("onSurfaceModeChange('compose')");
    expect(composerSource).toContain('Il contesto richiesto non è più disponibile.');
    expect(composerSource).toContain('hasExplicitLaunchTarget');
  });

  test('explicit or proposed teaching context is visible, changeable and removable in the Composer', () => {
    expect(composerSource).toContain('data-testid="library-copilot-context-select"');
    expect(composerSource).toContain('Contesto didattico');
    expect(composerSource).toContain('Nessun contesto');
    expect(composerSource).toContain('Contesto proposto');
    expect(composerSource).toContain('setContextOverride');
  });

  test('source mutations do not replay an already-consumed launch request', () => {
    const launchEffectStart = composerSource.indexOf("useEffect(() => {\n    if (!launchRequest) return;");
    const staleSourceWatcherStart = composerSource.indexOf("useEffect(() => {\n    if (!launchRequest || !requestedLaunchSourceId) return;", launchEffectStart + 1);
    expect(launchEffectStart).toBeGreaterThan(-1);
    expect(staleSourceWatcherStart).toBeGreaterThan(launchEffectStart);

    const launchEffect = composerSource.slice(launchEffectStart, staleSourceWatcherStart);
    expect(launchEffect).toContain('[launchRequest?.nonce]');
    expect(launchEffect).not.toContain('library.sources,');
    expect(launchEffect).not.toContain('explicitLaunchTeachingContext\n  ]');

    const staleSourceWatcher = composerSource.slice(staleSourceWatcherStart);
    expect(staleSourceWatcher).toContain('library.sources.some');
    expect(staleSourceWatcher).toContain('La fonte richiesta non è più disponibile.');
    expect(staleSourceWatcher).toContain('Il contesto richiesto non è più disponibile.');
  });

  test('in-flight intent resolution cannot reapply disclosure after source context or message invalidation', () => {
    expect(composerSource).toContain('resolutionEpochRef');
    expect(composerSource).toContain('const resolutionEpoch = ++resolutionEpochRef.current');
    expect(composerSource).toContain('const requestIsCurrent = () => (');
    expect(composerSource).toContain('resolutionEpoch === resolutionEpochRef.current');
    expect(composerSource).toContain('resolutionEpochRef.current += 1');
  });

  test('async intent results validate the current request snapshot after every await', () => {
    expect(composerSource).toContain('currentResolutionSnapshot');
    expect(composerSource).toContain('resolutionSnapshotRef');
    expect(composerSource).toContain('useLayoutEffect');
    expect(composerSource).toContain('selectedSource?.privacy');
    expect(composerSource).toContain('selectedSource?.status');
    expect(composerSource).toContain('teachingContextFingerprint');
    expect(composerSource).toContain('copilotContextFingerprint');
    expect(composerSource).toContain('message.trim()');
    expect(composerSource).toContain('const resolutionSnapshot = currentResolutionSnapshot');
    expect(composerSource).toContain('resolutionSnapshot === resolutionSnapshotRef.current');
    expect(composerSource).toContain('sourceRequest: selectedSource');
    expect(composerSource).toContain('buildLibraryCopilotRequest({');
    expect(composerSource).toContain('message: message.trim(),');
    expect(composerSource).toContain('contextProjection: copilotContextProjection');
    expect(composerSource).toContain('planningContext: resolvedPlanningContext');

    const staleGuards = composerSource.match(/if \(!requestIsCurrent\(\)\) return;/g) ?? [];
    expect(staleGuards.length).toBeGreaterThanOrEqual(5);
    expect(composerSource.indexOf('await interpretCopilotIntent')).toBeLessThan(
      composerSource.indexOf('if (!requestIsCurrent()) return;', composerSource.indexOf('await interpretCopilotIntent'))
    );
    expect(composerSource.indexOf('await routeAgentIntent')).toBeLessThan(
      composerSource.indexOf('if (!requestIsCurrent()) return;', composerSource.indexOf('await routeAgentIntent'))
    );
  });

  test('ambient surface participates in async stale identity without clearing an already-resolved disclosure', () => {
    expect(composerSource).toContain('copilotContextFingerprint');
    expect(composerSource).toContain('contextProjection: copilotContextProjection');
    expect(composerSource).toContain('[selectedSourceId, teachingContextFingerprint, directPrepareLaunchIsBound]');
    expect(composerSource).not.toContain('[selectedSourceId, teachingContextFingerprint, directPrepareLaunchIsBound, copilotContextFingerprint]');
  });

  test('LibrarySourceCard is no longer a second transformation engine', () => {
    expect(sourceCardSource).not.toContain("import { LibraryProposalPanel } from './LibraryProposalPanel'");
    expect(sourceCardSource).not.toContain('resolveLibraryContextActions');
    expect(sourceCardSource).not.toContain('dispatchLibraryContextAction');
    expect(sourceCardSource).not.toContain('<LibraryProposalPanel');
  });
});