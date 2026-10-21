import { beforeAll, describe, expect, test } from 'bun:test';

beforeAll(() => {
  const root = globalThis as typeof globalThis & { window?: typeof globalThis };
  if (!root.window) root.window = globalThis;
});

function toBase64(buffer: ArrayBuffer): string {
  return Buffer.from(new Uint8Array(buffer)).toString('base64');
}

async function legacyEncryptedFixture(data: unknown, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  const key = await globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(data))
  );

  return JSON.stringify({
    privacy_protocol: 'GDPR_AES_GCM_256',
    timestamp: '2026-10-21T00:00:00.000Z',
    salt: toBase64(salt.buffer),
    iv: toBase64(iv.buffer),
    ciphertext: toBase64(ciphertext)
  });
}

describe('SEC-1 encrypted backup protocol v2', () => {
  test('emits versioned PBKDF2 metadata at 600k and round-trips data', async () => {
    const { encryptDataWithPassword, decryptDataWithPassword } = await import('../cryptoUtils');
    const input = { app: 'registro-docente', classes: [{ id: 'c1' }] };

    const encrypted = await encryptDataWithPassword(input, 'backup-password');
    const envelope = JSON.parse(encrypted);

    expect(envelope.version).toBe(2);
    expect(envelope.privacy_protocol).toBe('REGISTRO_DOCENTE_AES_GCM_256');
    expect(envelope.kdf).toEqual({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000 });
    expect(envelope.salt).toBeTruthy();
    expect(envelope.iv).toBeTruthy();
    expect(envelope.ciphertext).toBeTruthy();
    await expect(decryptDataWithPassword(encrypted, 'backup-password')).resolves.toEqual(input);
  });

  test('removes persisted provider secrets without mutating the live input', async () => {
    const { encryptDataWithPassword, decryptDataWithPassword } = await import('../cryptoUtils');
    const input = {
      settings: {
        school: 'IC',
        embeddingConfig: {
          provider: 'gemini',
          endpointUrl: '',
          modelName: 'text-embedding-004',
          apiType: 'openai',
          enabled: true,
          apiKey: 'must-never-enter-backup'
        }
      },
      classes: []
    };

    const encrypted = await encryptDataWithPassword(input, 'backup-password');
    const restored = await decryptDataWithPassword(encrypted, 'backup-password');

    expect(restored.settings.embeddingConfig.apiKey).toBeUndefined();
    expect(restored.settings.embeddingConfig.provider).toBe('gemini');
    expect(input.settings.embeddingConfig.apiKey).toBe('must-never-enter-backup');
  });

  test('decrypts legacy envelopes with implicit 100k PBKDF2 iterations', async () => {
    const { decryptDataWithPassword } = await import('../cryptoUtils');
    const legacy = await legacyEncryptedFixture({ classes: [{ id: 'legacy' }] }, 'legacy-password');

    await expect(decryptDataWithPassword(legacy, 'legacy-password'))
      .resolves.toEqual({ classes: [{ id: 'legacy' }] });
  });

  test('fails closed for an unsupported explicit backup version', async () => {
    const { decryptDataWithPassword } = await import('../cryptoUtils');
    const legacy = JSON.parse(await legacyEncryptedFixture({ classes: [] }, 'password'));
    legacy.version = 99;

    await expect(decryptDataWithPassword(JSON.stringify(legacy), 'password'))
      .rejects.toThrow(/versione/i);
  });
});
