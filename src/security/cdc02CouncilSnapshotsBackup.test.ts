import { describe, expect, test } from 'bun:test';
import type { AppData, AppSettings, ClassData } from '../types';
import { isCouncilAppDataValid, wouldLoseCouncilEntries } from '../council/councilModel';
import { appendConfirmedCouncilSnapshot, prepareCouncilSnapshot } from '../council/councilEvidenceSnapshots';
import { createEmptyCopilotState } from '../copilot/emptyCopilotState';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import { createBackupPayload, normalizeBackupPayload } from './backupPayload';
import type { CompleteSecureAppSnapshot } from './secureAppStorage';

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
