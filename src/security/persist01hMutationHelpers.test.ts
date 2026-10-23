import { describe, expect, test } from 'bun:test';
import type { AppSettings, ClassData, OnlineSubmission } from '../types';
import type { CompleteSecureAppSnapshot, SecureMeta } from './secureAppStorage';

const settingsModulePath: string = '../persistence/settingsMutation';
const backupModulePath: string = '../persistence/backupCheckpoint';
const importModulePath: string = '../persistence/submissionGradeImport';

const baseSettings: AppSettings = {
  school: 'IC Base',
  year: '2026/27',
  teacher: 'Docente',
  subject: 'Tecnologia',
  theme: 'cyan',
  useWeightedAverage: false
};

function completeSnapshot(changes = 4): CompleteSecureAppSnapshot {
  return {
    appData: { classes: [], currentClassId: null },
    settings: { ...baseSettings },
    udas: [],
    customTests: {},
    submissions: [],
    meta: { changes, lastBackup: '2026-10-20T08:00:00.000Z' }
  };
}

function classFixture(): ClassData[] {
  return [{
    id: 'class-3a',
    name: '3ª A',
    students: [{ id: 'student-1', name: 'Rossi Mario' }],
    grades: [],
    behaviors: []
  }];
}

function submission(id: string, overrides: Partial<OnlineSubmission> = {}): OnlineSubmission {
  return {
    id,
    name: 'Rossi Mario',
    class: '3ª A',
    testTitle: 'Energia',
    testId: 'test-energia',
    score: 8,
    total: 10,
    date: '2026-10-22T10:00:00.000Z',
    ...overrides
  };
}

describe('PERSIST-01H pure mutation helpers', () => {
  test('settings diff contains only changed top-level fields and theme patch preserves newer committed fields', async () => {
    const module = await import(settingsModulePath) as {
      diffSettings: (base: AppSettings, candidate: AppSettings) => Partial<AppSettings>;
      applySettingsPatch: (current: AppSettings, patch: Partial<AppSettings>) => AppSettings;
    };
    const candidate: AppSettings = {
      ...baseSettings,
      school: 'IC Draft',
      theme: 'purple'
    };

    expect(module.diffSettings(baseSettings, candidate)).toEqual({
      school: 'IC Draft',
      theme: 'purple'
    });

    const newerCommitted: AppSettings = {
      ...baseSettings,
      school: 'IC Committed Later',
      teacher: 'Docente Aggiornato'
    };
    expect(module.applySettingsPatch(newerCommitted, { theme: 'matrix' })).toEqual({
      ...newerCommitted,
      theme: 'matrix'
    });
  });

  test('backup change increment preserves lastBackup and advances exactly once', async () => {
    const module = await import(backupModulePath) as {
      incrementBackupChanges: (meta: SecureMeta) => SecureMeta;
    };
    const current: SecureMeta = { changes: 7, lastBackup: '2026-10-20T08:00:00.000Z' };
    expect(module.incrementBackupChanges(current)).toEqual({
      changes: 8,
      lastBackup: current.lastBackup
    });
    expect(current.changes).toBe(7);
  });

  test('prepared backup is self-consistent without mutating the live snapshot', async () => {
    const module = await import(backupModulePath) as {
      prepareBackupCheckpoint: (snapshot: CompleteSecureAppSnapshot, at: string) => {
        snapshot: CompleteSecureAppSnapshot;
        includedChanges: number;
        checkpointAt: string;
      };
    };
    const live = completeSnapshot(5);
    const checkpointAt = '2026-10-22T16:00:00.000Z';
    const prepared = module.prepareBackupCheckpoint(live, checkpointAt);

    expect(prepared.includedChanges).toBe(5);
    expect(prepared.checkpointAt).toBe(checkpointAt);
    expect(prepared.snapshot.meta).toEqual({ changes: 0, lastBackup: checkpointAt });
    expect(live.meta).toEqual({ changes: 5, lastBackup: '2026-10-20T08:00:00.000Z' });
    expect(prepared.snapshot).not.toBe(live);
    expect(prepared.snapshot.settings).not.toBe(live.settings);
  });

  test('backup receipt subtracts only included changes and preserves later committed work', async () => {
    const module = await import(backupModulePath) as {
      applyBackupReceipt: (current: SecureMeta, checkpoint: { includedChanges: number; checkpointAt: string }) => SecureMeta;
    };
    const result = module.applyBackupReceipt(
      { changes: 7, lastBackup: null },
      { includedChanges: 5, checkpointAt: '2026-10-22T16:00:00.000Z' }
    );
    expect(result).toEqual({
      changes: 2,
      lastBackup: '2026-10-22T16:00:00.000Z'
    });
    expect(module.applyBackupReceipt(
      { changes: 2, lastBackup: null },
      { includedChanges: 5, checkpointAt: '2026-10-22T16:00:00.000Z' }
    ).changes).toBe(0);
  });

  test('first submission import uses deterministic batch identity', async () => {
    const module = await import(importModulePath) as {
      reconcileSubmissionGrades: (classes: ClassData[], submissions: OnlineSubmission[], targetUdaId?: string) => { classes: ClassData[]; importedCount: number };
    };
    const result = module.reconcileSubmissionGrades(classFixture(), [submission('sub-1')], 'uda-1');

    expect(result.importedCount).toBe(1);
    expect(result.classes[0].grades).toHaveLength(1);
    expect(result.classes[0].grades[0].batchId).toBe('online_sub-1');
    expect(result.classes[0].grades[0].udaId).toBe('uda-1');
  });

  test('re-import of the same submission reconciles instead of duplicating the grade', async () => {
    const module = await import(importModulePath) as {
      reconcileSubmissionGrades: (classes: ClassData[], submissions: OnlineSubmission[], targetUdaId?: string) => { classes: ClassData[]; importedCount: number };
    };
    const first = module.reconcileSubmissionGrades(classFixture(), [submission('sub-1')]);
    const second = module.reconcileSubmissionGrades(first.classes, [submission('sub-1', { score: 9 })]);

    expect(second.importedCount).toBe(1);
    expect(second.classes[0].grades).toHaveLength(1);
    expect(second.classes[0].grades[0].batchId).toBe('online_sub-1');
    expect(second.classes[0].grades[0].value).toBe('9');
  });

  test('different submission ids produce distinct deterministic imported batches', async () => {
    const module = await import(importModulePath) as {
      reconcileSubmissionGrades: (classes: ClassData[], submissions: OnlineSubmission[], targetUdaId?: string) => { classes: ClassData[]; importedCount: number };
    };
    const result = module.reconcileSubmissionGrades(classFixture(), [submission('sub-1'), submission('sub-2')]);

    expect(result.importedCount).toBe(2);
    expect(result.classes[0].grades.map(grade => grade.batchId).sort()).toEqual(['online_sub-1', 'online_sub-2']);
  });

  test('unmatched class or student creates no grade and is not counted', async () => {
    const module = await import(importModulePath) as {
      reconcileSubmissionGrades: (classes: ClassData[], submissions: OnlineSubmission[], targetUdaId?: string) => { classes: ClassData[]; importedCount: number };
    };
    const result = module.reconcileSubmissionGrades(classFixture(), [
      submission('sub-class', { class: '9ª Z' }),
      submission('sub-student', { name: 'Persona Sconosciuta' })
    ]);

    expect(result.importedCount).toBe(0);
    expect(result.classes[0].grades).toEqual([]);
  });
});
