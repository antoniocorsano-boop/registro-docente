import { describe, expect, test } from 'bun:test';
import { createEmptyLibraryState } from '../library/emptyLibraryState';
import { createTextSource } from '../library/intake';
import {
  addLibrarySource,
  linkLibrarySource,
  removeLibrarySource,
  searchLibrarySources
} from '../library/libraryState';
import type { LibrarySource, LibraryStateV1 } from '../library/types';
import { createDurableMutationCoordinator } from '../persistence/durableMutationCoordinator';
import { persistLibraryMutation, type LibraryMutationState } from '../persistence/libraryMutation';
import { createBackupPayload, normalizeBackupPayload } from './backupPayload';
import { SecureAppStorage, type CompleteSecureAppSnapshot } from './secureAppStorage';
import { SecureVault } from './secureVault';
import type { VaultStore } from './vaultStore';
import type { EncryptedVaultRecord, VaultMetadataV1, VaultRecordKey } from './vaultTypes';

class MemoryVaultStore implements VaultStore {
  private metadata: VaultMetadataV1 | null = null;
  private readonly records = new Map<VaultRecordKey, EncryptedVaultRecord>();

  async getMetadata(): Promise<VaultMetadataV1 | null> { return this.metadata; }
  async putMetadata(metadata: VaultMetadataV1): Promise<void> { this.metadata = metadata; }
  async getRecord(key: VaultRecordKey): Promise<EncryptedVaultRecord | null> { return this.records.get(key) ?? null; }
  async putRecord(record: EncryptedVaultRecord): Promise<void> {
    this.records.set(record.recordKey as VaultRecordKey, record);
  }
  async putRecords(records: EncryptedVaultRecord[]): Promise<void> {
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

function makeSource(
  id: string,
  capturedAt = '2026-10-24T10:00:00.000Z'
): LibrarySource {
  return createTextSource({
    id,
    title: `Fonte ${id}`,
    text: `contenuto ${id}`,
    capturedAt,
    kind: 'note'
  });
}

function completeSnapshot(library: LibraryStateV1): CompleteSecureAppSnapshot {
  return {
    appData: { classes: [], currentClassId: null },
    settings: {
      school: 'IC Test',
      year: '2026/27',
      teacher: 'Docente',
      subject: 'Tecnologia',
      theme: 'cyan'
    },
    udas: [],
    customTests: {},
    submissions: [],
    planning: emptyPlanning,
    library,
    meta: { changes: 1, lastBackup: null }
  };
}

describe('LIB-01A integrated persistence, backup and sequencing contract', () => {
  test('source add → encrypted vault save → reload preserves payload privacy and links', async () => {
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);

    const source = makeSource('energy');
    const linked = linkLibrarySource(
      addLibrarySource(createEmptyLibraryState(), source),
      source.id,
      { targetType: 'uda', targetId: 'uda-energy' }
    );

    await storage.saveLibraryAndMeta(linked, { changes: 1, lastBackup: null });
    const reloaded = await storage.loadSnapshot();

    expect(reloaded.library?.sources[0]?.payload).toEqual({ text: 'contenuto energy' });
    expect(reloaded.library?.sources[0]?.privacy).toBe('teacher-professional');
    expect(reloaded.library?.sources[0]?.links).toEqual([
      { targetType: 'uda', targetId: 'uda-energy' }
    ]);
  });

  test('backup v4 normalize and verified restore preserve a linked private source', async () => {
    const source = makeSource('backup');
    const library = linkLibrarySource(
      addLibrarySource(createEmptyLibraryState(), source),
      source.id,
      { targetType: 'lesson', targetId: 'lesson-1' }
    );
    const snapshot = completeSnapshot(library);
    const payload = createBackupPayload(snapshot, '2026-10-24T11:00:00.000Z');
    const normalized = normalizeBackupPayload(payload, completeSnapshot(createEmptyLibraryState()));

    const vault = new SecureVault(new MemoryVaultStore());
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);
    const restored = await storage.restoreSnapshotVerified(normalized);

    expect(restored.library.sources).toHaveLength(1);
    expect(restored.library.sources[0]?.payload.text).toBe('contenuto backup');
    expect(restored.library.sources[0]?.links).toEqual([
      { targetType: 'lesson', targetId: 'lesson-1' }
    ]);
  });

  test('valid v3 backup remains readable and starts with an empty private library', () => {
    const current = completeSnapshot(addLibrarySource(createEmptyLibraryState(), makeSource('current')));
    const { library: _library, ...snapshotV3 } = current;

    const restored = normalizeBackupPayload({
      app: 'registro-docente',
      backupDataVersion: 3,
      exportedAt: '2026-10-23T08:00:00.000Z',
      snapshot: snapshotV3
    }, current);

    expect(restored.library).toEqual(createEmptyLibraryState());
    expect(restored.planning).toEqual(current.planning);
  });

  test('failed durable save leaves the committed library and backup metadata unchanged', async () => {
    const committed: LibraryMutationState = {
      library: addLibrarySource(createEmptyLibraryState(), makeSource('stable')),
      meta: { changes: 4, lastBackup: '2026-10-20T08:00:00.000Z' }
    };

    await expect(persistLibraryMutation(
      committed,
      library => addLibrarySource(library, makeSource('rejected')),
      async () => { throw new Error('write failed'); }
    )).rejects.toThrow('write failed');

    expect(committed.library.sources.map(source => source.id)).toEqual(['stable']);
    expect(committed.meta).toEqual({ changes: 4, lastBackup: '2026-10-20T08:00:00.000Z' });
  });

  test('a delete cannot be resurrected by a later serialized library save', async () => {
    const coordinator = createDurableMutationCoordinator();
    let committed: LibraryMutationState = {
      library: addLibrarySource(createEmptyLibraryState(), makeSource('delete-me')),
      meta: { changes: 0, lastBackup: null }
    };

    let releaseDelete!: () => void;
    const deleteGate = new Promise<void>(resolve => { releaseDelete = resolve; });

    const deleting = coordinator.enqueueTask(async () => {
      const candidate = await persistLibraryMutation(
        committed,
        library => removeLibrarySource(library, 'delete-me'),
        async () => { await deleteGate; }
      );
      committed = candidate;
      return candidate;
    });

    const adding = coordinator.enqueueTask(async () => {
      const candidate = await persistLibraryMutation(
        committed,
        library => addLibrarySource(library, makeSource('later')),
        async () => undefined
      );
      committed = candidate;
      return candidate;
    });

    await Promise.resolve();
    releaseDelete();
    await Promise.all([deleting, adding]);

    expect(committed.library.sources.map(source => source.id)).toEqual(['later']);
    expect(committed.meta.changes).toBe(2);
  });

  test('blank search returns private sources newest-first', () => {
    let library = createEmptyLibraryState();
    library = addLibrarySource(library, makeSource('old', '2026-10-23T09:00:00.000Z'));
    library = addLibrarySource(library, makeSource('new', '2026-10-24T09:00:00.000Z'));

    expect(searchLibrarySources(library, '   ').map(source => source.id)).toEqual(['new', 'old']);
  });

  test('IndexedDB record inventory recognizes library as a canonical encrypted dataset', async () => {
    const vaultStoreSource = await Bun.file(new URL('./vaultStore.ts', import.meta.url)).text();
    const acceptedKeys = vaultStoreSource.match(/\[[^\]]*'appData'[^\]]*\]\.includes\(value\)/s)?.[0] ?? '';

    expect(acceptedKeys).toContain("'library'");
  });
});
