import { describe, expect, test } from 'bun:test';
import {
  KDF_ITERATIONS_V1,
  decryptJsonRecord,
  deriveKeyEncryptionKey,
  encryptJsonRecord,
  generateDataEncryptionKey,
  unwrapDataEncryptionKey,
  wrapDataEncryptionKey
} from './cryptoPrimitives';

describe('SEC-1 crypto primitives v1', () => {
  test('pins PBKDF2-HMAC-SHA256 v1 to 600000 iterations', () => {
    expect(KDF_ITERATIONS_V1).toBe(600_000);
  });

  test('encrypts and decrypts a JSON record with AES-GCM', async () => {
    const dek = await generateDataEncryptionKey();
    const value = { classId: '2C', count: 3 };

    const encrypted = await encryptJsonRecord('appData', 1, value, dek);
    const decrypted = await decryptJsonRecord<typeof value>(encrypted, dek);

    expect(encrypted.recordKey).toBe('appData');
    expect(encrypted.schemaVersion).toBe(1);
    expect(encrypted.iv.byteLength).toBe(12);
    expect(decrypted).toEqual(value);
  });

  test('uses a fresh IV for each record encryption', async () => {
    const dek = await generateDataEncryptionKey();

    const first = await encryptJsonRecord('appData', 1, { value: 1 }, dek);
    const second = await encryptJsonRecord('appData', 1, { value: 1 }, dek);

    expect(Array.from(first.iv)).not.toEqual(Array.from(second.iv));
  });

  test('rejects wrong keys, ciphertext tampering and record-key swaps', async () => {
    const dek = await generateDataEncryptionKey();
    const wrongDek = await generateDataEncryptionKey();
    const encrypted = await encryptJsonRecord('appData', 1, { protected: true }, dek);

    await expect(decryptJsonRecord(encrypted, wrongDek)).rejects.toThrow();

    const tamperedBuffer = encrypted.ciphertext.slice(0);
    const tamperedBytes = new Uint8Array(tamperedBuffer);
    tamperedBytes[0] ^= 0x01;
    await expect(
      decryptJsonRecord({ ...encrypted, ciphertext: tamperedBuffer }, dek)
    ).rejects.toThrow();

    await expect(
      decryptJsonRecord({ ...encrypted, recordKey: 'settings' }, dek)
    ).rejects.toThrow();
  });

  test('wraps and unwraps the DEK using a password-derived KEK', async () => {
    const dek = await generateDataEncryptionKey();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const kek = await deriveKeyEncryptionKey('correct horse battery staple', salt);
    const wrapped = await wrapDataEncryptionKey(dek, kek);
    const unwrapped = await unwrapDataEncryptionKey(wrapped.wrappedKey, wrapped.iv, kek);

    const encrypted = await encryptJsonRecord('settings', 1, { ok: true }, dek);
    await expect(decryptJsonRecord(encrypted, unwrapped)).resolves.toEqual({ ok: true });
  });
});
