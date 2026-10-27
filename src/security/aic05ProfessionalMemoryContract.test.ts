import { describe, expect, test } from 'bun:test';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import { createBackupPayload, normalizeBackupPayload } from './backupPayload';

const EMPTY_STATE = new URL('../memory/emptyProfessionalMemoryState.ts', import.meta.url);
const POLICY = new URL('../memory/memoryPolicy.ts', import.meta.url);
const TYPES = new URL('../memory/types.ts', import.meta.url);
const VAULT_TYPES = new URL('./vaultTypes.ts', import.meta.url);
const VAULT_STORE = new URL('./vaultStore.ts', import.meta.url);
const APP_STORAGE = new URL('./secureAppStorage.ts', import.meta.url);

const emptyPlanning = {
  schemaVersion: 1 as const,
  profiles: [],
  arenaContexts: [],
  resources: [],
  masterPrograms: [],
  classInstances: []
};

const emptyLibrary = { schemaVersion: 1 as const, sources: [] };

function currentSnapshotWithMemory() {
  return {
    appData: { classes: [], currentClassId: null },
    settings: {
      school: 'IC',
      year: '2026/27',
      teacher: 'Docente',
      subject: 'Tecnologia',
      theme: 'cyan'
    },
    udas: [],
    customTests: {},
    submissions: [],
    planning: emptyPlanning,
    library: emptyLibrary,
    professionalMemory: createEmptyProfessionalMemoryState(),
    meta: { changes: 0, lastBackup: null }
  };
}

describe('AIC-05 professional memory foundation contract', () => {
  test('defines the memory domain with every automatic category disabled by default', async () => {
    const [emptyState, types] = await Promise.all([
      Bun.file(EMPTY_STATE).text(),
      Bun.file(TYPES).text()
    ]);

    expect(types).toContain("'format-preference'");
    expect(types).toContain("'didactic-pattern'");
    expect(types).toContain("'material-reuse'");
    expect(types).toContain("'planning-continuity'");
    expect(types).toContain("'workflow-preference'");
    expect(emptyState).toContain('createEmptyProfessionalMemoryState');
    expect(emptyState).toContain("'format-preference': false");
    expect(emptyState).toContain("'didactic-pattern': false");
    expect(emptyState).toContain("'material-reuse': false");
    expect(emptyState).toContain("'planning-continuity': false");
    expect(emptyState).toContain("'workflow-preference': false");
  });

  test('fails closed for student-personal and ambiguous memory candidates', async () => {
    const [policy, types] = await Promise.all([
      Bun.file(POLICY).text(),
      Bun.file(TYPES).text()
    ]);

    expect(policy).toContain('DENY_STUDENT_PERSONAL');
    expect(policy).toContain('DENY_AMBIGUOUS');
    expect(types).toContain('TEACHER_PROFESSIONAL');
    expect(types).toContain('CURRICULUM_PLANNING');
    expect(types).toContain('PUBLIC_EXTERNAL_CONTENT');
    expect(types).toContain('AGGREGATED_NON_IDENTIFIABLE');
  });

  test('promotes professional memory to the existing encrypted vault record set without a new database store', async () => {
    const [vaultTypes, vaultStore, appStorage] = await Promise.all([
      Bun.file(VAULT_TYPES).text(),
      Bun.file(VAULT_STORE).text(),
      Bun.file(APP_STORAGE).text()
    ]);

    expect(vaultTypes).toContain("| 'professionalMemory'");
    expect(vaultStore).toContain("'professionalMemory'");
    expect(vaultStore).toContain("const DB_VERSION = 1");
    expect(appStorage).toContain('professionalMemory: ProfessionalMemoryStateV1');
    expect(appStorage).toContain("this.vault.get<ProfessionalMemoryStateV1>('professionalMemory')");
    expect(appStorage).toContain('saveProfessionalMemory(value: ProfessionalMemoryStateV1)');
    expect(appStorage).toContain('saveProfessionalMemoryAndMeta(');
  });

  test('backup v5 round-trips professional memory and older v4 normalizes it to empty', () => {
    const current = currentSnapshotWithMemory();
    const payload = createBackupPayload(current as any, '2026-10-27T09:00:00.000Z');

    expect(payload.backupDataVersion).toBe(5);
    expect(payload.snapshot.professionalMemory).toEqual(current.professionalMemory);
    expect(normalizeBackupPayload(payload, current as any).professionalMemory).toEqual(current.professionalMemory);

    const { professionalMemory: _memory, ...snapshotV4 } = current;
    const normalizedV4 = normalizeBackupPayload({
      app: 'registro-docente',
      backupDataVersion: 4,
      exportedAt: '2026-10-26T09:00:00.000Z',
      snapshot: snapshotV4
    }, current as any) as any;

    expect(normalizedV4.professionalMemory).toEqual(createEmptyProfessionalMemoryState());
  });

  test('backup v5 rejects malformed or denied professional memory instead of treating it as an old version', () => {
    const current = currentSnapshotWithMemory();
    const invalidMemory = {
      ...createEmptyProfessionalMemoryState(),
      events: [{
        id: 'event-student',
        kind: 'remember-explicit',
        category: 'workflow-preference',
        occurredAt: '2026-10-27T09:00:00.000Z',
        descriptor: 'dato individuale',
        context: {},
        provenance: { kind: 'teacher-explicit' },
        privacyClassification: 'STUDENT_PERSONAL'
      }]
    };

    expect(() => normalizeBackupPayload({
      app: 'registro-docente',
      backupDataVersion: 5,
      exportedAt: '2026-10-27T09:00:00.000Z',
      snapshot: { ...current, professionalMemory: invalidMemory }
    }, current as any)).toThrow(/memory|memoria|privacy/i);
  });
});
