import { describe, expect, test } from 'bun:test';
import { createEmptyCopilotState } from '../copilot/emptyCopilotState';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
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
    professionalMemory: createEmptyProfessionalMemoryState(),
    copilotState: createEmptyCopilotState(),
    meta: { changes: 4, lastBackup: null }
  };
}

function v4Payload(snapshot: CompleteSecureAppSnapshot) {
  const {
    professionalMemory: _professionalMemory,
    copilotState: _copilotState,
    ...snapshotV4
  } = snapshot;
  return {
    app: 'registro-docente' as const,
    backupDataVersion: 4 as const,
    exportedAt: '2026-10-24T10:00:00.000Z',
    snapshot: snapshotV4
  };
}

describe('SEC-1 backup application payload', () => {
  test('exports all ten secure datasets in a versioned v6 payload', () => {
    const snapshot = currentSnapshot();
    const payload = createBackupPayload(snapshot, '2026-10-21T12:00:00.000Z');

    expect(payload.app).toBe('registro-docente');
    expect(payload.backupDataVersion).toBe(6);
    expect(payload.exportedAt).toBe('2026-10-21T12:00:00.000Z');
    expect(payload.snapshot).toEqual(snapshot);
    expect(Object.keys(payload.snapshot).sort()).toEqual([
      'appData', 'copilotState', 'customTests', 'library', 'meta', 'planning', 'professionalMemory', 'settings', 'submissions', 'udas'
    ]);
  });

  test('accepts a complete v6 payload and keeps unsupported versions fail-closed', () => {
    const current = currentSnapshot();
    const payload = createBackupPayload(current);

    expect(normalizeBackupPayload(payload, current)).toEqual(current);
    expect(() => normalizeBackupPayload({ ...payload, backupDataVersion: 99 }, current)).toThrow(/versione/i);
  });

  test('normalizes a valid v4 payload with empty professional memory and Copilot state', () => {
    const current = currentSnapshot();
    const normalized = normalizeBackupPayload(v4Payload(current), current);

    expect(normalized.library).toEqual(current.library);
    expect(normalized.planning).toEqual(current.planning);
    expect(normalized.professionalMemory).toEqual(createEmptyProfessionalMemoryState());
    expect(normalized.copilotState).toEqual(createEmptyCopilotState());
  });

  test('normalizes a valid v3 payload with empty private library, professional memory and Copilot state', () => {
    const current = currentSnapshot();
    const {
      library: _library,
      professionalMemory: _professionalMemory,
      copilotState: _copilotState,
      ...snapshotV3
    } = current;
    const normalized = normalizeBackupPayload({
      app: 'registro-docente',
      backupDataVersion: 3,
      exportedAt: '2026-10-20T10:00:00.000Z',
      snapshot: snapshotV3
    }, current);

    expect(normalized.library).toEqual(emptyLibrary);
    expect(normalized.planning).toEqual(current.planning);
    expect(normalized.professionalMemory).toEqual(createEmptyProfessionalMemoryState());
    expect(normalized.copilotState).toEqual(createEmptyCopilotState());
  });

  test('rejects a v4 payload whose library is structurally invalid', () => {
    const current = currentSnapshot();
    const payload = v4Payload(current);
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

  test('rejects malformed optional library fields during v4 restore', () => {
    const current = currentSnapshot();
    const payload = v4Payload(current);
    const corrupted = {
      ...payload,
      snapshot: {
        ...payload.snapshot,
        library: {
          schemaVersion: 1,
          sources: [{
            id: 'web-1',
            kind: 'web',
            title: 'Fonte',
            capturedAt: '2026-10-24T10:00:00.000Z',
            sourceUrl: 'https://example.org/resource',
            payload: { text: 42 },
            status: 'ready',
            privacy: 'unknown',
            links: []
          }]
        }
      }
    };

    expect(() => normalizeBackupPayload(corrupted, current)).toThrow(/backup v4|library|biblioteca/i);
  });

  test('rejects non-http source URLs during v4 restore', () => {
    const current = currentSnapshot();
    const payload = v4Payload(current);
    const corrupted = {
      ...payload,
      snapshot: {
        ...payload.snapshot,
        library: {
          schemaVersion: 1,
          sources: [{
            id: 'web-unsafe',
            kind: 'web',
            title: 'Fonte',
            capturedAt: '2026-10-24T10:00:00.000Z',
            sourceUrl: 'javascript:alert(1)',
            payload: {},
            status: 'ready',
            privacy: 'unknown',
            links: []
          }]
        }
      }
    };

    expect(() => normalizeBackupPayload(corrupted, current)).toThrow(/backup v4|library|biblioteca/i);
  });

  test('rejects restored image payloads that would trigger a remote request', () => {
    const current = currentSnapshot();
    const payload = v4Payload(current);
    const corrupted = {
      ...payload,
      snapshot: {
        ...payload.snapshot,
        library: {
          schemaVersion: 1,
          sources: [{
            id: 'image-remote',
            kind: 'image',
            title: 'Immagine',
            capturedAt: '2026-10-24T10:00:00.000Z',
            payload: {
              mimeType: 'image/png',
              dataUrl: 'https://tracker.example/pixel.png'
            },
            status: 'captured',
            privacy: 'unknown',
            links: []
          }]
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
    expect(normalized.professionalMemory).toEqual(createEmptyProfessionalMemoryState());
    expect(normalized.copilotState).toEqual(createEmptyCopilotState());
    expect(normalized.meta).toEqual(current.meta);
  });

  test('rejects foreign or structurally incomplete v4 payloads', () => {
    const current = currentSnapshot();
    const payload = v4Payload(current);

    expect(() => normalizeBackupPayload({ ...payload, app: 'other-app' }, current)).toThrow(/registro-docente/i);
    expect(() => normalizeBackupPayload({ ...payload, snapshot: { settings: current.settings } }, current)).toThrow(/completo/i);
  });
});