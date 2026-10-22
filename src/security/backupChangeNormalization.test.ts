import { describe, expect, test } from 'bun:test';
import { incrementBackupChanges } from '../persistence/backupCheckpoint';
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
});
