import { describe, expect, test } from 'bun:test';

const APP = new URL('../App.tsx', import.meta.url);
const LAUNCH = new URL('../library/copilotLaunchContext.ts', import.meta.url);
const BRIDGE = new URL('../components/CopilotMissionBridge.tsx', import.meta.url);
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
    expect(bridge).toContain('if (!mission || !ready || submittedNonceRef.current === launchRequest.nonce) return;');
    expect(bridge).toContain('[launchRequest?.nonce, launchRequest?.mission, message, ready]');
  });

});
