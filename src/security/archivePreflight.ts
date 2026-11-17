/**
 * VAL-01/D1b.4a — point-in-time physical DB1 classification, read-only.
 * An outcome is not an authorization, backup receipt, or proof of logical
 * completeness. No production caller until the session owner is qualified.
 */
import { validMeta, validRecords } from './versionFencedVaultStore';
import { deriveKeyEncryptionKey, unwrapDataEncryptionKey, decryptJsonRecord } from './cryptoPrimitives';
import type { EncryptedVaultRecord, VaultMetadataV1 } from './vaultTypes';

export type ArchivePreflightResult = 'complete' | 'incomplete' | 'unverifiable';
const DB_NAME = 'registro-docente-secure-vault';
const KEYS = new Set(['appData','settings','udas','customTests','submissions','planning','library','professionalMemory','copilotState','meta']);
const failure = () => new Error('Archivio non verificabile.');
type Physical = { metadata: VaultMetadataV1; records: EncryptedVaultRecord[] };

function knownRecords(value: unknown): value is EncryptedVaultRecord[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > KEYS.size) return false;
  const seen = new Set<string>();
  for (const r of value) {
    if (!r || typeof r !== 'object' || typeof r.recordKey !== 'string' ||
        !KEYS.has(r.recordKey) || seen.has(r.recordKey) || r.schemaVersion !== 1 ||
        !(r.iv instanceof Uint8Array) || r.iv.byteLength !== 12 ||
        !(r.ciphertext instanceof ArrayBuffer) || r.ciphertext.byteLength < 16) return false;
    seen.add(r.recordKey);
  }
  return true;
}

/** A pending open may be queued behind another tab. Refuse on timeout or
 * revocation, and abort any subsequently delivered upgrade event. */
function capture(factory: IDBFactory, signal?: AbortSignal): Promise<Physical> {
  return new Promise((resolve,reject) => {
    if (signal?.aborted) { reject(failure()); return; }
    let settled = false;
    let db: IDBDatabase | undefined;
    let tx: IDBTransaction | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      db?.close();
    };
    const stop = () => {
      if (settled) return;
      settled = true;
      try { tx?.abort(); } catch { /* transaction already finished */ }
      cleanup();
      reject(failure());
    };
    const timer = setTimeout(stop, 5000);
    signal?.addEventListener('abort', stop, { once: true });
    try {
      const request = factory.open(DB_NAME, 1);
      request.onblocked = stop;
      request.onupgradeneeded = () => {
        // Missing database: never create stores or commit version 1.
        request.transaction?.abort();
        // Wait for the request error after rollback before reporting absence.
        // A previously revoked or timed-out request remains abandoned.
      };
      request.onerror = stop;
      request.onsuccess = () => {
        db = request.result;
        if (settled || signal?.aborted) { db.close(); stop(); return; }
        try {
          if (db.version !== 1 || db.objectStoreNames.length !== 2 ||
              !db.objectStoreNames.contains('metadata') || !db.objectStoreNames.contains('records')) throw failure();
          db.onversionchange = stop;
          db.onclose = stop;
          tx = db.transaction(['metadata','records'], 'readonly');
          const meta = tx.objectStore('metadata'), records = tx.objectStore('records');
          if (meta.keyPath !== null || meta.autoIncrement || meta.indexNames.length !== 0 ||
              records.keyPath !== 'recordKey' || records.autoIncrement || records.indexNames.length !== 0) throw failure();
          const mk = meta.getAllKeys(), mv = meta.get('current');
          const rk = records.getAllKeys(), rv = records.getAll();
          tx.onabort = tx.onerror = stop;
          tx.oncomplete = () => {
            if (settled) return;
            try {
              if (signal?.aborted || mk.result.length !== 1 || mk.result[0] !== 'current' ||
                  !validMeta(mv.result) || !knownRecords(rv.result) ||
                  rk.result.length !== rv.result.length ||
                  !rk.result.every((key,i) => key === rv.result[i].recordKey)) throw failure();
              const physical = { metadata: mv.result as VaultMetadataV1, records: rv.result };
              settled = true;
              cleanup();
              resolve(physical);
            } catch { stop(); }
          };
        } catch { stop(); }
      };
    } catch { stop(); }
  });
}

/** Only a classification leaves this function. Authentication applies to
 * the captured ciphertext, not to a later database state; a new verification
 * and the atomic migration guard remain mandatory before any upgrade. */
export async function classifyArchivePreflight(
  password: string,
  signal?: AbortSignal,
  factory: IDBFactory | undefined = globalThis.indexedDB
): Promise<ArchivePreflightResult> {
  try {
    if (!factory || signal?.aborted) return 'unverifiable';
    const { metadata, records } = await capture(factory, signal);
    if (signal?.aborted) return 'unverifiable';
    const kek = await deriveKeyEncryptionKey(password, metadata.salt);
    if (signal?.aborted) return 'unverifiable';
    const dek = await unwrapDataEncryptionKey(metadata.wrappedDek, metadata.wrapIv, kek);
    if (signal?.aborted) return 'unverifiable';
    for (const record of records) {
      await decryptJsonRecord<unknown>(record, dek);
      if (signal?.aborted) return 'unverifiable';
    }
    if (records.length === KEYS.size) return validRecords(records) ? 'complete' : 'unverifiable';
    return 'incomplete';
  } catch {
    return 'unverifiable';
  }
}
