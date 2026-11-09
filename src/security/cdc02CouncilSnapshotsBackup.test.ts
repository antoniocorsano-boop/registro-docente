import { describe, expect, test } from 'bun:test';
import type { AppData, AppSettings, ClassData } from '../types';
import { isCouncilAppDataValid, wouldLoseCouncilEntries } from '../council/councilModel';
import { appendConfirmedCouncilSnapshot, prepareCouncilSnapshot } from '../council/councilEvidenceSnapshots';
import { createEmptyCopilotState } from '../copilot/emptyCopilotState';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import { createBackupPayload, normalizeBackupPayload, normalizeBackupPayloadVerified } from './backupPayload';
import { SecureAppStorage, type CompleteSecureAppSnapshot } from './secureAppStorage';
import { SecureVault } from './secureVault';
import type { VaultStore } from './vaultStore';
import type { EncryptedVaultRecord, VaultMetadataV1, VaultRecordKey } from './vaultTypes';

const settings: AppSettings = {
  school: 'Istituto sintetico', year: '2026/27', teacher: 'Docente',
  subject: 'Tecnologia', theme: 'cyan'
};
const clock = {
  capturedAt: '2026-11-10T09:00:00.000Z',
  captureLocalDate: '2026-11-10',
  captureUtcOffsetMinutes: 0
};
function source(): AppData {
  const klass: ClassData = {
    id: 'C', name: '2C sintetica',
    students: [{ id: 'A', name: 'Alfa sintetico' }],
    grades: [{
      id: 'g1', studentId: 'A', date: '2026-10-10', type: 'test',
      period: 'Q1', title: 'Prova', value: '8'
    }],
    behaviors: [],
    councilSessions: [{
      id: 'S1', schoolYear: '2026/2027', kind: 'monitoraggio',
      date: '2026-11-10', createdAt: clock.capturedAt, updatedAt: clock.capturedAt
    }]
  };
  return { classes: [klass], currentClassId: null };
}
function full(appData: AppData): CompleteSecureAppSnapshot {
  return {
    appData, settings, udas: [], customTests: {}, submissions: [],
    planning: {
      schemaVersion: 2, profiles: [], arenaContexts: [], resources: [],
      masterPrograms: [], classInstances: [], docenteOsProjections: []
    },
    library: { schemaVersion: 1, sources: [] },
    professionalMemory: createEmptyProfessionalMemoryState(),
    copilotState: createEmptyCopilotState(),
    meta: { changes: 0, lastBackup: null }
  };
}
async function withSnapshot(): Promise<AppData> {
  const data = source();
  const p = await prepareCouncilSnapshot(data, {
    classId: 'C', schoolYear: '2026/27', sessionId: 'S1', cutoff: '2026-11-09'
  }, settings, clock);
  return appendConfirmedCouncilSnapshot(data, p, settings, 'snapshot-1', clock);
}

describe('CDC-02/S2b-P2 — RED causale del confine backup e perdita', () => {
  test('un record fotografico incoerente non supera il validatore o il ripristino v6', async () => {
    const saved = await withSnapshot();
    expect(isCouncilAppDataValid(saved)).toBe(true);
    const corrupt = structuredClone(saved);
    corrupt.classes[0].councilEvidenceSnapshots![0].captureLocalDate = '2026-11-09';
    expect(isCouncilAppDataValid(corrupt)).toBe(false);
    expect(() => normalizeBackupPayload(createBackupPayload(full(corrupt)), full(source())))
      .toThrow(/backup|fotograf|consigli/i);
  });

  test('il ripristino che elimina una fotografia deve essere riconosciuto come perdita', async () => {
    const saved = await withSnapshot();
    const stripped = structuredClone(saved);
    delete stripped.classes[0].councilEvidenceSnapshots;
    expect(wouldLoseCouncilEntries(saved, stripped)).toBe(true);
    const altered = structuredClone(saved);
    altered.classes[0].councilEvidenceSnapshots![0].contentDigest = 'f'.repeat(64);
    expect(wouldLoseCouncilEntries(saved, altered)).toBe(true);
    expect(wouldLoseCouncilEntries(saved, structuredClone(saved))).toBe(false);
  });

  test('il backup v6 conserva senza trasformazioni la fotografia immutabile', async () => {
    const saved = await withSnapshot();
    const payload = createBackupPayload(full(saved));
    expect(payload.backupDataVersion).toBe(6);
    const imported = normalizeBackupPayload(JSON.parse(JSON.stringify(payload)), full(source()));
    expect(imported.appData.classes[0].councilEvidenceSnapshots)
      .toEqual(saved.classes[0].councilEvidenceSnapshots);
  });
});

class MemoryVaultStore implements VaultStore {
  private metadata: VaultMetadataV1 | null = null;
  private records = new Map<VaultRecordKey, EncryptedVaultRecord>();
  rejectNextBatch = false;
  putRecordsCalls = 0;

  async getMetadata(): Promise<VaultMetadataV1 | null> { return this.metadata; }
  async putMetadata(metadata: VaultMetadataV1): Promise<void> { this.metadata = metadata; }
  async getRecord(key: VaultRecordKey): Promise<EncryptedVaultRecord | null> {
    return this.records.get(key) ?? null;
  }
  async putRecord(record: EncryptedVaultRecord): Promise<void> {
    this.records.set(record.recordKey as VaultRecordKey, record);
  }
  async putRecords(records: EncryptedVaultRecord[]): Promise<void> {
    this.putRecordsCalls += 1;
    if (this.rejectNextBatch) {
      this.rejectNextBatch = false;
      throw new Error('synthetic atomic batch failure');
    }
    for (const record of records) this.records.set(record.recordKey as VaultRecordKey, record);
  }
  async deleteRecord(key: VaultRecordKey): Promise<void> { this.records.delete(key); }
  async listRecordKeys(): Promise<VaultRecordKey[]> { return [...this.records.keys()]; }
  async clearAll(): Promise<void> { this.records.clear(); this.metadata = null; }
}

function historicalPayload(version: number, data: CompleteSecureAppSnapshot): unknown {
  const snapshot = structuredClone(data) as Record<string, any>;
  if (version < 6) {
    delete snapshot.copilotState;
    snapshot.planning = {
      schemaVersion: 1, profiles: [], arenaContexts: [], resources: [],
      masterPrograms: [], classInstances: []
    };
  }
  if (version < 5) delete snapshot.professionalMemory;
  if (version < 4) delete snapshot.library;
  if (version < 3) delete snapshot.planning;
  return {
    app: 'registro-docente', backupDataVersion: version,
    exportedAt: clock.capturedAt, snapshot
  };
}

describe('CDC-02/S2b-P2 — restore verificato e Vault cifrato', () => {
  test('V2–V6 conservano le fotografie valide e normalizzano i campi storici', async () => {
    const saved = await withSnapshot();
    for (const version of [2, 3, 4, 5, 6]) {
      const payload = historicalPayload(version, full(saved));
      const imported = await normalizeBackupPayloadVerified(payload, full(source()));
      expect(imported.appData.classes[0].councilEvidenceSnapshots)
        .toEqual(saved.classes[0].councilEvidenceSnapshots);
      expect(imported.planning.schemaVersion).toBe(2);
    }
  });

  test('legacy senza fotografie resta valido; legacy con fotografie valide le conserva', async () => {
    const bare = await normalizeBackupPayloadVerified({
      app: 'registro-docente', classes: source().classes
    }, full(source()));
    expect(bare.appData.classes[0].councilEvidenceSnapshots).toBeUndefined();
    const saved = await withSnapshot();
    const withHistory = await normalizeBackupPayloadVerified({
      app: 'registro-docente', classes: saved.classes
    }, full(source()));
    expect(withHistory.appData.classes[0].councilEvidenceSnapshots)
      .toEqual(saved.classes[0].councilEvidenceSnapshots);
  });

  test('payload con digest manomesso fallisce prima di qualunque scrittura', async () => {
    const saved = await withSnapshot();
    const invalid = structuredClone(saved);
    invalid.classes[0].councilEvidenceSnapshots![0].contentDigest = 'f'.repeat(64);
    expect(isCouncilAppDataValid(invalid)).toBe(true); // shape valido, digest da verificare async
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('synthetic-password');
    const storage = new SecureAppStorage(vault);
    await storage.saveAppDataAndMeta(source(), { changes: 1, lastBackup: null });
    const before = await storage.loadSnapshot();
    await expect(normalizeBackupPayloadVerified(createBackupPayload(full(invalid)), full(source())))
      .rejects.toThrow(/fotograf|integrità|valido/i);
    await expect(storage.saveAppDataAndMeta(invalid, { changes: 2, lastBackup: null }))
      .rejects.toThrow(/fotograf|integrità|valido/i);
    await expect(storage.restoreSnapshotVerified(full(invalid)))
      .rejects.toThrow(/fotograf|integrità|valido/i);
    const after = await storage.loadSnapshot();
    expect(after.appData).toEqual(before.appData);
    expect(after.meta).toEqual(before.meta);
    expect(store.putRecordsCalls).toBe(1);
  });

  test('duplicati, catena rotta, seduta mancante e schema ignoto falliscono chiusi', async () => {
    const saved = await withSnapshot();
    const variants: AppData[] = [];
    const duplicate = structuredClone(saved);
    duplicate.classes[0].councilEvidenceSnapshots!.push({
      ...duplicate.classes[0].councilEvidenceSnapshots![0]
    });
    variants.push(duplicate);
    const orphan = structuredClone(saved);
    orphan.classes[0].councilEvidenceSnapshots![0].sessionId = 'missing';
    variants.push(orphan);
    const future = structuredClone(saved);
    (future.classes[0].councilEvidenceSnapshots![0] as any).schemaVersion = 2;
    variants.push(future);
    const wrongRevision = structuredClone(saved);
    wrongRevision.classes[0].councilEvidenceSnapshots![0].revision = 9;
    variants.push(wrongRevision);
    for (const bad of variants) {
      expect(isCouncilAppDataValid(bad)).toBe(false);
      expect(() => normalizeBackupPayload(createBackupPayload(full(bad)), full(source())))
        .toThrow();
    }
  });

  test('salvataggio atomico, rilettura cifrata, backup e ripristino preservano il record', async () => {
    const saved = await withSnapshot();
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('synthetic-password');
    const storage = new SecureAppStorage(vault);
    const meta = { changes: 1, lastBackup: null };
    await storage.saveAppDataAndMeta(saved, meta);
    expect((await store.listRecordKeys()).sort()).toEqual(['appData', 'meta']);
    const readback = await storage.loadSnapshot();
    expect(readback.appData).toEqual(saved);
    expect(readback.meta).toEqual(meta);
    const payload = JSON.parse(JSON.stringify(createBackupPayload(full(readback.appData!))));
    const normalized = await normalizeBackupPayloadVerified(payload, full(source()));
    const restored = await storage.restoreSnapshotVerified(normalized);
    expect(restored.appData.classes[0].councilEvidenceSnapshots)
      .toEqual(saved.classes[0].councilEvidenceSnapshots);
    expect((await storage.loadSnapshot()).appData).toEqual(saved);
  });

  test('un batch fallito lascia intatti fotografia e metadati già confermati', async () => {
    const saved = await withSnapshot();
    const store = new MemoryVaultStore();
    const vault = new SecureVault(store);
    await vault.initializeActive('synthetic-password');
    const storage = new SecureAppStorage(vault);
    await storage.saveAppDataAndMeta(saved, { changes: 1, lastBackup: null });
    store.rejectNextBatch = true;
    const changed = structuredClone(saved);
    changed.classes[0].grades[0].value = '9';
    await expect(storage.saveAppDataAndMeta(changed, { changes: 2, lastBackup: null }))
      .rejects.toThrow('synthetic atomic batch failure');
    const after = await storage.loadSnapshot();
    expect(after.appData).toEqual(saved);
    expect(after.meta).toEqual({ changes: 1, lastBackup: null });
  });
  test('P2 Codex: classi con ID duplicato non possono rendere ambiguo lo storico', async () => {
    const saved = await withSnapshot();
    const ambiguous = structuredClone(saved);
    ambiguous.classes.push({
      ...structuredClone(source().classes[0]),
      name: 'Altra classe sintetica con lo stesso ID'
    });
    expect(isCouncilAppDataValid(ambiguous)).toBe(false);
    await expect(normalizeBackupPayloadVerified(
      createBackupPayload(full(ambiguous)), full(source())
    )).rejects.toThrow(/classe|identit|backup/i);
    expect(wouldLoseCouncilEntries(saved, ambiguous)).toBe(true);
  });

});
