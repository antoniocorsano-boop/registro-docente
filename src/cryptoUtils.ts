/**
 * Privacy First: password-protected backup envelope.
 *
 * New exports use AES-GCM 256-bit with PBKDF2-HMAC-SHA256 at the
 * versioned v2 work factor. Legacy envelopes without an explicit version
 * remain readable at the historical 100,000-iteration work factor.
 */

export const BACKUP_PROTOCOL_V2 = 'REGISTRO_DOCENTE_AES_GCM_256';
export const BACKUP_VERSION_V2 = 2;
export const BACKUP_KDF_ITERATIONS_V2 = 600_000;
export const LEGACY_BACKUP_KDF_ITERATIONS = 100_000;

interface BackupKdfV2 {
  name: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
}

interface BackupEnvelopeV2 {
  privacy_protocol: typeof BACKUP_PROTOCOL_V2;
  version: typeof BACKUP_VERSION_V2;
  timestamp: string;
  kdf: BackupKdfV2;
  salt: string;
  iv: string;
  ciphertext: string;
}

interface LegacyBackupEnvelope {
  privacy_protocol?: string;
  version?: undefined;
  timestamp?: string;
  salt: string;
  iv: string;
  ciphertext: string;
}

function getCrypto(): Crypto {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error('Web Crypto API non disponibile. Il backup cifrato non può essere elaborato in sicurezza.');
  }
  return cryptoApi;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function sanitizeBackupData<T>(data: T): T {
  const seen = new WeakSet<object>();

  const clone = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value as object)) {
      throw new Error('Il backup contiene riferimenti circolari non supportati.');
    }
    seen.add(value as object);

    if (Array.isArray(value)) {
      const result = value.map(clone);
      seen.delete(value);
      return result;
    }

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'apiKey') continue;
      result[key] = clone(item);
    }
    seen.delete(value as object);
    return result;
  };

  return clone(data) as T;
}

async function deriveBackupKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  if (!password) throw new Error('Password di backup mancante.');

  const cryptoApi = getCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptDataWithPassword(data: unknown, password: string): Promise<string> {
  const cryptoApi = getCrypto();
  const enc = new TextEncoder();
  const sanitizedData = sanitizeBackupData(data);
  const dataBuffer = enc.encode(JSON.stringify(sanitizedData));

  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt, BACKUP_KDF_ITERATIONS_V2);
  const encryptedBuffer = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );

  const payload: BackupEnvelopeV2 = {
    privacy_protocol: BACKUP_PROTOCOL_V2,
    version: BACKUP_VERSION_V2,
    timestamp: new Date().toISOString(),
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: BACKUP_KDF_ITERATIONS_V2
    },
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(encryptedBuffer)
  };

  return JSON.stringify(payload, null, 2);
}

function parseBackupEnvelope(encryptedContent: string): {
  envelope: BackupEnvelopeV2 | LegacyBackupEnvelope;
  iterations: number;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(encryptedContent);
  } catch {
    throw new Error('Formato cifrato non valido o corrotto.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Formato cifrato non valido o corrotto.');
  }

  const payload = parsed as Record<string, unknown>;
  if (typeof payload.salt !== 'string' || typeof payload.iv !== 'string' || typeof payload.ciphertext !== 'string') {
    throw new Error('Formato cifrato non valido o corrotto.');
  }

  if (payload.version === undefined) {
    return {
      envelope: payload as unknown as LegacyBackupEnvelope,
      iterations: LEGACY_BACKUP_KDF_ITERATIONS
    };
  }

  if (payload.version !== BACKUP_VERSION_V2) {
    throw new Error(`Versione backup cifrato non supportata: ${String(payload.version)}.`);
  }

  if (payload.privacy_protocol !== BACKUP_PROTOCOL_V2) {
    throw new Error('Protocollo del backup cifrato v2 non riconosciuto.');
  }

  const kdf = payload.kdf;
  if (!kdf || typeof kdf !== 'object') {
    throw new Error('Metadati KDF del backup cifrato v2 mancanti.');
  }
  const kdfData = kdf as Record<string, unknown>;
  if (
    kdfData.name !== 'PBKDF2'
    || kdfData.hash !== 'SHA-256'
    || kdfData.iterations !== BACKUP_KDF_ITERATIONS_V2
  ) {
    throw new Error('Parametri KDF del backup cifrato v2 non supportati.');
  }

  return {
    envelope: payload as unknown as BackupEnvelopeV2,
    iterations: BACKUP_KDF_ITERATIONS_V2
  };
}

export async function decryptDataWithPassword(encryptedContent: string, password: string): Promise<any> {
  const cryptoApi = getCrypto();
  const dec = new TextDecoder();
  const { envelope, iterations } = parseBackupEnvelope(encryptedContent);

  let saltBuffer: ArrayBuffer;
  let ivBuffer: ArrayBuffer;
  let ciphertextBuffer: ArrayBuffer;
  try {
    saltBuffer = base64ToArrayBuffer(envelope.salt);
    ivBuffer = base64ToArrayBuffer(envelope.iv);
    ciphertextBuffer = base64ToArrayBuffer(envelope.ciphertext);
  } catch {
    throw new Error('Formato cifrato non valido o corrotto.');
  }

  if (saltBuffer.byteLength !== 16 || ivBuffer.byteLength !== 12 || ciphertextBuffer.byteLength === 0) {
    throw new Error('Formato cifrato non valido o corrotto.');
  }

  const key = await deriveBackupKey(password, new Uint8Array(saltBuffer), iterations);

  try {
    const decryptedBuffer = await cryptoApi.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      key,
      ciphertextBuffer
    );

    return JSON.parse(dec.decode(decryptedBuffer));
  } catch {
    throw new Error('Password errata o file cifrato manomesso.');
  }
}
