import { describe, expect, test } from 'bun:test';
import {
  SecureAppStorage,
  decideVaultBootstrap,
  type SecureMeta,
  type VaultBootstrapInput
} from './secureAppStorage';
import { SecureVault } from './secureVault';
import type { VaultStore } from './vaultStore';
import type { UdaRecord } from '../types';
import type { LibraryStateV1 } from '../library/types';
import type { EncryptedVaultRecord, VaultMetadataV1, VaultRecordKey } from './vaultTypes';

class MemoryVaultStore implements VaultStore {
  private metadata: VaultMetadataV1 | null = null;
  private readonly records = new Map<VaultRecordKey, EncryptedVaultRecord>();
  readonly batchKeys: VaultRecordKey[][] = [];
  rejectNextBatch = false;

  async getMetadata(): Promise<VaultMetadataV1 | null> { return this.metadata; }
  async putMetadata(metadata: VaultMetadataV1): Promise<void> { this.metadata = metadata; }
  async getRecord(key: VaultRecordKey): Promise<EncryptedVaultRecord | null> { return this.records.get(key) ?? null; }
  async putRecord(record: EncryptedVaultRecord): Promise<void> { this.records.set(record.recordKey as VaultRecordKey, record); }
  async putRecords(records: EncryptedVaultRecord[]): Promise<void> {
    this.batchKeys.push(records.map(record => record.recordKey as VaultRecordKey));
    if (this.rejectNextBatch) {
      this.rejectNextBatch = false;
      throw new Error('synthetic batch failure');
    }
    records.forEach(record => this.records.set(record.recordKey as VaultRecordKey, record));
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

function bootstrap(overrides: Partial<VaultBootstrapInput>): VaultBootstrapInput {
  return {
    metadataState: null,
    hasLegacyData: false,
    indexedDbAvailable: true,
    webCryptoAvailable: true,
    ...overrides
  };
}

describe('SEC-1 vault bootstrap decision', () => {
  test('routes legacy installations to migration before rendering data', () => {
    expect(decideVaultBootstrap(bootstrap({ hasLegacyData: true }))).toBe('MIGRATION_REQUIRED');
  });

  test('routes fresh installations to secure setup', () => {
    expect(decideVaultBootstrap(bootstrap({ hasLegacyData: false }))).toBe('SETUP_REQUIRED');
  });

  test('requires unlock for active vaults and rejects leftover staging vaults', () => {
    expect(decideVaultBootstrap(bootstrap({ metadataState: 'ACTIVE' }))).toBe('LOCKED');
    expect(decideVaultBootstrap(bootstrap({ metadataState: 'STAGING' }))).toBe('ERROR');
  });

  test('fails closed when IndexedDB or Web Crypto is unavailable', () => {
    expect(decideVaultBootstrap(bootstrap({ indexedDbAvailable: false }))).toBe('ERROR');
    expect(decideVaultBootstrap(bootstrap({ webCryptoAvailable: false }))).toBe('ERROR');
  });
});

describe('SEC-1 secure application storage', () => {
  test('persists legacy planning and loads all logical datasets through the vault with planning normalized to v2', async () => {
    const vault = new SecureVault(new MemoryVaultStore());
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);

    await storage.saveAppData({ classes: [], currentClassId: null });
    await storage.saveSettings({ school: 'IC', year: '2026/27', teacher: 'Docente', subject: 'Tecnologia', theme: 'cyan' });
    await storage.saveUdas([]);
    await storage.saveCustomTests({});
    await storage.saveSubmissions([]);
    await (storage as any).savePlanning(emptyPlanning);
    await storage.saveLibrary({ schemaVersion: 1, sources: [] });
    await storage.saveMeta({ changes: 2, lastBackup: null });

    const snapshot = await storage.loadSnapshot();

    expect(snapshot.appData).toEqual({ classes: [], currentClassId: null });
    expect(snapshot.settings?.teacher).toBe('Docente');
    expect(snapshot.udas).toEqual([]);
    expect(snapshot.customTests).toEqual({});
    expect(snapshot.submissions).toEqual([]);
    expect(snapshot.planning).toEqual(normalizedEmptyPlanning);
    expect(snapshot.library).toEqual({ schemaVersion: 1, sources: [] });
    expect(snapshot.meta).toEqual({ changes: 2, lastBackup: null });
  });

  test('commits appData and meta through one vault batch', async () => {
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);

    await storage.saveAppDataAndMeta(
      { classes: [], currentClassId: null },
      { changes: 3, lastBackup: null }
    );

    const snapshot = await storage.loadSnapshot();
    expect(snapshot.appData).toEqual({ classes: [], currentClassId: null });
    expect(snapshot.meta).toEqual({ changes: 3, lastBackup: null });
    expect(store.batchKeys).toEqual([['appData', 'meta']]);
  });

  test('commits library and meta through one vault batch', async () => {
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);

    await storage.saveLibraryAndMeta(
      { schemaVersion: 1, sources: [] },
      { changes: 4, lastBackup: null }
    );

    const snapshot = await storage.loadSnapshot();
    expect(snapshot.library).toEqual({ schemaVersion: 1, sources: [] });
    expect(snapshot.meta).toEqual({ changes: 4, lastBackup: null });
    expect(store.batchKeys).toEqual([['library', 'meta']]);
  });

  test('commits library UDA and meta through one vault batch', async () => {
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault) as SecureAppStorage & {
      saveLibraryUdasAndMeta?: (
        library: LibraryStateV1,
        udas: UdaRecord[],
        meta: SecureMeta
      ) => Promise<void>;
    };

    expect(typeof storage.saveLibraryUdasAndMeta).toBe('function');
    if (!storage.saveLibraryUdasAndMeta) return;

    const library: LibraryStateV1 = { schemaVersion: 1, sources: [] };
    const udas: UdaRecord[] = [{
      id: 'uda-energy',
      title: 'Energia',
      className: '3ª A',
      hours: 1,
      period: 'Q1',
      startMonth: 0,
      durationMonths: 1,
      lessons: [],
      dependencies: []
    }];
    const meta: SecureMeta = { changes: 5, lastBackup: null };

    await storage.saveLibraryUdasAndMeta(library, udas, meta);

    const snapshot = await storage.loadSnapshot();
    expect(snapshot.library).toEqual(library);
    expect(snapshot.udas).toEqual(udas);
    expect(snapshot.meta).toEqual(meta);
    expect(store.batchKeys).toEqual([['library', 'udas', 'meta']]);
  });

  test('propagates a rejected compound batch without writing partial library or UDA state', async () => {
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault) as SecureAppStorage & {
      saveLibraryUdasAndMeta?: (
        library: LibraryStateV1,
        udas: UdaRecord[],
        meta: SecureMeta
      ) => Promise<void>;
    };

    expect(typeof storage.saveLibraryUdasAndMeta).toBe('function');
    if (!storage.saveLibraryUdasAndMeta) return;

    await storage.saveLibrary({ schemaVersion: 1, sources: [] });
    await storage.saveUdas([]);
    await storage.saveMeta({ changes: 4, lastBackup: null });
    store.batchKeys.length = 0;
    store.rejectNextBatch = true;

    await expect(storage.saveLibraryUdasAndMeta(
      { schemaVersion: 1, sources: [] },
      [{
        id: 'uda-energy',
        title: 'Energia',
        className: '3ª A',
        hours: 1,
        period: 'Q1',
        startMonth: 0,
        durationMonths: 1,
        lessons: [],
        dependencies: []
      }],
      { changes: 5, lastBackup: null }
    )).rejects.toThrow('synthetic batch failure');

    const snapshot = await storage.loadSnapshot();
    expect(snapshot.library).toEqual({ schemaVersion: 1, sources: [] });
    expect(snapshot.udas).toEqual([]);
    expect(snapshot.meta).toEqual({ changes: 4, lastBackup: null });
    expect(store.batchKeys).toEqual([['library', 'udas', 'meta']]);
  });

  test('strips embedding API keys on settings persistence', async () => {
    const vault = new SecureVault(new MemoryVaultStore());
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);

    await storage.saveSettings({
      school: 'IC',
      year: '2026/27',
      teacher: 'Docente',
      subject: 'Tecnologia',
      theme: 'cyan',
      embeddingConfig: {
        provider: 'local',
        endpointUrl: 'http://127.0.0.1:8080',
        modelName: 'model.gguf',
        apiType: 'llama.cpp',
        enabled: true,
        apiKey: 'must-not-persist'
      }
    });

    expect((await storage.loadSnapshot()).settings?.embeddingConfig?.apiKey).toBeUndefined();
  });
});
