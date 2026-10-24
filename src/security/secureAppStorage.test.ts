import { describe, expect, test } from 'bun:test';
import {
  SecureAppStorage,
  decideVaultBootstrap,
  type VaultBootstrapInput
} from './secureAppStorage';
import { SecureVault } from './secureVault';
import type { VaultStore } from './vaultStore';
import type { EncryptedVaultRecord, VaultMetadataV1, VaultRecordKey } from './vaultTypes';

class MemoryVaultStore implements VaultStore {
  private metadata: VaultMetadataV1 | null = null;
  private readonly records = new Map<VaultRecordKey, EncryptedVaultRecord>();
  readonly batchKeys: VaultRecordKey[][] = [];

  async getMetadata(): Promise<VaultMetadataV1 | null> { return this.metadata; }
  async putMetadata(metadata: VaultMetadataV1): Promise<void> { this.metadata = metadata; }
  async getRecord(key: VaultRecordKey): Promise<EncryptedVaultRecord | null> { return this.records.get(key) ?? null; }
  async putRecord(record: EncryptedVaultRecord): Promise<void> { this.records.set(record.recordKey as VaultRecordKey, record); }
  async putRecords(records: EncryptedVaultRecord[]): Promise<void> {
    this.batchKeys.push(records.map(record => record.recordKey as VaultRecordKey));
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
  test('persists and loads all seven logical datasets through the vault', async () => {
    const vault = new SecureVault(new MemoryVaultStore());
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);

    await storage.saveAppData({ classes: [], currentClassId: null });
    await storage.saveSettings({ school: 'IC', year: '2026/27', teacher: 'Docente', subject: 'Tecnologia', theme: 'cyan' });
    await storage.saveUdas([]);
    await storage.saveCustomTests({});
    await storage.saveSubmissions([]);
    await storage.savePlanning(emptyPlanning);
    await storage.saveMeta({ changes: 2, lastBackup: null });

    const snapshot = await storage.loadSnapshot();

    expect(snapshot.appData).toEqual({ classes: [], currentClassId: null });
    expect(snapshot.settings?.teacher).toBe('Docente');
    expect(snapshot.udas).toEqual([]);
    expect(snapshot.customTests).toEqual({});
    expect(snapshot.submissions).toEqual([]);
    expect(snapshot.planning).toEqual(emptyPlanning);
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
