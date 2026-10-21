/**
 * Privacy First: Client-Side Web Crypto API (AES-GCM 256-bit)
 * Zero-knowledge encryption: data is encrypted in the teacher's browser before export.
 * No password or plaintext ever leaves the device.
 */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function encryptDataWithPassword(data: any, password: string): Promise<string> {
  const enc = new TextEncoder();
  const rawText = JSON.stringify(data);
  const dataBuffer = enc.encode(rawText);

  // Generate random 16-byte salt and 12-byte IV for AES-GCM
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Import password as raw key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM 256-bit key using PBKDF2 (100,000 iterations)
  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Encrypt with AES-GCM
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    dataBuffer
  );

  const payload = {
    privacy_protocol: 'GDPR_AES_GCM_256',
    timestamp: new Date().toISOString(),
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(encryptedBuffer)
  };

  return JSON.stringify(payload, null, 2);
}

export async function decryptDataWithPassword(encryptedContent: string, password: string): Promise<any> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const payload = JSON.parse(encryptedContent);
  if (!payload.salt || !payload.iv || !payload.ciphertext) {
    throw new Error('Formato cifrato non valido o corrotto.');
  }

  const saltBuffer = base64ToArrayBuffer(payload.salt);
  const ivBuffer = base64ToArrayBuffer(payload.iv);
  const ciphertextBuffer = base64ToArrayBuffer(payload.ciphertext);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(saltBuffer),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(ivBuffer)
      },
      key,
      ciphertextBuffer
    );

    const decryptedString = dec.decode(decryptedBuffer);
    return JSON.parse(decryptedString);
  } catch (err) {
    throw new Error('Password errata o file cifrato manomesso.');
  }
}
