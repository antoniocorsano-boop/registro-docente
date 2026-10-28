import { describe, expect, test } from 'bun:test';
import type { CopilotMissionExecutionGrantV1, CopilotMissionV1 } from '../copilot/mission';

async function loadMissionBridge() {
  return import('../components/CopilotMissionBridge');
}

describe('AIC-07 mission grant replay behavior', () => {
  test('reusing a launch nonce is blocked only inside the same execution grant, while a fresh Resume grant may reuse it', async () => {
    const bridge = await loadMissionBridge();
    expect(typeof bridge.claimMissionLaunch).toBe('function');

    const claimMissionLaunch = bridge.claimMissionLaunch as (
      missionId: string,
      nonce: number,
      grantToken: string
    ) => boolean;

    expect(claimMissionLaunch('mission-1', 1, 'grant-play')).toBe(true);
    expect(claimMissionLaunch('mission-1', 1, 'grant-play')).toBe(false);

    expect(claimMissionLaunch('mission-1', 1, 'grant-resume')).toBe(true);
    expect(claimMissionLaunch('mission-1', 1, 'grant-resume')).toBe(false);
  });

  test('runtime authorization expires before proposal generation and rejects out-of-scope steps', async () => {
    const bridge = await loadMissionBridge();
    expect(typeof bridge.assertMissionRuntimeExecutionAuthorized).toBe('function');

    const mission: CopilotMissionV1 = {
      schemaVersion: 1,
      id: 'mission-runtime-1',
      opportunityId: 'opportunity-runtime-1',
      kind: 'prepare-current-lesson',
      goal: 'Prepara la lezione',
      contextRef: { className: '2C', udaId: 'uda-1', lessonId: 'lesson-1', sourceId: 'source-1' },
      sourceRefs: ['source-1'],
      allowedCapabilities: ['prepare'],
      expectedOutputs: [{ kind: 'activity', label: 'Proposta' }],
      authority: { persistentProfessionalWrite: false, externalAction: false, scopeExpansion: false },
      budgetProfile: 'balanced',
      createdAt: '2026-10-28T12:00:00.000Z',
      contextFingerprint: 'aic07:runtime-1',
      semanticExpiry: { kind: 'context' },
      status: 'authorized'
    };
    const grant: CopilotMissionExecutionGrantV1 = {
      schemaVersion: 1,
      token: 'grant-runtime-1',
      missionId: mission.id,
      contextFingerprint: mission.contextFingerprint,
      issuedAt: '2026-10-28T12:00:00.000Z',
      expiresAt: '2026-10-28T12:15:00.000Z'
    };

    bridge.bindMissionRuntime(mission, grant);
    const allowedStep = {
      capability: 'prepare', className: '2C', udaId: 'uda-1', lessonId: 'lesson-1', sourceIds: ['source-1']
    };
    expect(() => bridge.assertMissionRuntimeExecutionAuthorized(mission.id, allowedStep, '2026-10-28T12:14:59.000Z')).not.toThrow();
    expect(() => bridge.assertMissionRuntimeExecutionAuthorized(mission.id, allowedStep, '2026-10-28T12:15:01.000Z')).toThrow();
    expect(() => bridge.assertMissionRuntimeExecutionAuthorized(mission.id, { ...allowedStep, capability: 'review' }, '2026-10-28T12:05:00.000Z')).toThrow();
    expect(() => bridge.assertMissionRuntimeExecutionAuthorized(mission.id, { ...allowedStep, className: '2A' }, '2026-10-28T12:05:00.000Z')).toThrow();
  });

  test('runtime authorization rejects material drift that happens after Play and before proposal generation', async () => {
    const bridge = await loadMissionBridge();
    const mission: CopilotMissionV1 = {
      schemaVersion: 1,
      id: 'mission-runtime-drift',
      opportunityId: 'opportunity-runtime-drift',
      kind: 'prepare-current-lesson',
      goal: 'Prepara la lezione',
      contextRef: { className: '2C', udaId: 'uda-1', lessonId: 'lesson-1', sourceId: 'source-1' },
      sourceRefs: ['source-1'],
      allowedCapabilities: ['prepare'],
      expectedOutputs: [{ kind: 'activity', label: 'Proposta' }],
      authority: { persistentProfessionalWrite: false, externalAction: false, scopeExpansion: false },
      budgetProfile: 'balanced',
      createdAt: '2026-10-28T12:00:00.000Z',
      contextFingerprint: 'aic07:material-before-play',
      semanticExpiry: { kind: 'context' },
      status: 'authorized'
    };
    const grant: CopilotMissionExecutionGrantV1 = {
      schemaVersion: 1,
      token: 'grant-runtime-drift',
      missionId: mission.id,
      contextFingerprint: mission.contextFingerprint,
      issuedAt: '2026-10-28T12:00:00.000Z',
      expiresAt: '2026-10-28T12:15:00.000Z'
    };
    const allowedStep = {
      capability: 'prepare', className: '2C', udaId: 'uda-1', lessonId: 'lesson-1', sourceIds: ['source-1']
    };
    bridge.bindMissionRuntime(mission, grant);
    const assertRuntime = bridge.assertMissionRuntimeExecutionAuthorized as unknown as (
      missionId: string,
      step: typeof allowedStep,
      currentContextFingerprint: string,
      now: string
    ) => void;

    expect(() => assertRuntime(
      mission.id,
      allowedStep,
      mission.contextFingerprint,
      '2026-10-28T12:05:00.000Z'
    )).not.toThrow();
    expect(() => assertRuntime(
      mission.id,
      allowedStep,
      'aic07:material-after-play',
      '2026-10-28T12:05:00.000Z'
    )).toThrow();
  });

  test('mission PREPARE runtime revalidates authority at the real generation boundary', async () => {
    const [composer, panel] = await Promise.all([
      Bun.file(new URL('../components/LibraryCopilotComposer.tsx', import.meta.url)).text(),
      Bun.file(new URL('../components/LibraryProposalPanel.tsx', import.meta.url)).text()
    ]);
    expect(composer).toContain('assertMissionRuntimeExecutionAuthorized');
    expect(composer).toContain('buildMissionContextFingerprint');
    expect(panel).toContain('assertMissionRuntimeExecutionAuthorized');
    expect(panel).toContain('generationMissionId');
    expect(panel).toContain('generationContextFingerprint');
  });

});
