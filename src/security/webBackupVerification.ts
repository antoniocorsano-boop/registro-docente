/** A bounded, byte-exact comparison of a newly generated encrypted envelope.
 * No password, plaintext, file path, remote service or restore operation.
 */
export const WEB_BACKUP_VERIFICATION_MAX_BYTES = 32 * 1024 * 1024;
export interface BackupByteEvidence { readonly bytes: number; readonly sha256: string; }

async function digestBytes(bytes: ArrayBuffer): Promise<BackupByteEvidence> {
  if (bytes.byteLength === 0 || bytes.byteLength > WEB_BACKUP_VERIFICATION_MAX_BYTES) {
    throw new Error('Dimensione della copia non valida (limite 32 MiB).');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return { bytes: bytes.byteLength, sha256: Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('') };
}

export async function expectedBackupEvidence(encryptedText: string): Promise<BackupByteEvidence> {
  const bytes = new TextEncoder().encode(encryptedText);
  return digestBytes(bytes.buffer as ArrayBuffer);
}

export async function matchesDownloadedBackup(file: Blob, expected: BackupByteEvidence): Promise<boolean> {
  if (!Number.isSafeInteger(expected.bytes) || expected.bytes <= 0 || expected.bytes > WEB_BACKUP_VERIFICATION_MAX_BYTES ||
      !/^[0-9a-f]{64}$/.test(expected.sha256) || file.size !== expected.bytes) return false;
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength !== expected.bytes) return false;
  const actual = await digestBytes(bytes);
  return actual.bytes === expected.bytes && actual.sha256 === expected.sha256;
}
