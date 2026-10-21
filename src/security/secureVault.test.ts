import { describe, expect, test } from 'bun:test';
import { SecureVault } from './secureVault';
import { IndexedDbVaultStore, type VaultStore } from './vaultStore';
import type { EncryptedVaultRecord, VaultMetadataV1, VaultRecordKey } from './vaultTypes';

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

describe('SEC-1 vault storage boundary', () => {
  test('rejects an unavailable IndexedDB factory instead of falling back to plaintext storage', () => {
    expect(() => new IndexedDbVaultStore(undefined)).toThrow('IndexedDB');
  });

  test('defines a storage contract consumable by a memory test double', async () => {
    const store: VaultStore = new MemoryVaultStore();
    const metadata: VaultMetadataV1 = {
      vaultVersion: 1,
      state: 'STAGING',
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 600_000
      },
      salt: new Uint8Array(16),
      wrappedDek: new ArrayBuffer(32),
      wrapIv: new Uint8Array(12),
      createdAt: '2026-10-21T00:00:00.000Z',
      updatedAt: '2026-10-21T00:00:00.000Z'
    };
    const record: EncryptedVaultRecord = {
      recordKey: 'appData',
      schemaVersion: 1,
      iv: new Uint8Array(12),
      ciphertext: new ArrayBuffer(24)
    };

    await store.putMetadata(metadata);
    await store.putRecord(record);

    expect(await store.getMetadata()).toEqual(metadata);
    expect(await store.getRecord('appData')).toEqual(record);
    expect(await store.listRecordKeys()).toEqual(['appData']);

    await store.deleteRecord('appData');
    expect(await store.getRecord('appData')).toBeNull();

    await store.clearAll();
    expect(await store.getMetadata()).toBeNull();
  });
});

describe('SEC-1 SecureVault lifecycle', () => {
  test('initializes an active vault, locks it and requires unlock before reads', async () => {
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);

    await vault.initializeActive('teacher-password');
    expect(vault.isUnlocked()).toBe(true);

    await vault.put('appData', { value: 7 });
    await expect(vault.get<{ value: number }>('appData')).resolves.toEqual({ value: 7 });

    vault.lock();
    expect(vault.isUnlocked()).toBe(false);
    await expect(vault.get('appData')).rejects.toThrow('bloccato');

    await expect(vault.unlock('wrong-password')).rejects.toThrow();
    await vault.unlock('teacher-password');
    await expect(vault.get<{ value: number }>('appData')).resolves.toEqual({ value: 7 });
  });

  test('keeps staging distinct from active and allows activation only from staging', async () => {
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);

    await vault.createStaging('teacher-password');
    expect((await store.getMetadata())?.state).toBe('STAGING');

    vault.lock();
    await expect(vault.unlock('teacher-password')).rejects.toThrow('STAGING');

    const retryVault = new SecureVault(store);
    await expect(retryVault.activate()).rejects.toThrow('bloccato');
  });

  test('changes password by rewrapping the DEK without reciphering records', async () => {
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);

    await vault.initializeActive('old-password');
    await vault.put('settings', { theme: 'cyan' });
    const before = await store.getRecord('settings');

    await vault.changePassword('old-password', 'new-password');
    const after = await store.getRecord('settings');

    expect(after?.iv).toEqual(before?.iv);
    expect(after?.ciphertext).toEqual(before?.ciphertext);

    vault.lock();
    await expect(vault.unlock('old-password')).rejects.toThrow();
    await vault.unlock('new-password');
    await expect(vault.get<{ theme: string }>('settings')).resolves.toEqual({ theme: 'cyan' });
  });

  test('discards only staging vaults and never clears an active vault', async () => {
    const stagingStore = new MemoryVaultStore();
    const stagingVault = new SecureVault(stagingStore);
    await stagingVault.createStaging('password');
    await stagingVault.discardStaging();
    expect(await stagingStore.getMetadata()).toBeNull();
    expect(stagingVault.isUnlocked()).toBe(false);

    const activeStore = new MemoryVaultStore();
    const activeVault = new SecureVault(activeStore);
    await activeVault.initializeActive('password');
    await expect(activeVault.discardStaging()).rejects.toThrow('ACTIVE');
    expect((await activeStore.getMetadata())?.state).toBe('ACTIVE');
  });
});
