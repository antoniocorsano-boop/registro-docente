import { describe, expect, test } from 'bun:test';
import type { CompleteSecureAppSnapshot } from './secureAppStorage';
import { createBackupPayload, normalizeBackupPayload } from './backupPayload';

const emptyPlanning = {
  schemaVersion: 1 as const,
  profiles: [],
  arenaContexts: [],
  resources: [],
  masterPrograms: [],
  classInstances: []
};

const emptyLibrary = { schemaVersion: 1 as const, sources: [] };

function currentSnapshot(): CompleteSecureAppSnapshot {
  return {
    appData: { classes: [], currentClassId: null },
    settings: { school: 'IC Current', year: '2026/27', teacher: 'Docente', subject: 'Tecnologia', theme: 'cyan' },
    udas: [{ id: 'uda-current', title: 'Current', startMonth: 0, durationMonths: 1, hours: 1 } as any],
    customTests: {},
    submissions: [],
    planning: { ...emptyPlanning, profiles: [{ id: 'profile-current' } as any] },
    library: emptyLibrary,
    meta: { changes: 4, lastBackup: null }
  };
}

describe('SEC-1 backup application payload', () => {
  test('exports all eight secure datasets in a versioned v4 payload', () => {
    const snapshot = currentSnapshot();
    const payload = createBackupPayload(snapshot, '2026-10-21T12:00:00.000Z');

    expect(payload.app).toBe('registro-docente');
    expect(payload.backupDataVersion).toBe(4);
    expect(payload.exportedAt).toBe('2026-10-21T12:00:00.000Z');
    expect(payload.snapshot).toEqual(snapshot);
    expect(Object.keys(payload.snapshot).sort()).toEqual([
      'appData', 'customTests', 'library', 'meta', 'planning', 'settings', 'submissions', 'udas'
    ]);
  });

  test('accepts a complete v4 payload and keeps unsupported versions fail-closed', () => {
    const current = currentSnapshot();
    const payload = createBackupPayload(current);

    expect(normalizeBackupPayload(payload, current)).toEqual(current);
    expect(() => normalizeBackupPayload({ ...payload, backupDataVersion: 99 }, current)).toThrow(/versione/i);
  });

  test('normalizes a valid v3 payload with an empty private library', () => {
    const current = currentSnapshot();
    const { library: _library, ...snapshotV3 } = current;
    const normalized = normalizeBackupPayload({
      app: 'registro-docente',
      backupDataVersion: 3,
      exportedAt: '2026-10-20T10:00:00.000Z',
      snapshot: snapshotV3
    }, current);

    expect(normalized.library).toEqual(emptyLibrary);
    expect(normalized.planning).toEqual(current.planning);
  });

  test('rejects a v4 payload whose library is structurally invalid', () => {
    const current = currentSnapshot();
    const payload = createBackupPayload(current);
    const corrupted = {
      ...payload,
      snapshot: {
        ...payload.snapshot,
        library: {
          schemaVersion: 1,
          sources: [{ id: 'broken' }]
        }
      }
    };

    expect(() => normalizeBackupPayload(corrupted, current)).toThrow(/backup v4|library|biblioteca/i);
  });

  test('normalizes legacy classes/settings backup while preserving old datasets and resetting planning', () => {
    const current = currentSnapshot();
    const legacy = {
      app: 'registro-docente',
      version: 2,
      classes: [{ id: 'legacy-class', name: '3C', students: [], grades: [], behaviors: [] }],
      settings: { school: 'IC Legacy', year: '2026/27', teacher: 'Docente', subject: 'Tecnologia', theme: 'cyan' }
    };

    const normalized = normalizeBackupPayload(legacy, current);

    expect(normalized.appData.classes).toEqual(legacy.classes);
    expect(normalized.settings.school).toBe('IC Legacy');
    expect(normalized.udas).toEqual(current.udas);
    expect(normalized.customTests).toEqual(current.customTests);
    expect(normalized.submissions).toEqual(current.submissions);
    expect(normalized.planning).toEqual(emptyPlanning);
    expect(normalized.library).toEqual(emptyLibrary);
    expect(normalized.meta).toEqual(current.meta);
  });

  test('rejects foreign or structurally incomplete v3 payloads', () => {
    const current = currentSnapshot();
    const payload = createBackupPayload(current);

    expect(() => normalizeBackupPayload({ ...payload, app: 'other-app' }, current)).toThrow(/registro-docente/i);
    expect(() => normalizeBackupPayload({ ...payload, snapshot: { settings: current.settings } }, current)).toThrow(/completo/i);
  });
});
