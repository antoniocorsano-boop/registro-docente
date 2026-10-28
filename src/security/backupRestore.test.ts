import { describe, expect, test } from 'bun:test';
import { createEmptyCopilotState } from '../copilot/emptyCopilotState';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import {
  SecureAppStorage,
  type CompleteSecureAppSnapshot
} from './secureAppStorage';
import { SecureVault } from './secureVault';
import type { VaultStore } from './vaultStore';
import type { EncryptedVaultRecord, VaultMetadataV1, VaultRecordKey } from './vaultTypes';

class RestoreTestStore implements VaultStore {
  private metadata: VaultMetadataV1 | null = null;
  private readonly records = new Map<VaultRecordKey, EncryptedVaultRecord>();
  private writesSinceArm = 0;
  private corruptKey: VaultRecordKey | null = null;
  private corruptAfterWrites = Number.POSITIVE_INFINITY;
  private corruptionUsed = false;

  armOneReadCorruption(key: VaultRecordKey, afterWrites: number): void {
    this.corruptKey = key;
    this.corruptAfterWrites = afterWrites;
    this.writesSinceArm = 0;
    this.corruptionUsed = false;
  }

  async getMetadata(): Promise<VaultMetadataV1 | null> { return this.metadata; }
  async putMetadata(metadata: VaultMetadataV1): Promise<void> { this.metadata = metadata; }
  async getRecord(key: VaultRecordKey): Promise<EncryptedVaultRecord | null> {
    const record = this.records.get(key) ?? null;
    if (
      record
      && !this.corruptionUsed
      && this.corruptKey === key
      && this.writesSinceArm >= this.corruptAfterWrites
    ) {
      this.corruptionUsed = true;
      const altered = new Uint8Array(record.ciphertext.slice(0));
      altered[0] ^= 0x01;
      return { ...record, ciphertext: altered.buffer };
    }
    return record;
  }
  async putRecord(record: EncryptedVaultRecord): Promise<void> {
    this.records.set(record.recordKey as VaultRecordKey, record);
    if (this.corruptKey) this.writesSinceArm += 1;
  }
  async putRecords(records: EncryptedVaultRecord[]): Promise<void> {
    for (const record of records) await this.putRecord(record);
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

function libraryFor(label: string) {
  return {
    schemaVersion: 1 as const,
    sources: [{
      id: `source-${label}`,
      kind: 'text' as const,
      title: `Fonte ${label}`,
      capturedAt: '2026-10-24T10:00:00.000Z',
      payload: { text: `contenuto-${label}` },
      status: 'ready' as const,
      privacy: 'teacher-professional' as const,
      links: []
    }]
  };
}

function snapshot(label: string): CompleteSecureAppSnapshot {
  return {
    appData: { classes: [], currentClassId: null },
    settings: {
      school: `IC ${label}`,
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
        apiKey: `secret-${label}`
      }
    },
    udas: [],
    customTests: {},
    submissions: [],
    planning: emptyPlanning,
    library: libraryFor(label),
    professionalMemory: createEmptyProfessionalMemoryState(),
    copilotState: createEmptyCopilotState(),
    meta: { changes: label === 'old' ? 3 : 0, lastBackup: null }
  };
}

describe('SEC-1 verified vault backup restore', () => {
  test('writes a complete ten-dataset candidate, verifies readback and strips provider secrets', async () => {
    const vault = new SecureVault(new RestoreTestStore());
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);

    await storage.restoreSnapshotVerified(snapshot('old'));
    const restored = await storage.restoreSnapshotVerified(snapshot('new'));

    expect(restored.settings.school).toBe('IC new');
    expect(restored.library.sources[0]?.id).toBe('source-new');
    expect(restored.professionalMemory).toEqual(createEmptyProfessionalMemoryState());
    expect(restored.copilotState).toEqual(createEmptyCopilotState());
    expect(restored.settings.embeddingConfig?.apiKey).toBeUndefined();
    expect(restored.planning).toEqual(emptyPlanning);
    expect((await storage.loadSnapshot()).settings?.school).toBe('IC new');
  });

  test('rolls back the previous snapshot when post-write readback is corrupted', async () => {
    const store = new RestoreTestStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);
    const previous = snapshot('old');

    await storage.restoreSnapshotVerified(previous);
    store.armOneReadCorruption('appData', 10);

    await expect(storage.restoreSnapshotVerified(snapshot('new'))).rejects.toBeDefined();

    const afterFailure = await storage.loadSnapshot();
    expect(afterFailure.settings?.school).toBe('IC old');
    expect(afterFailure.planning).toEqual(emptyPlanning);
    expect(afterFailure.professionalMemory).toEqual(previous.professionalMemory);
    expect(afterFailure.copilotState).toEqual(previous.copilotState);
    expect(afterFailure.meta).toEqual(previous.meta);
    expect(afterFailure.settings?.embeddingConfig?.apiKey).toBeUndefined();
  });

  test('returns an initially empty vault to logically empty memory and Copilot state when a restore readback fails', async () => {
    const store = new RestoreTestStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('password');
    const storage = new SecureAppStorage(vault);

    store.armOneReadCorruption('appData', 10);
    await expect(storage.restoreSnapshotVerified(snapshot('new'))).rejects.toBeDefined();

    expect(await storage.loadSnapshot()).toEqual({
      appData: null,
      settings: null,
      udas: null,
      customTests: null,
      submissions: null,
      planning: null,
      library: null,
      professionalMemory: createEmptyProfessionalMemoryState(),
      copilotState: createEmptyCopilotState(),
      meta: null
    });
  });
});