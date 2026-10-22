import { describe, expect, test } from 'bun:test';
import { SecureVault } from './secureVault';
import type { VaultStore } from './vaultStore';
import type { EncryptedVaultRecord, VaultMetadataV1, VaultRecordKey } from './vaultTypes';

class LockAwareBlockingStore implements VaultStore {
  private metadata: VaultMetadataV1 | null = null;
  private readonly records = new Map<VaultRecordKey, EncryptedVaultRecord>();
  private putCalls = 0;
  private firstEnteredResolve!: () => void;
  private releaseFirstResolve!: () => void;
  readonly firstEntered = new Promise<void>(resolve => { this.firstEnteredResolve = resolve; });
  private readonly releaseFirst = new Promise<void>(resolve => { this.releaseFirstResolve = resolve; });

  async getMetadata(): Promise<VaultMetadataV1 | null> { return this.metadata; }
  async putMetadata(metadata: VaultMetadataV1): Promise<void> { this.metadata = metadata; }
  async getRecord(key: VaultRecordKey): Promise<EncryptedVaultRecord | null> { return this.records.get(key) ?? null; }
  async putRecord(record: EncryptedVaultRecord): Promise<void> { await this.putRecords([record]); }
  async putRecords(records: EncryptedVaultRecord[]): Promise<void> {
    this.putCalls += 1;
    if (this.putCalls === 1) {
      this.firstEnteredResolve();
      await this.releaseFirst;
    }
    for (const record of records) {
      this.records.set(record.recordKey as VaultRecordKey, record);
    }
  }
  async deleteRecord(key: VaultRecordKey): Promise<void> { this.records.delete(key); }
  async listRecordKeys(): Promise<VaultRecordKey[]> { return [...this.records.keys()]; }
  async clearAll(): Promise<void> { this.metadata = null; this.records.clear(); }
  seed(record: EncryptedVaultRecord): void { this.records.set(record.recordKey as VaultRecordKey, record); }
  release(): void { this.releaseFirstResolve(); }
}

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('PERSIST-01 final integrity hardening', () => {
  test('a queued vault write rechecks unlocked state when execution begins', async () => {
    const store = new LockAwareBlockingStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');

    const first = vault.put('appData', { value: 1 });
    await store.firstEntered;
    const queued = vault.put('meta', { changes: 1, lastBackup: null });

    vault.lock();
    store.release();

    await first;
    await expect(queued).rejects.toThrow('bloccato');
    expect(await store.getRecord('meta')).toBeNull();
  });

  test('a queued vault delete rechecks unlocked state when execution begins', async () => {
    const store = new LockAwareBlockingStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const seeded: EncryptedVaultRecord = {
      recordKey: 'meta',
      schemaVersion: 1,
      iv: new Uint8Array(12),
      ciphertext: new ArrayBuffer(24)
    };
    store.seed(seeded);

    const first = vault.put('appData', { value: 1 });
    await store.firstEntered;
    const queuedDelete = vault.delete('meta');

    vault.lock();
    store.release();

    await first;
    await expect(queuedDelete).rejects.toThrow('bloccato');
    expect(await store.getRecord('meta')).toEqual(seeded);
  });

  test('class navigation does not overwrite the committed appData ref', async () => {
    const source = await Bun.file('src/App.tsx').text();
    const navigation = sectionBetween(source, '// Synchronize URL query params', '// Add new class');
    const appCommit = sectionBetween(source, 'const commitAppDataMutation', 'const commitMetaMutation');

    expect(source).toContain('currentClassIdRef');
    expect(navigation).toContain('currentClassIdRef.current');
    expect(navigation).not.toContain('appDataRef.current = nextAppData');
    expect(appCommit).toContain('currentClassId: currentClassIdRef.current');
  });

  test('IndexedDB batch observes request failures and transaction completion together', async () => {
    const source = await Bun.file('src/security/vaultStore.ts').text();
    expect(source).toMatch(/await Promise\.all\(\[\s*done,\s*\.\.\.records\.map/);
  });
});
