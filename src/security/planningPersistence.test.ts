import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SecureAppStorage } from './secureAppStorage';
import { SecureVault } from './secureVault';
import type { VaultStore } from './vaultStore';
import type { EncryptedVaultRecord, VaultMetadataV1, VaultRecordKey } from './vaultTypes';

class PlanningStore implements VaultStore {
  private metadata: VaultMetadataV1 | null = null;
  private readonly records = new Map<VaultRecordKey, EncryptedVaultRecord>();
  readonly batchKeys: string[][] = [];
  failNextBatch = false;

  async getMetadata(): Promise<VaultMetadataV1 | null> { return this.metadata; }
  async putMetadata(metadata: VaultMetadataV1): Promise<void> { this.metadata = metadata; }
  async getRecord(key: VaultRecordKey): Promise<EncryptedVaultRecord | null> { return this.records.get(key) ?? null; }
  async putRecord(record: EncryptedVaultRecord): Promise<void> { await this.putRecords([record]); }
  async putRecords(records: EncryptedVaultRecord[]): Promise<void> {
    this.batchKeys.push(records.map(record => record.recordKey));
    if (this.failNextBatch) {
      this.failNextBatch = false;
      throw new Error('forced planning batch failure');
    }
    for (const record of records) this.records.set(record.recordKey as VaultRecordKey, record);
  }
  async deleteRecord(key: VaultRecordKey): Promise<void> { this.records.delete(key); }
  async listRecordKeys(): Promise<VaultRecordKey[]> { return [...this.records.keys()]; }
  async clearAll(): Promise<void> { this.metadata = null; this.records.clear(); }
}

const emptyPlanning = {
  schemaVersion: 1 as const,
  profiles: [],
  arenaContexts: [],
  resources: [],
  masterPrograms: [],
  classInstances: []
};

const normalizedEmptyPlanning = {
  ...emptyPlanning,
  schemaVersion: 2 as const,
  docenteOsProjections: []
};

function requireMethod<T extends (...args: any[]) => Promise<void>>(storage: SecureAppStorage, name: string): T {
  const method = (storage as unknown as Record<string, unknown>)[name];
  expect(typeof method).toBe('function');
  return (method as T).bind(storage);
}

describe('EDU-PLAN-01A planning persistence', () => {
  test('planning mutation helper applies an execution-time derive callback', async () => {
    const moduleUrl = new URL('../persistence/planningMutation.ts', import.meta.url);
    expect(await Bun.file(moduleUrl).exists()).toBe(true);
    const modulePath = '../persistence/' + 'planningMutation';
    const { applyPlanningMutation } = await import(modulePath);

    const next = applyPlanningMutation(normalizedEmptyPlanning, (current: typeof normalizedEmptyPlanning) => ({
      ...current,
      profiles: [{ id: 'profile-1' }]
    }));

    expect(next.profiles).toEqual([{ id: 'profile-1' }]);
    expect(normalizedEmptyPlanning.profiles).toEqual([]);
  });

  test('normalizes historical encrypted planning v1 to current v2 without fabricating projections', async () => {
    const modulePath = '../planning/' + 'normalizePlanningState';
    const { normalizePlanningState } = await import(modulePath);

    expect(normalizePlanningState(emptyPlanning)).toEqual(normalizedEmptyPlanning);
  });

  test('persists historical planning v1 and reads it back as v2 through the same encrypted vault record', async () => {
    const store = new PlanningStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);
    const savePlanningAndMeta = requireMethod<(planning: any, meta: { changes: number; lastBackup: string | null }) => Promise<void>>(
      storage,
      'savePlanningAndMeta'
    );

    await savePlanningAndMeta(emptyPlanning, { changes: 1, lastBackup: null });
    const snapshot = await storage.loadSnapshot() as unknown as Record<string, unknown>;

    expect(snapshot.planning).toEqual(normalizedEmptyPlanning);
    expect(snapshot.meta).toEqual({ changes: 1, lastBackup: null });
    expect(store.batchKeys.at(-1)).toEqual(['planning', 'meta']);
  });

  test('failed planning batch leaves the previously committed planning state intact', async () => {
    const store = new PlanningStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);
    const savePlanningAndMeta = requireMethod<(planning: any, meta: { changes: number; lastBackup: string | null }) => Promise<void>>(
      storage,
      'savePlanningAndMeta'
    );

    await savePlanningAndMeta(emptyPlanning, { changes: 1, lastBackup: null });
    store.failNextBatch = true;
    await expect(savePlanningAndMeta(
      { ...normalizedEmptyPlanning, profiles: [{ id: 'should-not-commit' }] },
      { changes: 2, lastBackup: null }
    )).rejects.toThrow('forced planning batch failure');

    const snapshot = await storage.loadSnapshot() as unknown as Record<string, any>;
    expect(snapshot.planning).toEqual(normalizedEmptyPlanning);
    expect(snapshot.meta).toEqual({ changes: 1, lastBackup: null });
  });

  test('App initializes missing planning to the canonical empty state and publishes only after savePlanningAndMeta', () => {
    const appSource = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(appSource).toContain("initialSnapshot.planning || createEmptyPlanningState()");
    expect(appSource).toContain('const planningRef = useRef(planning);');
    expect(appSource).toContain('const commitPlanningMutation = useCallback');
    expect(appSource).toContain('savePlanningAndMeta(candidate.planning, candidate.meta)');
    expect(appSource).toContain('planningRef.current = candidate.planning;');
    expect(appSource).toContain('setPlanning(candidate.planning);');
  });
});
