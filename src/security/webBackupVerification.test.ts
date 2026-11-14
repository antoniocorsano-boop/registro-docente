import { describe, expect, test } from 'bun:test';
import { expectedBackupEvidence, matchesDownloadedBackup, WEB_BACKUP_VERIFICATION_MAX_BYTES } from './webBackupVerification';

describe('BACKUP-02/B3 exact web copy verification', () => {
  const text = '{"ciphertext":"sintetico-è"}';
  test('matches exact encrypted UTF-8 bytes, independent of filename', async () => {
    const expected = await expectedBackupEvidence(text);
    expect(expected.bytes).toBe(new TextEncoder().encode(text).byteLength);
    expect(expected.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await matchesDownloadedBackup(new Blob([text]), expected)).toBe(true);
  });
  test('rejects truncation, appended bytes, same-size tampering and unrelated file', async () => {
    const expected = await expectedBackupEvidence(text);
    for (const wrong of [text.slice(0,-1), text+' ', text.replace('sintetico','modificato').slice(0,-1), text.replace('s','x'), '{}']) {
      expect(await matchesDownloadedBackup(new Blob([wrong]), expected)).toBe(false);
    }
  });
  test('rejects bad expected evidence and oversized files before reading', async () => {
    const expected = await expectedBackupEvidence(text);
    let reads = 0;
    const oversized = { size: WEB_BACKUP_VERIFICATION_MAX_BYTES+1, arrayBuffer: async () => { reads++; return new ArrayBuffer(0); } } as Blob;
    expect(await matchesDownloadedBackup(oversized, expected)).toBe(false);
    expect(await matchesDownloadedBackup(new Blob([text]), { ...expected, sha256: 'bad' })).toBe(false);
    expect(reads).toBe(0);
    await expect(expectedBackupEvidence('')).rejects.toThrow();
  });
  test('read error never reports verification', async () => {
    const expected = await expectedBackupEvidence(text);
    const unreadable = { size: expected.bytes, arrayBuffer: async () => { throw Error('synthetic read failure'); } } as Blob;
    await expect(matchesDownloadedBackup(unreadable, expected)).rejects.toThrow();
  });
});
