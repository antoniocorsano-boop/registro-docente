import { describe, expect, test } from 'bun:test';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';

const emptyPlanning = {
  schemaVersion: 1 as const,
  profiles: [],
  arenaContexts: [],
  resources: [],
  masterPrograms: [],
  classInstances: []
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

const completePlanningSnapshot = {
  ...sixDatasetSnapshot,
  library: emptyLibrary,
  planning: {
    ...emptyPlanning,
    profiles: [{ id: 'profile-current' }]
  },
  professionalMemory: createEmptyProfessionalMemoryState()
};

async function loadBackupModule() {
  const modulePath = './' + 'backupPayload';
  return import(modulePath);
}

describe('EDU-PLAN-01A planning backup compatibility', () => {
  test('exports planning in current application backup data version 5', async () => {
    const backup = await loadBackupModule();

    expect(backup.BACKUP_DATA_VERSION_V5).toBe(5);
    const payload = backup.createBackupPayload(completePlanningSnapshot as any, '2026-10-24T10:00:00.000Z');

    expect(payload.backupDataVersion).toBe(5);
    expect(payload.snapshot.planning).toEqual(completePlanningSnapshot.planning);
    expect(payload.snapshot.professionalMemory).toEqual(createEmptyProfessionalMemoryState());
  });

  test('normalizes v2 backup into current runtime state with empty planning library and professional memory', async () => {
    const backup = await loadBackupModule();
    const restored = backup.normalizeBackupPayload({
      app: 'registro-docente',
      backupDataVersion: 2,
      exportedAt: '2026-10-23T10:00:00.000Z',
      snapshot: sixDatasetSnapshot
    }, completePlanningSnapshot as any);

    expect(restored).toEqual({
      ...sixDatasetSnapshot,
      planning: emptyPlanning,
      library: emptyLibrary,
      professionalMemory: createEmptyProfessionalMemoryState()
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
    }, completePlanningSnapshot as any);

    expect(restored.planning).toEqual(emptyPlanning);
    expect(restored.planning).not.toEqual(completePlanningSnapshot.planning);
    expect(restored.library).toEqual(emptyLibrary);
    expect(restored.professionalMemory).toEqual(createEmptyProfessionalMemoryState());
  });

  test('keeps unsupported application backup versions fail-closed', async () => {
    const backup = await loadBackupModule();

    expect(() => backup.normalizeBackupPayload({
      app: 'registro-docente',
      backupDataVersion: 99,
      snapshot: completePlanningSnapshot
    }, completePlanningSnapshot as any)).toThrow('Versione dati backup non supportata: 99.');
  });
});