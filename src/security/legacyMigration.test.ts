import { describe, expect, test } from 'bun:test';
import {
  buildMigrationInvariants,
  collectLegacySnapshot,
  cleanupVerifiedLegacyAfterActivation,
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

  async putRecords(records: EncryptedVaultRecord[]): Promise<void> {
    for (const record of records) await this.putRecord(record);
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

describe('SEC-1 post-activation legacy cleanup recovery', () => {
  async function createMatchingActiveVault(storage: MemoryLegacyStorage): Promise<SecureVault> {
    const snapshot = sanitizeLegacySnapshot(collectLegacySnapshot(storage));
    const vault = new SecureVault(new MemoryVaultStore());
    await vault.initializeActive('teacher-password');
    if (snapshot.appData !== undefined) await vault.put('appData', snapshot.appData);
    if (snapshot.settings !== undefined) await vault.put('settings', snapshot.settings);
    if (snapshot.udas !== undefined) await vault.put('udas', snapshot.udas);
    if (snapshot.customTests !== undefined) await vault.put('customTests', snapshot.customTests);
    if (snapshot.submissions !== undefined) await vault.put('submissions', snapshot.submissions);
    if (snapshot.meta !== undefined) await vault.put('meta', snapshot.meta);
    return vault;
  }

  test('removes residual legacy plaintext only after it matches the unlocked ACTIVE vault', async () => {
    const storage = makeMigrationStorage();
    const vault = await createMatchingActiveVault(storage);

    const removed = await cleanupVerifiedLegacyAfterActivation(storage, vault);

    expect(removed.sort()).toEqual([
      CUSTOM_TESTS_KEY,
      META_KEY,
      SETTINGS_KEY,
      STORAGE_KEY,
      SUBMISSIONS_KEY,
      UDA_KEY
    ].sort());
    expect(storage.removed.sort()).toEqual(removed.sort());
  });

  test('leaves every residual legacy key intact when any plaintext value mismatches the ACTIVE vault', async () => {
    const storage = makeMigrationStorage();
    const vault = await createMatchingActiveVault(storage);
    await vault.put('appData', { classes: [], currentClassId: null });

    await expect(cleanupVerifiedLegacyAfterActivation(storage, vault)).rejects.toThrow(/residuo|coerente|match/i);
    expect(storage.removed).toEqual([]);
  });
});

// Test-only call adapters keep the RED compilation valid before production
// accepts revocable callbacks. GREEN must implement the real 4th parameter.
const migrateRevocable = migrateLegacyToVault as unknown as (
  source: KeyValueStorage, vault: SecureVault, password: string, assertCurrent: () => void
) => ReturnType<typeof migrateLegacyToVault>;
const cleanupRevocable = cleanupVerifiedLegacyAfterActivation as unknown as (
  source: KeyValueStorage, vault: SecureVault, assertCurrent: () => void
) => ReturnType<typeof cleanupVerifiedLegacyAfterActivation>;

describe('S-R02 revocable candidate legacy migration', () => {
  const password = 'synthetic-legacy-revocation-only';
  function authorization() {
    let revoked = false;
    return { revoke: () => { revoked = true; }, assert: () => {
      if (revoked) throw new Error('Sessione revocata.');
    } };
  }

  test('F3-CPL-03: authority revoked at the post-PBKDF2 boundary cannot reserve STAGING', async () => {
    const source = makeMigrationStorage();
    const original = collectLegacySnapshot(source);
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);
    let checks = 0;
    let revoked = false;
    const assertAuthorized = () => {
      checks++;
      // Two migration checks precede createStaging. Inside createStaging,
      // check 6 immediately follows PBKDF2 and precedes metadata reservation.
      if (checks === 6) revoked = true;
      if (revoked) throw new Error('Sessione revocata durante PBKDF2.');
    };

    await expect(migrateRevocable(source, vault, password, assertAuthorized))
      .rejects.toThrow('Sessione revocata durante PBKDF2.');
    expect(checks).toBe(6);
    expect(collectLegacySnapshot(source)).toEqual(original);
    expect(source.removed).toEqual([]);
    expect(await store.getMetadata()).toBeNull();
    expect(await store.listRecordKeys()).toEqual([]);
    expect(vault.isUnlocked()).toBe(false);
  });

  test('revocation after an encrypted write and before activation preserves source and removes only own staging', async () => {
    const source = makeMigrationStorage();
    const store = new MemoryVaultStore();
    const auth = authorization();
    class RevokingVault extends SecureVault {
      override async put<T>(key: VaultRecordKey, value: T, schemaVersion = 1) {
        await super.put(key, value, schemaVersion);
        auth.revoke();
      }
    }
    const vault = new RevokingVault(store);
    await expect(migrateRevocable(source, vault, password, auth.assert)).rejects.toThrow('Sessione revocata');
    expect(source.removed).toEqual([]);
    expect(collectLegacySnapshot(source).presentKeys).toHaveLength(6);
    expect(await store.getMetadata()).toBeNull();
    expect(await store.listRecordKeys()).toEqual([]);
    expect(vault.isUnlocked()).toBe(false);
    const fresh = new SecureVault(store);
    await migrateRevocable(source, fresh, password, authorization().assert);
    expect((await store.getMetadata())?.state).toBe('ACTIVE');
    expect(source.removed).toHaveLength(6);
  });

  test('S-R05 revocation inside activation metadata read never invokes ACTIVE write', async () => {
    const source = makeMigrationStorage();
    const before = collectLegacySnapshot(source);
    const auth = authorization();
    class ActivationReadStore extends MemoryVaultStore {
      activeWrites = 0;
      override async getMetadata() {
        const value = await super.getMetadata();
        if (value?.state === 'STAGING') auth.revoke();
        return value;
      }
      override async putMetadata(metadata: VaultMetadataV1) {
        if (metadata.state === 'ACTIVE') this.activeWrites++;
        await super.putMetadata(metadata);
      }
    }
    const store = new ActivationReadStore();
    const vault = new SecureVault(store);
    await expect(migrateRevocable(source, vault, password, auth.assert)).rejects.toThrow('Sessione revocata');
    expect(store.activeWrites).toBe(0);
    expect(collectLegacySnapshot(source)).toEqual(before);
    expect(source.removed).toEqual([]);
    expect(await store.getMetadata()).toBeNull();
    expect(await store.listRecordKeys()).toEqual([]);
    expect(vault.isUnlocked()).toBe(false);
  });

  test('S-R05 changed source during activation metadata read refuses ACTIVE write', async () => {
    const values = new Map([[STORAGE_KEY, JSON.stringify({classes: [], currentClassId: null})]]);
    const source = new MemoryLegacyStorage(values);
    class ChangedSourceStore extends MemoryVaultStore {
      activeWrites = 0;
      override async getMetadata() {
        const value = await super.getMetadata();
        if (value?.state === 'STAGING') values.set(STORAGE_KEY, JSON.stringify({classes: [], currentClassId: 'synthetic-change'}));
        return value;
      }
      override async putMetadata(metadata: VaultMetadataV1) {
        if (metadata.state === 'ACTIVE') this.activeWrites++;
        await super.putMetadata(metadata);
      }
    }
    const store = new ChangedSourceStore();
    const vault = new SecureVault(store);
    await expect(migrateRevocable(source, vault, password, authorization().assert)).rejects.toThrow('Dati sorgente cambiati');
    expect(store.activeWrites).toBe(0);
    expect(source.removed).toEqual([]);
    expect(JSON.parse(source.getItem(STORAGE_KEY)!).currentClassId).toBe('synthetic-change');
    expect(await store.getMetadata()).toBeNull();
    expect(await store.listRecordKeys()).toEqual([]);
    expect(vault.isUnlocked()).toBe(false);
  });

  test('revocation after durable activation preserves ACTIVE and source until new authenticated cleanup', async () => {
    const source = makeMigrationStorage();
    const store = new MemoryVaultStore();
    const auth = authorization();
    class RevokingVault extends SecureVault {
      override async activate(assertAuthorized?: () => void, onCommitInvoked?: () => void) {
        await super.activate(assertAuthorized, onCommitInvoked);
        auth.revoke();
      }
    }
    const vault = new RevokingVault(store);
    await expect(migrateRevocable(source, vault, password, auth.assert)).rejects.toThrow('Sessione revocata');
    expect(source.removed).toEqual([]);
    expect((await store.getMetadata())?.state).toBe('ACTIVE');
    expect(await store.listRecordKeys()).toHaveLength(6);
    expect(vault.isUnlocked()).toBe(false);
    const fresh = new SecureVault(store);
    await fresh.unlock(password);
    expect(await cleanupRevocable(source, fresh, authorization().assert)).toHaveLength(6);
    expect(source.removed).toHaveLength(6);
  });

  test('revocation during residual readback does not delete source; fresh authentication may finish cleanup', async () => {
    const source = makeMigrationStorage();
    const store = new MemoryVaultStore();
    const prepared = makeMigrationStorage();
    const original = new SecureVault(store);
    await migrateLegacyToVault(prepared, original, password);
    original.lock();
    const auth = authorization();
    class RevokingVault extends SecureVault {
      override async get<T>(key: VaultRecordKey): Promise<T | null> {
        const value = await super.get<T>(key);
        auth.revoke();
        return value;
      }
    }
    const vault = new RevokingVault(store);
    await vault.unlock(password);
    await expect(cleanupRevocable(source, vault, auth.assert)).rejects.toThrow('Sessione revocata');
    expect(source.removed).toEqual([]);
    vault.lock();
    const fresh = new SecureVault(store);
    await fresh.unlock(password);
    expect(await cleanupRevocable(source, fresh, authorization().assert)).toHaveLength(6);
  });

  test('candidate refuses deletion if raw legacy source changes during readback', async () => {
    const values = new Map([[STORAGE_KEY, JSON.stringify({ classes: [], currentClassId: null })]]);
    const source = new MemoryLegacyStorage(values);
    const store = new MemoryVaultStore();
    class ChangingVault extends SecureVault {
      override async get<T>(key: VaultRecordKey): Promise<T | null> {
        const value = await super.get<T>(key);
        values.set(STORAGE_KEY, JSON.stringify({ classes: [], currentClassId: 'changed' }));
        return value;
      }
    }
    const vault = new ChangingVault(store);
    await expect(migrateRevocable(source, vault, password, authorization().assert)).rejects.toThrow('Dati sorgente cambiati');
    expect(source.removed).toEqual([]);
    expect(await store.getMetadata()).toBeNull();
    expect(vault.isUnlocked()).toBe(false);
    expect(JSON.parse(source.getItem(STORAGE_KEY)!).currentClassId).toBe('changed');
  });
  test('M1-C/2 ambiguous ACTIVE acknowledgement preserves the committed ciphertext and legacy source', async () => {
    const source = makeMigrationStorage();
    class LostAcknowledgementStore extends MemoryVaultStore {
      override async putMetadata(metadata: VaultMetadataV1) {
        await super.putMetadata(metadata);
        if (metadata.state === 'ACTIVE') throw new Error('Synthetic ACTIVE acknowledgement lost.');
      }
    }
    const store = new LostAcknowledgementStore();
    const vault = new SecureVault(store);
    await expect(migrateRevocable(source, vault, password, authorization().assert))
      .rejects.toThrow('Synthetic ACTIVE acknowledgement lost.');
    expect(source.removed).toEqual([]);
    expect(collectLegacySnapshot(source).presentKeys).toHaveLength(6);
    expect((await store.getMetadata())?.state).toBe('ACTIVE');
    expect(await store.listRecordKeys()).toHaveLength(6);
    expect(vault.isUnlocked()).toBe(false);

    // Reauthentication + verified readback is the only permitted cleanup path.
    const fresh = new SecureVault(store);
    await fresh.unlock(password);
    expect(await cleanupRevocable(source, fresh, authorization().assert)).toHaveLength(6);
    expect(source.removed).toHaveLength(6);
  });

  test('M1-C/2 rejected ACTIVE write preserves STAGING for protected re-observation', async () => {
    const source = makeMigrationStorage();
    class RejectedCommitStore extends MemoryVaultStore {
      override async putMetadata(metadata: VaultMetadataV1) {
        if (metadata.state === 'ACTIVE') throw new Error('Synthetic ACTIVE write refused.');
        await super.putMetadata(metadata);
      }
    }
    const store = new RejectedCommitStore();
    const vault = new SecureVault(store);
    await expect(migrateRevocable(source, vault, password, authorization().assert))
      .rejects.toThrow('Synthetic ACTIVE write refused.');
    expect(source.removed).toEqual([]);
    expect(collectLegacySnapshot(source).presentKeys).toHaveLength(6);
    expect((await store.getMetadata())?.state).toBe('STAGING');
    expect(await store.listRecordKeys()).toHaveLength(6);
    expect(vault.isUnlocked()).toBe(false);
  });

});
