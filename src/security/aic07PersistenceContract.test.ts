import { describe, expect, test } from 'bun:test';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import type { CopilotMissionV1 } from '../copilot/mission';
import type { VaultRecordKey } from './vaultTypes';
import { createBackupPayload, normalizeBackupPayload } from './backupPayload';
import type { CompleteSecureAppSnapshot } from './secureAppStorage';

async function loadState() {
  const stateUrl = new URL('../copilot/state.ts', import.meta.url);
  const emptyUrl = new URL('../copilot/emptyCopilotState.ts', import.meta.url);
  expect(await Bun.file(stateUrl).exists()).toBe(true);
  expect(await Bun.file(emptyUrl).exists()).toBe(true);
  return {
    ...(await import('../copilot/state')),
    ...(await import('../copilot/emptyCopilotState'))
  };
}

async function loadMutation() {
  const url = new URL('../persistence/copilotStateMutation.ts', import.meta.url);
  expect(await Bun.file(url).exists()).toBe(true);
  return import('../persistence/copilotStateMutation');
}

function mission(status: CopilotMissionV1['status'] = 'running'): CopilotMissionV1 {
  return {
    schemaVersion: 1,
    id: 'mission-1',
    opportunityId: 'prepare-current-lesson:uda-1:lesson-1:source-1',
    kind: 'prepare-current-lesson',
    goal: 'Prepara la prossima lezione',
    contextRef: { className: '2C', udaId: 'uda-1', lessonId: 'lesson-1', sourceId: 'source-1' },
    sourceRefs: ['source-1'],
    allowedCapabilities: ['prepare'],
    expectedOutputs: [{ kind: 'activity', label: 'Proposta didattica pronta da controllare' }],
    authority: { persistentProfessionalWrite: false, externalAction: false, scopeExpansion: false },
    budgetProfile: 'balanced',
    createdAt: '2026-10-27T12:00:00.000Z',
    contextFingerprint: 'aic07:1234567890abcdef',
    semanticExpiry: { kind: 'context' },
    status
  };
}

function baseSnapshot(copilotState: any): CompleteSecureAppSnapshot {
  return {
    appData: { classes: [], currentClassId: null },
    settings: { school: 'IC', year: '2026/27', teacher: 'Docente', subject: 'Tecnologia', theme: 'cyan' },
    udas: [],
    customTests: {},
    submissions: [],
    planning: { schemaVersion: 1, profiles: [], arenaContexts: [], resources: [], masterPrograms: [], classInstances: [] },
    library: { schemaVersion: 1, sources: [] },
    professionalMemory: createEmptyProfessionalMemoryState(),
    copilotState,
    meta: { changes: 0, lastBackup: null }
  } as CompleteSecureAppSnapshot;
}

describe('AIC-07 durable supervised Copilot state', () => {
  test('defines a separate empty durable state with no execution grant or remote consent fields', async () => {
    const { createEmptyCopilotState } = await loadState();
    const empty = createEmptyCopilotState();
    expect(empty).toEqual({
      schemaVersion: 1,
      missions: [],
      deferred: [],
      dismissals: [],
      preferences: { schemaVersion: 1, signals: [] }
    });
    expect(JSON.stringify(empty)).not.toContain('grant');
    expect(JSON.stringify(empty)).not.toContain('remoteConsent');
    expect(JSON.stringify(empty)).not.toContain('authorization');
  });

  test('normalizes restored authorized/running missions to suspended and never reconstructs execution authority', async () => {
    const { normalizeLoadedCopilotState } = await loadState();
    const loaded = normalizeLoadedCopilotState({
      schemaVersion: 1,
      missions: [mission('authorized'), { ...mission('running'), id: 'mission-2' }],
      deferred: [],
      dismissals: [],
      preferences: { schemaVersion: 1, signals: [] }
    });
    expect(loaded.missions.map((item: CopilotMissionV1) => item.status)).toEqual(['suspended', 'suspended']);
    expect(JSON.stringify(loaded)).not.toContain('token');
    expect(JSON.stringify(loaded)).not.toContain('expiresAt');
  });

  test('pure mutations update only Copilot state and preference reset is independent', async () => {
    const { createEmptyCopilotState } = await loadState();
    const {
      appendCopilotMission,
      recordCopilotOutcomeSignal,
      resetCopilotStatePreferences,
      archiveCopilotMission
    } = await loadMutation();

    let state = appendCopilotMission(createEmptyCopilotState(), mission('authorized'));
    state = recordCopilotOutcomeSignal(state, {
      id: 'signal-1', opportunityKind: 'prepare-current-lesson', signal: 'used-as-is', occurredAt: '2026-10-27T12:10:00.000Z'
    });
    expect(state.preferences.signals).toHaveLength(1);
    state = resetCopilotStatePreferences(state);
    expect(state.preferences.signals).toHaveLength(0);
    expect(state.missions).toHaveLength(1);
    state = archiveCopilotMission(state, 'mission-1');
    expect(state.missions[0]?.status).toBe('archived');
  });

  test('promotes copilotState to a tenth encrypted Vault record and dedicated atomic save path', async () => {
    const vaultTypes = await Bun.file(new URL('./vaultTypes.ts', import.meta.url)).text();
    const vaultStore = await Bun.file(new URL('./vaultStore.ts', import.meta.url)).text();
    const storage = await Bun.file(new URL('./secureAppStorage.ts', import.meta.url)).text();
    expect(vaultTypes).toContain("| 'copilotState'");
    expect(vaultStore).toContain("'copilotState'");
    expect(storage).toContain("this.vault.get<CopilotStateV1>('copilotState')");
    expect(storage).toContain('saveCopilotStateAndMeta');
    expect(storage).toContain("{ key: 'copilotState', value: copilotState }");
  });

  test('exports backup v6 and normalizes a legacy v5 to empty Copilot state', async () => {
    const { createEmptyCopilotState } = await loadState();
    const current = baseSnapshot(createEmptyCopilotState());
    const payload = createBackupPayload(current, '2026-10-27T12:00:00.000Z') as any;
    expect(payload.backupDataVersion).toBe(6);
    expect(payload.snapshot.copilotState).toEqual(createEmptyCopilotState());

    const { copilotState: _copilotState, ...v5Snapshot } = current as any;
    const normalized = normalizeBackupPayload({
      app: 'registro-docente',
      backupDataVersion: 5,
      exportedAt: '2026-10-26T12:00:00.000Z',
      snapshot: v5Snapshot
    }, current) as any;
    expect(normalized.copilotState).toEqual(createEmptyCopilotState());
  });

  test('VaultRecordKey type accepts copilotState at compile time', () => {
    const key: VaultRecordKey = 'copilotState';
    expect(key).toBe('copilotState');
  });
});
