import { describe, expect, test } from 'bun:test';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import { setAutoRememberCategory } from '../memory/professionalMemory';
import { createBackupPayload, normalizeBackupPayload } from './backupPayload';

const EMPTY_STATE = new URL('../memory/emptyProfessionalMemoryState.ts', import.meta.url);
const POLICY = new URL('../memory/memoryPolicy.ts', import.meta.url);
const TYPES = new URL('../memory/types.ts', import.meta.url);
const VAULT_TYPES = new URL('./vaultTypes.ts', import.meta.url);
const VAULT_STORE = new URL('./vaultStore.ts', import.meta.url);
const APP_STORAGE = new URL('./secureAppStorage.ts', import.meta.url);
const APP = new URL('../App.tsx', import.meta.url);

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

describe('AIC-05 governed product integration contract', () => {
  test('derived memory persistence reports failure without publishing a false saved state', async () => {
    const module = await import('../persistence/professionalMemoryOutcome') as typeof import('../persistence/professionalMemoryOutcome');
    const current = setAutoRememberCategory(
      createEmptyProfessionalMemoryState(),
      'material-reuse',
      true
    );
    let persistedCandidate: unknown = null;

    const result = await module.persistDerivedProfessionalMemoryAfterCanonicalCommit({
      current,
      event: {
        id: 'event-link-1',
        kind: 'source-linked',
        category: 'material-reuse',
        occurredAt: '2026-10-27T09:40:00.000Z',
        descriptor: 'Fonte professionale collegata all’UDA corrente.',
        context: { udaId: 'uda-energy', sourceId: 'source-energy' },
        canonicalRef: 'source:source-energy',
        privacyClassification: 'TEACHER_PROFESSIONAL'
      },
      persist: async candidate => {
        persistedCandidate = candidate;
        throw new Error('forced memory write failure');
      }
    });

    expect(persistedCandidate).not.toBeNull();
    expect(result.status).toBe('failed');
    expect(result.state).toEqual(current);
    if (result.status === 'failed') {
      expect(result.error).toContain('forced memory write failure');
    }
    expect(current.events).toEqual([]);
    expect(current.entries).toEqual([]);
  });

  test('App keeps memory aligned with backup restore reset and never widens canonical compound persistence', async () => {
    const app = await Bun.file(APP).text();

    expect(app).toContain('initialSnapshot.professionalMemory || createEmptyProfessionalMemoryState()');
    expect(app).toContain('const professionalMemoryRef = useRef(professionalMemory)');
    expect(app).toContain('professionalMemory: professionalMemoryRef.current');
    expect(app).toContain('professionalMemoryRef.current = restored.professionalMemory');
    expect(app).toContain('setProfessionalMemory(restored.professionalMemory)');
    expect(app).toContain('const resetProfessionalMemory = createEmptyProfessionalMemoryState()');
    expect(app).toContain('professionalMemoryRef.current = resetProfessionalMemory');
    expect(app).toContain('setProfessionalMemory(resetProfessionalMemory)');
    expect(app).not.toContain('saveLibraryUdasAndMeta(candidate.library, candidate.udas, candidate.meta, professionalMemory');
  });

  test('LINK and PREPARE publish canonical refs before derived memory is attempted', async () => {
    const app = await Bun.file(APP).text();

    const prepareStart = app.indexOf('const handleAdoptTeachingProposalToUda');
    const prepareEnd = app.indexOf('const handleAddLibrarySource', prepareStart);
    const prepare = app.slice(prepareStart, prepareEnd);
    expect(prepare).toContain('await secureStorage.saveLibraryUdasAndMeta(candidate.library, candidate.udas, candidate.meta)');
    expect(prepare).toContain('libraryRef.current = candidate.library');
    expect(prepare).toContain('udasRef.current = candidate.udas');
    expect(prepare).toContain('await persistDerivedMemoryEvent');
    expect(prepare.indexOf('await secureStorage.saveLibraryUdasAndMeta')).toBeLessThan(prepare.indexOf('libraryRef.current = candidate.library'));
    expect(prepare.indexOf('libraryRef.current = candidate.library')).toBeLessThan(prepare.indexOf('await persistDerivedMemoryEvent'));
    expect(prepare.indexOf('udasRef.current = candidate.udas')).toBeLessThan(prepare.indexOf('await persistDerivedMemoryEvent'));

    const linkStart = app.indexOf('const handleLinkLibrarySource');
    const linkEnd = app.indexOf('const handleUnlinkLibrarySource', linkStart);
    const link = app.slice(linkStart, linkEnd);
    expect(link).toContain('commitLibraryMutation');
    expect(link).toContain('await persistDerivedMemoryEvent');
    expect(link.indexOf('commitLibraryMutation')).toBeLessThan(link.indexOf('await persistDerivedMemoryEvent'));
  });

  test('LINK-derived memory runs inside the same mutation ordering as explicit memory changes', async () => {
    const app = await Bun.file(APP).text();
    const linkStart = app.indexOf('const handleLinkLibrarySource');
    const linkEnd = app.indexOf('const handleUnlinkLibrarySource', linkStart);
    const link = app.slice(linkStart, linkEnd);

    expect(link).toContain('async committedLibrary =>');
    expect(link).toContain('await persistDerivedMemoryEvent');
    expect(link.indexOf('async committedLibrary =>')).toBeLessThan(link.indexOf('await persistDerivedMemoryEvent'));
    expect(link).toContain('[commitLibraryMutation, persistDerivedMemoryEvent]');
  });

  test('App exposes a separate non-destructive memory error instead of reusing canonical save failure state', async () => {
    const app = await Bun.file(APP).text();
    expect(app).toContain('const [professionalMemoryError, setProfessionalMemoryError]');
    expect(app).toContain('setProfessionalMemoryError(message)');
    expect(app).toContain("console.error('Professional memory save failed', error)");
  });
});