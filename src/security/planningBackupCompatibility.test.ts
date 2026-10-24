import { describe, expect, test } from 'bun:test';

const emptyPlanning = {
  schemaVersion: 1 as const,
  profiles: [],
  arenaContexts: [],
  resources: [],
  masterPrograms: [],
  classInstances: []
};

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
  planning: {
    ...emptyPlanning,
    profiles: [{ id: 'profile-current' }]
  }
};

async function loadBackupModule() {
  const modulePath = './' + 'backupPayload';
  return import(modulePath);
}

describe('EDU-PLAN-01A backup v3 planning compatibility', () => {
  test('exports planning in application backup data version 3', async () => {
    const backup = await loadBackupModule();

    expect(backup.BACKUP_DATA_VERSION_V3).toBe(3);
    const payload = backup.createBackupPayload(completePlanningSnapshot as any, '2026-10-24T10:00:00.000Z');

    expect(payload.backupDataVersion).toBe(3);
    expect(payload.snapshot.planning).toEqual(completePlanningSnapshot.planning);
  });

  test('normalizes v2 backup into v3 runtime state with empty planning', async () => {
    const backup = await loadBackupModule();
    const restored = backup.normalizeBackupPayload({
      app: 'registro-docente',
      backupDataVersion: 2,
      exportedAt: '2026-10-23T10:00:00.000Z',
      snapshot: sixDatasetSnapshot
    }, completePlanningSnapshot as any);

    expect(restored).toEqual({
      ...sixDatasetSnapshot,
      planning: emptyPlanning
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
