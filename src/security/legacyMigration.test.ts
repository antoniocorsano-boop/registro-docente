import { describe, expect, test } from 'bun:test';
import {
  buildMigrationInvariants,
  collectLegacySnapshot,
  migrateLegacyToVault,
  sanitizeLegacySnapshot,
  validateLegacySnapshot,
  type KeyValueStorage
} from './legacyMigration';
import { SecureVault } from './secureVault';
import type { VaultStore } from './vaultStore';
import type { EncryptedVaultRecord, VaultMetadataV1, VaultRecordKey } from './vaultTypes';
import {
  CUSTOM_TESTS_KEY,
  META_KEY,
  SETTINGS_KEY,
  STORAGE_KEY,
  SUBMISSIONS_KEY,
  UDA_KEY
} from '../utils';

class MemoryLegacyStorage implements KeyValueStorage {
  readonly removed: string[] = [];
  constructor(private readonly values = new Map<string, string>()) {}

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.removed.push(key);
    this.values.delete(key);
  }
}

class MemoryVaultStore implements VaultStore {
  private metadata: VaultMetadataV1 | null = null;
  private readonly records = new Map<VaultRecordKey, EncryptedVaultRecord>();

  async getMetadata(): Promise<VaultMetadataV1 | null> {
    return this.metadata;
  }

  async putMetadata(metadata: VaultMetadataV1): Promise<void> {
    this.metadata = metadata;
  }

  async getRecord(key: VaultRecordKey): Promise<EncryptedVaultRecord | null> {
    return this.records.get(key) ?? null;
  }

  async putRecord(record: EncryptedVaultRecord): Promise<void> {
    this.records.set(record.recordKey as VaultRecordKey, record);
  }

  async deleteRecord(key: VaultRecordKey): Promise<void> {
    this.records.delete(key);
  }

  async listRecordKeys(): Promise<VaultRecordKey[]> {
    return [...this.records.keys()];
  }

  async clearAll(): Promise<void> {
    this.metadata = null;
    this.records.clear();
  }
}

class FailingVault extends SecureVault {
  private writes = 0;

  constructor(store: VaultStore, private readonly failAfterWrites: number) {
    super(store);
  }

  override async put<T>(key: VaultRecordKey, value: T, schemaVersion = 1): Promise<void> {
    this.writes += 1;
    if (this.writes > this.failAfterWrites) {
      throw new Error('Injected migration write failure.');
    }
    await super.put(key, value, schemaVersion);
  }
}

class CorruptingReadbackVault extends SecureVault {
  override async get<T>(key: VaultRecordKey): Promise<T | null> {
    const value = await super.get<T>(key);
    if (key === 'appData' && value && typeof value === 'object') {
      return { ...(value as Record<string, unknown>), classes: [] } as T;
    }
    return value;
  }
}

function makeMigrationStorage(): MemoryLegacyStorage {
  return new MemoryLegacyStorage(
    new Map([
      [STORAGE_KEY, JSON.stringify({
        classes: [
          {
            id: '2c',
            name: '2C',
            students: [{ id: 's1', name: 'Mario Rossi' }],
            grades: [{ id: 'g1', studentId: 's1' }],
            behaviors: [{ id: 'b1', studentId: 's1' }]
          }
        ],
        currentClassId: '2c'
      })],
      [SETTINGS_KEY, JSON.stringify({
        teacher: 'Docente',
        embeddingConfig: {
          provider: 'local',
          apiKey: 'must-not-migrate'
        }
      })],
      [UDA_KEY, JSON.stringify([{ id: 'u1' }])],
      [SUBMISSIONS_KEY, JSON.stringify([{ id: 'sub1' }])],
      [CUSTOM_TESTS_KEY, JSON.stringify({ t1: { id: 't1' } })],
      [META_KEY, JSON.stringify({ changes: 3, lastBackup: null })]
    ])
  );
}

describe('SEC-1 legacy snapshot', () => {
  test('fails closed on malformed JSON without deleting legacy data', () => {
    const storage = new MemoryLegacyStorage(new Map([[STORAGE_KEY, '{not-json']]));

    expect(() => collectLegacySnapshot(storage)).toThrow('JSON');
    expect(storage.removed).toEqual([]);
  });

  test('accepts missing optional legacy keys and identifies present datasets', () => {
    const storage = new MemoryLegacyStorage(
      new Map([
        [STORAGE_KEY, JSON.stringify({ classes: [], currentClassId: null })],
        [SETTINGS_KEY, JSON.stringify({ teacher: 'Docente' })]
      ])
    );

    const snapshot = collectLegacySnapshot(storage);
    const validation = validateLegacySnapshot(snapshot);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(snapshot.presentKeys).toEqual([STORAGE_KEY, SETTINGS_KEY]);
    expect(snapshot.customTests).toBeUndefined();
    expect(snapshot.udas).toBeUndefined();
    expect(snapshot.submissions).toBeUndefined();
    expect(snapshot.meta).toBeUndefined();
  });

  test('computes migration invariants for personal and professional datasets', () => {
    const storage = new MemoryLegacyStorage(
      new Map([
        [STORAGE_KEY, JSON.stringify({
          classes: [
            {
              id: '2c',
              name: '2C',
              students: [{ id: 's1', name: 'Mario Rossi' }, { id: 's2', name: 'Anna Verdi' }],
              grades: [{ id: 'g1', studentId: 's1' }, { id: 'g2', studentId: 's2' }],
              behaviors: [{ id: 'b1', studentId: 's1' }]
            }
          ],
          currentClassId: '2c'
        })],
        [SUBMISSIONS_KEY, JSON.stringify([{ id: 'sub1' }, { id: 'sub2' }])],
        [UDA_KEY, JSON.stringify([{ id: 'u1' }])],
        [CUSTOM_TESTS_KEY, JSON.stringify({ t1: { id: 't1' } })],
        [META_KEY, JSON.stringify({ changes: 3, lastBackup: null })]
      ])
    );

    const invariants = buildMigrationInvariants(collectLegacySnapshot(storage));

    expect(invariants).toEqual({
      classes: 1,
      students: 2,
      grades: 2,
      behaviors: 1,
      submissions: 2,
      udas: 1
    });
  });

  test('strips embedding API keys without mutating the legacy snapshot', () => {
    const storage = new MemoryLegacyStorage(
      new Map([
        [SETTINGS_KEY, JSON.stringify({
          teacher: 'Docente',
          embeddingConfig: {
            provider: 'local',
            endpointUrl: 'http://127.0.0.1:8080',
            modelName: 'model.gguf',
            apiType: 'llama.cpp',
            enabled: true,
            apiKey: 'legacy-secret'
          }
        })]
      ])
    );

    const snapshot = collectLegacySnapshot(storage);
    const sanitized = sanitizeLegacySnapshot(snapshot);

    expect(sanitized.settings?.embeddingConfig?.apiKey).toBeUndefined();
    expect(snapshot.settings?.embeddingConfig?.apiKey).toBe('legacy-secret');
  });
});

describe('SEC-1 verify-before-delete migration', () => {
  test('activates only after encrypted readback matches invariants, then removes legacy keys', async () => {
    const storage = makeMigrationStorage();
    const vaultStore = new MemoryVaultStore();
    const vault = new SecureVault(vaultStore);

    const result = await migrateLegacyToVault(storage, vault, 'teacher-password');

    expect(result.invariants).toEqual({
      classes: 1,
      students: 1,
      grades: 1,
      behaviors: 1,
      submissions: 1,
      udas: 1
    });
    expect((await vaultStore.getMetadata())?.state).toBe('ACTIVE');
    expect(storage.removed.sort()).toEqual([
      CUSTOM_TESTS_KEY,
      META_KEY,
      SETTINGS_KEY,
      STORAGE_KEY,
      SUBMISSIONS_KEY,
      UDA_KEY
    ].sort());
    expect((await vault.get<Record<string, any>>('settings'))?.embeddingConfig?.apiKey).toBeUndefined();
  });

  test('write failure leaves all legacy keys intact and discards staging vault', async () => {
    const storage = makeMigrationStorage();
    const vaultStore = new MemoryVaultStore();
    const vault = new FailingVault(vaultStore, 1);

    await expect(migrateLegacyToVault(storage, vault, 'teacher-password')).rejects.toThrow('Injected');

    expect(storage.removed).toEqual([]);
    expect(await vaultStore.getMetadata()).toBeNull();
    expect(await vaultStore.listRecordKeys()).toEqual([]);
  });

  test('readback mismatch leaves legacy keys intact and discards staging vault', async () => {
    const storage = makeMigrationStorage();
    const vaultStore = new MemoryVaultStore();
    const vault = new CorruptingReadbackVault(vaultStore);

    await expect(migrateLegacyToVault(storage, vault, 'teacher-password')).rejects.toThrow('Readback');

    expect(storage.removed).toEqual([]);
    expect(await vaultStore.getMetadata()).toBeNull();
    expect(await vaultStore.listRecordKeys()).toEqual([]);
  });
});
