import { describe, expect, test } from 'bun:test';
import type { CompleteSecureAppSnapshot } from './secureAppStorage';
import { createBackupPayload, normalizeBackupPayload } from './backupPayload';

function currentSnapshot(): CompleteSecureAppSnapshot {
  return {
    appData: { classes: [], currentClassId: null },
    settings: { school: 'IC Current', year: '2026/27', teacher: 'Docente', subject: 'Tecnologia', theme: 'cyan' },
    udas: [{ id: 'uda-current', title: 'Current', startMonth: 0, durationMonths: 1, hours: 1 } as any],
    customTests: {},
    submissions: [],
    meta: { changes: 4, lastBackup: null }
  };
}

describe('SEC-1 backup application payload', () => {
  test('exports all six secure datasets in a versioned payload', () => {
    const snapshot = currentSnapshot();
    const payload = createBackupPayload(snapshot, '2026-10-21T12:00:00.000Z');

    expect(payload.app).toBe('registro-docente');
    expect(payload.backupDataVersion).toBe(2);
    expect(payload.exportedAt).toBe('2026-10-21T12:00:00.000Z');
    expect(payload.snapshot).toEqual(snapshot);
    expect(Object.keys(payload.snapshot).sort()).toEqual([
      'appData', 'customTests', 'meta', 'settings', 'submissions', 'udas'
    ]);
  });

  test('accepts a complete v2 payload and rejects unsupported versions', () => {
    const current = currentSnapshot();
    const payload = createBackupPayload(current);

    expect(normalizeBackupPayload(payload, current)).toEqual(current);
    expect(() => normalizeBackupPayload({ ...payload, backupDataVersion: 99 }, current)).toThrow(/versione/i);
  });

  test('normalizes legacy classes/settings backup while preserving datasets it never contained', () => {
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
    expect(normalized.meta).toEqual(current.meta);
  });

  test('rejects foreign or structurally incomplete v2 payloads', () => {
    const current = currentSnapshot();
    const payload = createBackupPayload(current);

    expect(() => normalizeBackupPayload({ ...payload, app: 'other-app' }, current)).toThrow(/registro-docente/i);
    expect(() => normalizeBackupPayload({ ...payload, snapshot: { settings: current.settings } }, current)).toThrow(/completo/i);
  });
});
