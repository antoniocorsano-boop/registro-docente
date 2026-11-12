import { describe, expect, test } from 'bun:test';
import { encryptDataWithPassword, decryptDataWithPassword } from '../cryptoUtils';
import { isAndroidBackupRuntime, saveEncryptedBackupOnAndroid, type AndroidBackupRuntime } from './androidBackupExport';

const filename = 'Backup_Cifrato_GDPR_2026-11-12.enc.json';
const sample = '{"ciphertext":"synthetic-test"}';
async function verifiedReceipt(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return { status: 'verified', bytes: bytes.length, sha256: Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('') };
}
function runtime(
  choose: (options: { filename: string }) => Promise<unknown>,
  write: (options: { token: string; encryptedText: string }) => Promise<unknown>,
): AndroidBackupRuntime {
  return { androidBridge: {}, Capacitor: { getPlatform: () => 'android', Plugins: {
    RegistroBackupFiles: { chooseBackupDestination: choose, writeEncryptedBackup: write },
  } } };
}

describe('MOBILE-01/M2a Android backup native receipt boundary', () => {
  test('does not treat an ordinary browser as a native Android runtime', () => {
    expect(isAndroidBackupRuntime({})).toBe(false);
    expect(isAndroidBackupRuntime({ Capacitor: { getPlatform: () => 'web' } })).toBe(false);
    expect(isAndroidBackupRuntime({ androidBridge: {} })).toBe(true);
  });
  test('passes only filename to the picker, and only ciphertext to the writer; checks the digest of a real encrypted envelope', async () => {
    const plaintext = { marker: 'synthetic-backup-roundtrip' };
    const password = 'synthetic-test-only';
    const encrypted = await encryptDataWithPassword(plaintext, password);
    expect(encrypted).not.toContain(plaintext.marker);
    expect(encrypted).not.toContain(password);
    const calls: string[] = [];
    const result = await saveEncryptedBackupOnAndroid(encrypted, filename, () => true, runtime(
      async options => {
        expect(options).toEqual({ filename });
        calls.push('picker');
        return { status: 'selected', token: 'one-use-token' };
      },
      async options => {
        expect(options).toEqual({ token: 'one-use-token', encryptedText: encrypted });
        calls.push('write');
        expect(await decryptDataWithPassword(options.encryptedText, password)).toEqual(plaintext);
        return verifiedReceipt(options.encryptedText);
      },
    ));
    expect(result).toBe('verified');
    expect(calls).toEqual(['picker', 'write']);
  });
  test('cancelled picker does not call native writer or return success', async () => {
    let writes = 0;
    const result = await saveEncryptedBackupOnAndroid(sample, filename, () => true, runtime(
      async () => ({ status: 'cancelled' }),
      async () => { writes++; throw Error('must not write'); },
    ));
    expect(result).toBe('cancelled');
    expect(writes).toBe(0);
  });
  test('unmounted or locked view does not write after selection or confirm a late receipt', async () => {
    let active = true;
    let writes = 0;
    expect(await saveEncryptedBackupOnAndroid(sample, filename, () => active, runtime(
      async () => { active = false; return { status: 'selected', token: 'x' }; },
      async () => { writes++; return verifiedReceipt(sample); },
    ))).toBe('cancelled');
    expect(writes).toBe(0);
    active = true;
    expect(await saveEncryptedBackupOnAndroid(sample, filename, () => active, runtime(
      async () => ({ status: 'selected', token: 'x' }),
      async () => { active = false; return verifiedReceipt(sample); },
    ))).toBe('cancelled');
  });
  test('wrong digest, byte count, malformed receipt or write failure all reject', async () => {
    for (const receipt of [
      { status: 'verified', bytes: sample.length, sha256: 'wrong' },
      { ...(await verifiedReceipt(sample)), bytes: sample.length + 1 },
      { status: 'saved' }, null,
    ]) {
      await expect(saveEncryptedBackupOnAndroid(sample, filename, () => true, runtime(
        async () => ({ status: 'selected', token: 'x' }), async () => receipt,
      ))).rejects.toThrow();
    }
    await expect(saveEncryptedBackupOnAndroid(sample, filename, () => true, runtime(
      async () => ({ status: 'selected', token: 'x' }), async () => { throw new Error('synthetic write failure'); },
    ))).rejects.toThrow();
  });
  test('missing plugin and invalid selection fail closed, without an anchor download', async () => {
    await expect(saveEncryptedBackupOnAndroid(sample, filename, () => true, { androidBridge: {} })).rejects.toThrow();
    let writes = 0;
    await expect(saveEncryptedBackupOnAndroid(sample, filename, () => true, runtime(
      async () => ({ status: 'selected' }), async () => { writes++; return verifiedReceipt(sample); },
    ))).rejects.toThrow();
    expect(writes).toBe(0);
  });
});
