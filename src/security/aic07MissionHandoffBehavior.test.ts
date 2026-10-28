import { describe, expect, test } from 'bun:test';

const APP = new URL('../App.tsx', import.meta.url);
const LAUNCH = new URL('../library/copilotLaunchContext.ts', import.meta.url);
const BRIDGE = new URL('../components/CopilotMissionBridge.tsx', import.meta.url);
const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);
const SERVICE = new URL('../services/libraryProposalService.ts', import.meta.url);
const PANEL = new URL('../components/LibraryProposalPanel.tsx', import.meta.url);

describe('AIC-07 mission Play handoff', () => {
  test('extends the existing Copilot launch request with bounded mission metadata only', async () => {
    const launch = await Bun.file(LAUNCH).text();
    expect(launch).toContain('mission?:');
    expect(launch).toContain('missionId: string');
    expect(launch).toContain('objective: string');
    expect(launch).not.toContain('provider');
    expect(launch).not.toContain('remoteConsent');
  });

  test('Play durably persists mission before issuing the in-memory grant and launching the existing Composer', async () => {
    const app = await Bun.file(APP).text();
    const start = app.indexOf('const handleStartCopilotMission');
    expect(start).toBeGreaterThan(-1);
    const fragment = app.slice(start, start + 3600);
    expect(fragment).toContain('authorizeCopilotMission');
    expect(fragment).toContain('appendCopilotMission');
    expect(fragment).toContain("signal: 'play'");
    expect(fragment).toContain('await commitCopilotStateMutation');
    expect(fragment).toContain('missionExecutionGrantsRef.current.set');
    expect(fragment).toContain('bindMissionRuntime');
    expect(fragment).toContain('openLibraryCopilot');
    expect(fragment.indexOf('await commitCopilotStateMutation')).toBeLessThan(fragment.indexOf('missionExecutionGrantsRef.current.set'));
    expect(fragment.indexOf('missionExecutionGrantsRef.current.set')).toBeLessThan(fragment.indexOf('bindMissionRuntime'));
    expect(fragment.indexOf('bindMissionRuntime')).toBeLessThan(fragment.indexOf('openLibraryCopilot'));
    expect(fragment).not.toContain('requestLibraryTeachingProposal');
    expect(fragment).not.toContain('fetch(');
  });

  test('session-only mission bridge reuses the exact existing form-submit path instead of a direct provider route', async () => {
    expect(await Bun.file(BRIDGE).exists()).toBe(true);
    const bridge = await Bun.file(BRIDGE).text();
    expect(bridge).toContain('launchRequest?.mission');
    expect(bridge).toContain('requestSubmit()');
    expect(bridge).toContain('copilot-message');
    expect(bridge).not.toContain('requestLibraryTeachingProposal');
    expect(bridge).not.toContain("fetch('/api/copilot/library-proposal'");
  });

  test('PREPARE keeps existing privacy, remote-consent, Core and AIC-06 gates', async () => {
    const [panel, service] = await Promise.all([
      Bun.file(PANEL).text(),
      Bun.file(SERVICE).text()
    ]);
    expect(panel).toContain("source.privacy !== 'teacher-professional'");
    expect(panel).toContain('remoteConsent');
    expect(panel).toContain('resolveLibraryRemoteProposalActions');
    expect(panel).toContain('resolvePrepareBudget');
    expect(panel).toContain('requestLibraryTeachingProposal');
    expect(service).toContain('notifyMissionProposalReady');
  });

  test('ready handler stores only proposal plus bounded runtime receipt and never prompt/provider reasoning', async () => {
    const app = await Bun.file(APP).text();
    const start = app.indexOf('const handleMissionProposalReady');
    expect(start).toBeGreaterThan(-1);
    const fragment = app.slice(start, start + 2200);
    expect(fragment).toContain('proposal');
    expect(fragment).toContain('receipt');
    expect(fragment).toContain("status: 'ready'");
    expect(fragment).not.toContain('promptText');
    expect(fragment).not.toContain('reasoning');
    expect(fragment).not.toContain('chainOfThought');
  });

  test('mission bridge waits for launch source and teaching context readiness before auto-submit', async () => {
    const bridge = await Bun.file(BRIDGE).text();
    expect(bridge).toContain('ready: boolean');
    expect(bridge).toContain('submittedNonceRef.current === launchRequest.nonce');
    expect(bridge).toContain('message.trim() !== mission.objective.trim()');
  });

  test('mission auto-submit waits for the launch nonce to settle after stale-result invalidators', async () => {
    const composer = await Bun.file(COMPOSER).text();
    expect(composer).toContain('missionLaunchSettledNonce');
    expect(composer).toContain('setMissionLaunchSettledNonce(launchRequest.nonce)');
    expect(composer).toContain('missionLaunchBindingsReady');
    expect(composer).toContain('missionLaunchSettledNonce === launchRequest.nonce');
  });

  test('consumes a Play launch beyond bridge remounts and revalidates the bound ephemeral grant before submit', async () => {
    const bridge = await Bun.file(BRIDGE).text();
    expect(bridge).toContain('consumedMissionLaunches');
    expect(bridge).toContain('activeMissionGrants');
    expect(bridge).toContain('isMissionExecutionGrantValid');
    expect(bridge).toContain('missionLaunchKey');
    expect(bridge).toContain('consumedMissionLaunches.has');
    expect(bridge).toContain('consumedMissionLaunches.add');
    expect(bridge).toContain('activeMissionGrants.get(mission.missionId)');
    expect(bridge).toContain('isMissionExecutionGrantValid(');
  });

  test('detaches mission-result attribution when source or teaching context drifts and keeps a second App-side guard', async () => {
    const [composer, panel, app] = await Promise.all([
      Bun.file(COMPOSER).text(),
      Bun.file(PANEL).text(),
      Bun.file(APP).text()
    ]);
    expect(composer).toContain('const boundLaunchMissionId = launchRequest?.mission && missionLaunchBindingsReady');
    expect(composer).toContain('generationMissionId={boundLaunchMissionId}');
    expect(composer).toContain('missionId={readyMissionReview?.missionId ?? boundLaunchMissionId}');
    expect(panel).toContain('generationMissionId?: string;');
    expect(panel).toContain('if (generationMissionId)');
    expect(panel).toContain('missionId: generationMissionId');
    expect(app).toContain('canAcceptMissionProposalResult');
    const handlerStart = app.indexOf('const handleMissionProposalReady');
    expect(handlerStart).toBeGreaterThan(-1);
    const handlerFragment = app.slice(handlerStart, handlerStart + 1800);
    expect(handlerFragment).toContain('canAcceptMissionProposalResult');
    expect(handlerFragment).toContain('copilotStateRef.current.missions.find');
  });
});
