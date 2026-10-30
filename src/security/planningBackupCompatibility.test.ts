import { describe, expect, test } from 'bun:test';
import { createEmptyCopilotState } from '../copilot/emptyCopilotState';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';

const legacyPlanningV1 = {
  schemaVersion: 1 as const,
  profiles: [],
  arenaContexts: [],
  resources: [],
  masterPrograms: [],
  classInstances: []
};

const emptyPlanningV2 = {
  ...legacyPlanningV1,
  schemaVersion: 2 as const,
  docenteOsProjections: []
};

const emptyLibrary = { schemaVersion: 1 as const, sources: [] };

const settings = {
  school: 'IC Test',
  year: '2026/27',
  teacher: 'Docente',
  subject: 'Tecnologia',
  theme: 'cyan' as const
};

const sixDatasetSnapshot = {
  appData: { classes: [], currentClassId: null },
  settings,
  udas: [],
  customTests: {},
  submissions: [],
  meta: { changes: 2, lastBackup: null }
};

const currentPlanningSnapshot = {
  ...sixDatasetSnapshot,
  library: emptyLibrary,
  planning: {
    ...emptyPlanningV2,
    profiles: [{ id: 'profile-current' }]
  },
  professionalMemory: createEmptyProfessionalMemoryState(),
  copilotState: createEmptyCopilotState()
};

async function loadBackupModule() {
  const modulePath = './' + 'backupPayload';
  return import(modulePath);
}

async function frozenProjection() {
  return Bun.file('docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json').json();
}

describe('EDU-PLAN-01A planning backup compatibility', () => {
  test('exports planning v2 in current application backup data version 6', async () => {
    const backup = await loadBackupModule();

    expect(backup.BACKUP_DATA_VERSION_V6).toBe(6);
    const payload = backup.createBackupPayload(currentPlanningSnapshot as any, '2026-10-24T10:00:00.000Z');

    expect(payload.backupDataVersion).toBe(6);
    expect(payload.snapshot.planning).toEqual(currentPlanningSnapshot.planning);
    expect(payload.snapshot.professionalMemory).toEqual(createEmptyProfessionalMemoryState());
    expect(payload.snapshot.copilotState).toEqual(createEmptyCopilotState());
  });

  test('restores historical v6 planning v1 as planning v2 without inventing Docente OS projections', async () => {
    const backup = await loadBackupModule();
    const historicalV6 = {
      app: 'registro-docente',
      backupDataVersion: 6,
      exportedAt: '2026-10-24T10:00:00.000Z',
      snapshot: {
        ...sixDatasetSnapshot,
        planning: {
          ...legacyPlanningV1,
          profiles: [{ id: 'profile-historical-v1' }]
        },
        library: emptyLibrary,
        professionalMemory: createEmptyProfessionalMemoryState(),
        copilotState: createEmptyCopilotState()
      }
    };

    const restored = backup.normalizeBackupPayload(historicalV6, currentPlanningSnapshot as any);

    expect(restored.planning).toEqual({
      ...historicalV6.snapshot.planning,
      schemaVersion: 2,
      docenteOsProjections: []
    });
  });

  test('round-trips a current v6 planning v2 backup with its accepted Docente OS projection intact', async () => {
    const backup = await loadBackupModule();
    const projection = await frozenProjection();
    const snapshot = {
      ...currentPlanningSnapshot,
      planning: {
        ...currentPlanningSnapshot.planning,
        docenteOsProjections: [{
          projection,
          acceptedAt: '2026-10-30T09:50:00.000Z',
          classReconciliation: [{
            sourceSectionId: 'section-1a',
            status: 'resolved',
            registroClassId: 'class-real-1a'
          }]
        }]
      }
    };

    const payload = backup.createBackupPayload(snapshot as any, '2026-10-30T10:00:00.000Z');
    const restored = backup.normalizeBackupPayload(payload, currentPlanningSnapshot as any);

    expect(restored.planning).toEqual(snapshot.planning);
  });

  test('normalizes v2 backup into current runtime state with empty planning library, professional memory and Copilot state', async () => {
    const backup = await loadBackupModule();
    const restored = backup.normalizeBackupPayload({
      app: 'registro-docente',
      backupDataVersion: 2,
      exportedAt: '2026-10-23T10:00:00.000Z',
      snapshot: sixDatasetSnapshot
    }, currentPlanningSnapshot as any);

    expect(restored).toEqual({
      ...sixDatasetSnapshot,
      planning: emptyPlanningV2,
      library: emptyLibrary,
      professionalMemory: createEmptyProfessionalMemoryState(),
      copilotState: createEmptyCopilotState()
    });
  });

  test('normalizes legacy backup with empty planning instead of inheriting current planning', async () => {
    const backup = await loadBackupModule();
    const restored = backup.normalizeBackupPayload({
      classes: [],
      settings,
      udas: [],
      customTests: {},
      submissions: [],
      meta: { changes: 0, lastBackup: null }
    }, currentPlanningSnapshot as any);

    expect(restored.planning).toEqual(emptyPlanningV2);
    expect(restored.planning).not.toEqual(currentPlanningSnapshot.planning);
    expect(restored.library).toEqual(emptyLibrary);
    expect(restored.professionalMemory).toEqual(createEmptyProfessionalMemoryState());
    expect(restored.copilotState).toEqual(createEmptyCopilotState());
  });

  test('keeps unsupported application backup versions fail-closed', async () => {
    const backup = await loadBackupModule();

    expect(() => backup.normalizeBackupPayload({
      app: 'registro-docente',
      backupDataVersion: 99,
      snapshot: currentPlanningSnapshot
    }, currentPlanningSnapshot as any)).toThrow('Versione dati backup non supportata: 99.');
  });
});
