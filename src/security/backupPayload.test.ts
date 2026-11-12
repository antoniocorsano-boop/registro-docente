import { createInitialArchiveSnapshot } from './initialArchiveSetup';
import { describe, expect, test } from 'bun:test';
import { createEmptyCopilotState } from '../copilot/emptyCopilotState';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import type { CompleteSecureAppSnapshot } from './secureAppStorage';
import { createBackupPayload, normalizeBackupPayload } from './backupPayload';

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

function currentSnapshot(): CompleteSecureAppSnapshot {
  return {
    appData: { classes: [], currentClassId: null },
    settings: { school: 'IC Current', year: '2026/27', teacher: 'Docente', subject: 'Tecnologia', theme: 'cyan' },
    udas: [{ id: 'uda-current', title: 'Current', startMonth: 0, durationMonths: 1, hours: 1 } as any],
    customTests: {},
    submissions: [],
    planning: { ...emptyPlanningV2, profiles: [{ id: 'profile-current' } as any] },
    library: emptyLibrary,
    professionalMemory: createEmptyProfessionalMemoryState(),
    copilotState: createEmptyCopilotState(),
    meta: { changes: 4, lastBackup: null }
  };
}

function historicalPlanningFrom(snapshot: CompleteSecureAppSnapshot) {
  return {
    ...legacyPlanningV1,
    profiles: snapshot.planning.profiles
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
    snapshot: {
      ...snapshotV4,
      planning: historicalPlanningFrom(snapshot)
    }
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

  test('accepts a complete current v6 payload and keeps unsupported versions fail-closed', () => {
    const current = currentSnapshot();
    const payload = createBackupPayload(current);

    expect(normalizeBackupPayload(payload, current)).toEqual(current);
    expect(() => normalizeBackupPayload({ ...payload, backupDataVersion: 99 }, current)).toThrow(/versione/i);
  });

  test('normalizes a valid historical v4 payload to current planning v2 with empty professional memory and Copilot state', () => {
    const current = currentSnapshot();
    const normalized = normalizeBackupPayload(v4Payload(current), current);

    expect(normalized.library).toEqual(current.library);
    expect(normalized.planning).toEqual(current.planning);
    expect(normalized.professionalMemory).toEqual(createEmptyProfessionalMemoryState());
    expect(normalized.copilotState).toEqual(createEmptyCopilotState());
  });

  test('normalizes a valid historical v3 payload to current planning v2 with empty private library, professional memory and Copilot state', () => {
    const current = currentSnapshot();
    const historicalV4 = v4Payload(current).snapshot;
    const {
      library: _library,
      ...snapshotV3
    } = historicalV4;
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

  test('normalizes legacy classes/settings backup while preserving old datasets and resetting planning to current v2', () => {
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
    expect(normalized.planning).toEqual(emptyPlanningV2);
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

  test('INT-02/S2b: keeps confirmed metadata in an encrypted-backup round-trip and old tests without metadata', () => {
    const current = currentSnapshot();
    const provenance = {
      version: 1 as const, kind: 'library-source' as const, sourceId: 'teacher-source', confirmedByTeacher: true as const
    };
    const snapshot = {
      ...current,
      customTests: {
        historical: { id: 'historical', title: 'Storica', questions: [] },
        linked: { id: 'linked', title: 'Fonte confermata', questions: [], provenance }
      }
    };
    const payload = createBackupPayload(snapshot);
    const restored = normalizeBackupPayload(JSON.parse(JSON.stringify(payload)), current);
    expect(restored.customTests).toEqual(snapshot.customTests);
    expect(restored.customTests.linked.provenance).toEqual(provenance);
    expect(restored.customTests.historical.provenance).toBeUndefined();
  });

  test('INT-02/S2b: rejects malformed provenance in v2–v6 and legacy without modifying current data', () => {
    const current = currentSnapshot();
    const malformed = { id: 'bad', title: 'Verifica', questions: [], provenance: {
      version: 1, kind: 'library-source', sourceId: 'teacher-source', confirmedByTeacher: false
    } };
    const v6 = createBackupPayload({ ...current, customTests: { bad: malformed as any } });
    const v4 = v4Payload({ ...current, customTests: { bad: malformed as any } });
    const { professionalMemory: _memory, copilotState: _copilot, ...v5Snapshot } = v6.snapshot;
    // v5 requires professionalMemory, but no copilotState.
    const v5 = { ...v6, backupDataVersion: 5, snapshot: { ...v5Snapshot, professionalMemory: v6.snapshot.professionalMemory } };
    const { library: _library, ...v3Snapshot } = v4.snapshot;
    const { planning: _planning, ...v2Snapshot } = v3Snapshot;
    for (const payload of [
      v6, v5, v4,
      { app: 'registro-docente', backupDataVersion: 3, snapshot: v3Snapshot },
      { app: 'registro-docente', backupDataVersion: 2, snapshot: v2Snapshot },
      { app: 'registro-docente', classes: [], customTests: { bad: malformed } }
    ]) {
      expect(() => normalizeBackupPayload(payload, current)).toThrow();
    }
    expect(current.customTests).toEqual({});
  });
});

describe('BETA-1 restore archive identity', () => {
  const professional = () => createInitialArchiveSnapshot({
    mode: 'professional', profile: { school: 'IC Synthetic', year: '2026/27', teacher: 'Synthetic', subject: 'Tecnologia' }
  });
  test('preserves explicit modern mode and empty datasets when replacing demo data', () => {
    const source = professional();
    const current = createInitialArchiveSnapshot({ mode: 'demo' });
    expect(normalizeBackupPayload(createBackupPayload(source), current)).toEqual(source);
    expect(normalizeBackupPayload(createBackupPayload(current), source)).toEqual(current);
  });

  test('retains destination mode for unclassified historical v2–v6 backups without injecting demo records', () => {
    const current = professional();
    const { archiveMode, ...settings } = current.settings;
    const historical = { ...current, settings: { ...settings, school: 'IC Historical' } };
    const v6 = createBackupPayload(historical);
    const { copilotState, ...v5 } = v6.snapshot;
    const { professionalMemory, ...v4 } = v5;
    const { library, ...v3 } = v4;
    const { planning, ...v2 } = v3;
    for (const [version, snapshot] of [[2, v2], [3, v3], [4, v4], [5, v5], [6, v6.snapshot]] as const) {
      const restored = normalizeBackupPayload({ app: 'registro-docente', backupDataVersion: version, snapshot }, current);
      expect(restored.settings.archiveMode).toBe('professional');
      expect(restored.settings.school).toBe('IC Historical');
      expect(restored.appData.classes).toEqual([]);
      expect(restored.udas).toEqual([]);
      expect(restored.customTests).toEqual({});
      expect(restored.submissions).toEqual([]);
    }
  });

  test('legacy JSON preserves explicit destination mode and historical records, with no implicit demo data', () => {
    const current = professional();
    const { archiveMode, ...settings } = current.settings;
    const legacy = { app: 'registro-docente', classes: [], settings: { ...settings, school: 'IC Historical' }, customTests: {}, udas: [], submissions: [] };
    const restored = normalizeBackupPayload(legacy, current);
    expect(restored.settings).toEqual({ ...legacy.settings, archiveMode: 'professional' });
    expect(restored.appData.classes).toEqual([]);
    expect(restored.customTests).toEqual({});
    expect(restored.udas).toEqual([]);
    expect(normalizeBackupPayload(legacy, { ...current, settings }).settings.archiveMode).toBeUndefined();
  });

  test('rejects invalid explicit modes in modern and historical JSON without modifying destination', () => {
    const current = professional();
    const invalid = { ...current, settings: { ...current.settings, archiveMode: 'unknown' } };
    expect(() => normalizeBackupPayload({ ...createBackupPayload(current), snapshot: invalid }, current)).toThrow(/Modalità archivio/);
    expect(() => normalizeBackupPayload({ classes: [], settings: invalid.settings }, current)).toThrow(/Modalità archivio/);
    expect(current.settings.archiveMode).toBe('professional');
  });
});
