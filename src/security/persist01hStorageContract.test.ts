import { describe, expect, test } from 'bun:test';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import type { AppSettings, OnlineSubmission, OnlineTest, UdaRecord } from '../types';
import {
  SecureAppStorage,
  type CompleteSecureAppSnapshot,
  type SecureMeta
} from './secureAppStorage';
import { SecureVault } from './secureVault';
import type { VaultStore } from './vaultStore';
import type { EncryptedVaultRecord, VaultMetadataV1, VaultRecordKey } from './vaultTypes';

class AtomicRecordingStore implements VaultStore {
  private metadata: VaultMetadataV1 | null = null;
  private readonly records = new Map<VaultRecordKey, EncryptedVaultRecord>();
  readonly batchKeys: VaultRecordKey[][] = [];
  failNextBatch = false;
  corruptNextReadKey: VaultRecordKey | null = null;

  async getMetadata(): Promise<VaultMetadataV1 | null> { return this.metadata; }
  async putMetadata(metadata: VaultMetadataV1): Promise<void> { this.metadata = metadata; }
  async getRecord(key: VaultRecordKey): Promise<EncryptedVaultRecord | null> {
    const record = this.records.get(key) ?? null;
    if (record && this.corruptNextReadKey === key) {
      this.corruptNextReadKey = null;
      const altered = new Uint8Array(record.ciphertext.slice(0));
      altered[0] ^= 1;
      return { ...record, ciphertext: altered.buffer };
    }
    return record;
  }
  async putRecord(record: EncryptedVaultRecord): Promise<void> { await this.putRecords([record]); }
  async putRecords(records: EncryptedVaultRecord[]): Promise<void> {
    this.batchKeys.push(records.map(record => record.recordKey as VaultRecordKey));
    if (this.failNextBatch) {
      this.failNextBatch = false;
      throw new Error('forced atomic batch failure');
    }
    for (const record of records) this.records.set(record.recordKey as VaultRecordKey, record);
  }
  async deleteRecord(key: VaultRecordKey): Promise<void> { this.records.delete(key); }
  async listRecordKeys(): Promise<VaultRecordKey[]> { return [...this.records.keys()]; }
  async clearAll(): Promise<void> { this.metadata = null; this.records.clear(); }
  clearBatchHistory(): void { this.batchKeys.length = 0; }
}

const settings = (school: string): AppSettings => ({
  school,
  year: '2026/27',
  teacher: 'Docente',
  subject: 'Tecnologia',
  theme: 'cyan'
});

const meta = (changes: number): SecureMeta => ({ changes, lastBackup: null });

const emptyPlanning = {
  schemaVersion: 1 as const,
  profiles: [],
  arenaContexts: [],
  resources: [],
  masterPrograms: [],
  classInstances: []
};

const emptyLibrary = { schemaVersion: 1 as const, sources: [] };
const nineDatasetKeys: VaultRecordKey[] = [
  'appData',
  'settings',
  'udas',
  'customTests',
  'submissions',
  'planning',
  'library',
  'professionalMemory',
  'meta'
];

function complete(label: string): CompleteSecureAppSnapshot {
  return {
    appData: { classes: [], currentClassId: null },
    settings: settings(`IC ${label}`),
    udas: [{ id: `uda-${label}`, title: label, className: '3ª A', hours: 1, period: 'Q1', startMonth: 0, durationMonths: 1, civicEducation: false, lessons: [], dependencies: [] } as UdaRecord],
    customTests: { [`test-${label}`]: { id: `test-${label}`, title: label, questions: [] } as OnlineTest },
    submissions: [{ id: `sub-${label}`, testId: `test-${label}`, name: 'Rossi Mario', class: '3ª A', testTitle: label, score: 1, total: 1, date: '2026-10-22T10:00:00.000Z' } as OnlineSubmission],
    planning: emptyPlanning,
    library: emptyLibrary,
    professionalMemory: createEmptyProfessionalMemoryState(),
    meta: meta(label === 'old' ? 3 : 0)
  };
}

function requireStorageMethod<T extends (...args: any[]) => Promise<void>>(storage: SecureAppStorage, name: string): T {
  const method = (storage as unknown as Record<string, unknown>)[name];
  expect(typeof method).toBe('function');
  return (method as T).bind(storage);
}

describe('PERSIST-01H atomic storage contracts', () => {
  test('settings and meta commit in one batch and fail atomically', async () => {
    const store = new AtomicRecordingStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);
    await storage.saveSettings(settings('old'));
    await storage.saveMeta(meta(1));
    store.clearBatchHistory();

    const save = requireStorageMethod<(value: AppSettings, nextMeta: SecureMeta) => Promise<void>>(storage, 'saveSettingsAndMeta');
    store.failNextBatch = true;
    await expect(save(settings('new'), meta(2))).rejects.toThrow('forced atomic batch failure');
    expect((await storage.loadSnapshot()).settings?.school).toBe('old');
    expect((await storage.loadSnapshot()).meta).toEqual(meta(1));

    await save(settings('new'), meta(2));
    expect(store.batchKeys.at(-1)).toEqual(['settings', 'meta']);
  });

  test('UDA tests and submissions each pair their domain with meta in one batch', async () => {
    const store = new AtomicRecordingStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);

    const saveUdas = requireStorageMethod<(value: UdaRecord[], nextMeta: SecureMeta) => Promise<void>>(storage, 'saveUdasAndMeta');
    const saveTests = requireStorageMethod<(value: Record<string, OnlineTest>, nextMeta: SecureMeta) => Promise<void>>(storage, 'saveCustomTestsAndMeta');
    const saveSubmissions = requireStorageMethod<(value: OnlineSubmission[], nextMeta: SecureMeta) => Promise<void>>(storage, 'saveSubmissionsAndMeta');

    await saveUdas([], meta(1));
    await saveTests({}, meta(2));
    await saveSubmissions([], meta(3));

    expect(store.batchKeys.slice(-3)).toEqual([
      ['udas', 'meta'],
      ['customTests', 'meta'],
      ['submissions', 'meta']
    ]);
  });

  test('verified restore writes the nine-record candidate atomically', async () => {
    const store = new AtomicRecordingStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);
    const previous = complete('old');
    const candidate = complete('new');

    store.clearBatchHistory();
    const restored = await storage.restoreSnapshotVerified(candidate, previous);

    expect(restored.settings.school).toBe('IC new');
    expect(restored.professionalMemory).toEqual(createEmptyProfessionalMemoryState());
    expect(store.batchKeys).toEqual([nineDatasetKeys]);
  });

  test('readback mismatch restores the explicit previous logical snapshot atomically even from a fresh physical vault', async () => {
    const store = new AtomicRecordingStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);
    const previous = complete('old');

    store.corruptNextReadKey = 'appData';
    await expect(storage.restoreSnapshotVerified(complete('new'), previous)).rejects.toBeDefined();

    const afterFailure = await storage.loadSnapshot();
    expect(afterFailure.settings?.school).toBe('IC old');
    expect(afterFailure.meta).toEqual(previous.meta);
    expect(afterFailure.professionalMemory).toEqual(previous.professionalMemory);
    expect(store.batchKeys).toEqual([nineDatasetKeys, nineDatasetKeys]);
  });
});