import { describe, expect, test } from 'bun:test';
import { applyBackupReceipt, incrementBackupChanges } from '../persistence/backupCheckpoint';
import type { PreparedBackupCheckpoint } from '../persistence/backupCheckpoint';
import type { SecureMeta } from './secureAppStorage';

describe('PERSIST-01H backup change normalization', () => {
  test('invalid restored change counts normalize to zero before incrementing', () => {
    const lastBackup = '2026-10-22T08:00:00.000Z';
    const invalidValues: unknown[] = [undefined, '7', Number.NaN, Number.POSITIVE_INFINITY];

    for (const changes of invalidValues) {
      const meta = { changes, lastBackup } as unknown as SecureMeta;
      const result = incrementBackupChanges(meta);

      expect(result).toEqual({ changes: 1, lastBackup });
      expect(Number.isFinite(result.changes)).toBe(true);
    }
  });

  test('invalid current and checkpoint change counts normalize before applying a backup receipt', () => {
    const checkpointAt = '2026-10-22T09:00:00.000Z';
    const invalidValues: unknown[] = [undefined, '7', Number.NaN, Number.POSITIVE_INFINITY, -3];

    for (const changes of invalidValues) {
      const result = applyBackupReceipt(
        { changes, lastBackup: null } as unknown as SecureMeta,
        { includedChanges: 2, checkpointAt }
      );

      expect(result).toEqual({ changes: 0, lastBackup: checkpointAt });
      expect(Number.isFinite(result.changes)).toBe(true);
    }

    for (const includedChanges of invalidValues) {
      const result = applyBackupReceipt(
        { changes: 5, lastBackup: null },
        { includedChanges, checkpointAt } as unknown as Pick<PreparedBackupCheckpoint, 'includedChanges' | 'checkpointAt'>
      );

      expect(result).toEqual({ changes: 5, lastBackup: checkpointAt });
      expect(Number.isFinite(result.changes)).toBe(true);
    }
  });
});
