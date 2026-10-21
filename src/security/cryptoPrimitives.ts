import type { EncryptedVaultRecord } from './vaultTypes';

export const KDF_ITERATIONS_V1 = 600_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API non disponibile.');
  }
  return globalThis.crypto;
}

function createIv(): Uint8Array {
  return getCrypto().getRandomValues(new Uint8Array(12));
}

function additionalData(recordKey: string, schemaVersion: number): Uint8Array {
  return encoder.encode(`registro-docente:vault-v1:${recordKey}:${schemaVersion}`);
}

export async function generateDataEncryptionKey(): Promise<CryptoKey> {
  return getCrypto().subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function deriveKeyEncryptionKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const cryptoApi = getCrypto();
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: KDF_ITERATIONS_V1,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function wrapDataEncryptionKey(
  dek: CryptoKey,
  kek: CryptoKey
): Promise<{ iv: Uint8Array; wrappedKey: ArrayBuffer }> {
  const cryptoApi = getCrypto();
  const iv = createIv();
  const rawDek = await cryptoApi.subtle.exportKey('raw', dek);
  const wrappedKey = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    kek,
    rawDek
  );

  return { iv, wrappedKey };
}

export async function unwrapDataEncryptionKey(
  wrappedKey: ArrayBuffer,
  iv: Uint8Array,
  kek: CryptoKey
): Promise<CryptoKey> {
  const cryptoApi = getCrypto();
  const rawDek = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv },
    kek,
    wrappedKey
  );

  return cryptoApi.subtle.importKey(
    'raw',
    rawDek,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJsonRecord<T>(
  recordKey: string,
  schemaVersion: number,
  value: T,
  dek: CryptoKey
): Promise<EncryptedVaultRecord> {
  const cryptoApi = getCrypto();
  const iv = createIv();
  const ciphertext = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: additionalData(recordKey, schemaVersion)
    },
    dek,
    encoder.encode(JSON.stringify(value))
  );

  return {
    recordKey,
    schemaVersion,
    iv,
    ciphertext
  };
}

export async function decryptJsonRecord<T>(
  record: EncryptedVaultRecord,
  dek: CryptoKey
): Promise<T> {
  const plaintext = await getCrypto().subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: record.iv,
      additionalData: additionalData(record.recordKey, record.schemaVersion)
    },
    dek,
    record.ciphertext
  );

  return JSON.parse(decoder.decode(plaintext)) as T;
}
