import { describe, expect, test } from 'bun:test';
import { encryptDataWithPassword, decryptDataWithPassword } from '../cryptoUtils';
import { readEncryptedBackupOnAndroid, saveEncryptedBackupOnAndroid, type AndroidBackupRuntime } from './androidBackupExport';

async function receipt(encryptedText: string, status = 'read') {
  const bytes = new TextEncoder().encode(encryptedText);
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
  return { status, encryptedText, bytes: bytes.length, sha256 };
}

function bridge(choose: () => Promise<unknown>, read: (options: { token: string }) => Promise<unknown>): AndroidBackupRuntime {
  return { androidBridge: {}, Capacitor: { getPlatform: () => 'android', Plugins: { RegistroBackupFiles: {
    chooseBackupDestination: async () => { throw Error('unexpected save'); },
    writeEncryptedBackup: async () => { throw Error('unexpected write'); },
    chooseBackupSource: choose,
    readEncryptedBackup: read,
  } } } };
}

describe('MOBILE-01/M2b encrypted Android file boundary', () => {
  test('native roundtrip preserves the authenticated encrypted snapshot, never sends password or plaintext to native code', async () => {
    const data = { marker: 'synthetic-only' };
    const password = 'synthetic-test-only';
    const ciphertext = await encryptDataWithPassword(data, password);
    let stored = '';
    const runtime = bridge(async () => ({ status: 'selected', token: 'read-token' }), async options => {
      expect(options).toEqual({ token: 'read-token' });
      return receipt(stored);
    });
    const plugin = runtime.Capacitor!.Plugins!.RegistroBackupFiles!;
    plugin.chooseBackupDestination = async options => {
      expect(options).toEqual({ filename: 'Backup_Cifrato_GDPR_2026-11-12.enc.json' });
      return { status: 'selected', token: 'write-token' };
    };
    plugin.writeEncryptedBackup = async options => {
      expect(options.token).toBe('write-token');
      expect(options.encryptedText).not.toContain(password);
      expect(options.encryptedText).not.toContain(data.marker);
      stored = options.encryptedText;
      return receipt(stored, 'verified');
    };
    expect(await saveEncryptedBackupOnAndroid(ciphertext, 'Backup_Cifrato_GDPR_2026-11-12.enc.json', () => true, runtime)).toBe('verified');
    const restored = await readEncryptedBackupOnAndroid(() => true, runtime);
    expect(restored).toBe(ciphertext);
    expect(await decryptDataWithPassword(restored!, password)).toEqual(data);
    await expect(decryptDataWithPassword(restored!, 'wrong-test-password')).rejects.toThrow();
  });
  test('cancel, stale view, missing plugin, malformed selection and wrong digest never return a file', async () => {
    let reads = 0;
    const neverRead = async () => { reads++; throw Error('unexpected read'); };
    expect(await readEncryptedBackupOnAndroid(() => true, bridge(async () => ({ status: 'cancelled' }), neverRead))).toBeNull();
    expect(await readEncryptedBackupOnAndroid(() => false, bridge(async () => ({ status: 'selected', token: 'x' }), neverRead))).toBeNull();
    await expect(readEncryptedBackupOnAndroid(() => true, bridge(async () => ({ status: 'selected' }), neverRead))).rejects.toThrow();
    expect(reads).toBe(0);
    await expect(readEncryptedBackupOnAndroid(() => true, { androidBridge: {} })).rejects.toThrow();
    for (const value of [null, { status: 'read', encryptedText: 'bad', bytes: 3, sha256: 'bad' }, { ...(await receipt('bad')), bytes: 99 }]) {
      await expect(readEncryptedBackupOnAndroid(() => true, bridge(async () => ({ status: 'selected', token: 'x' }), async () => value))).rejects.toThrow();
    }
    let active = true;
    expect(await readEncryptedBackupOnAndroid(() => active, bridge(async () => ({ status: 'selected', token: 'x' }), async () => {
      active = false;
      return receipt('synthetic');
    }))).toBeNull();
  });
});
