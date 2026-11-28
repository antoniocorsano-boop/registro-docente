import type {
  EncryptedVaultRecord,
  VaultMetadataV1,
  VaultRecordKey
} from './vaultTypes';

const DB_NAME = 'registro-docente-secure-vault';
const DB_VERSION = 1;
const METADATA_STORE = 'metadata';
const RECORDS_STORE = 'records';
const CURRENT_METADATA_KEY = 'current';

export interface VaultStore {
  getMetadata(): Promise<VaultMetadataV1 | null>;
  putMetadata(metadata: VaultMetadataV1): Promise<void>;
  /** Optional for stores without the production atomic reservation contract. */
  activateReservedMetadata?(expected: VaultMetadataV1, assertAuthorized?: () => void, onCommitInvoked?: () => void): Promise<void>;
  discardReservedMetadata?(expected: VaultMetadataV1): Promise<boolean>;
  getRecord(key: VaultRecordKey): Promise<EncryptedVaultRecord | null>;
  putRecord(record: EncryptedVaultRecord): Promise<void>;
  putRecords(records: EncryptedVaultRecord[]): Promise<void>;
  deleteRecord(key: VaultRecordKey): Promise<void>;
  listRecordKeys(): Promise<VaultRecordKey[]>;
  clearAll(): Promise<void>;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Operazione IndexedDB non riuscita.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Transazione IndexedDB annullata.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Transazione IndexedDB non riuscita.'));
  });
}

function isVaultRecordKey(value: IDBValidKey): value is VaultRecordKey {
  return (
    typeof value === 'string' &&
    [
      'appData',
      'settings',
      'udas',
      'customTests',
      'submissions',
      'planning',
      'library',
      'professionalMemory',
      'copilotState',
      'meta'
    ].includes(value)
  );
}

/** The reservation identity is its complete original metadata, not STAGING alone.
 * Unknown fields or malformed values are not proof of ownership. */
function sameKeys(value: unknown, expected: object): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' &&
    Object.keys(value).length === Object.keys(expected).length &&
    Object.keys(expected).every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.byteLength === b.byteLength && a.every((byte, i) => byte === b[i]);
}

function isOwnedStaging(actual: unknown, expected: VaultMetadataV1): boolean {
  if (expected.state !== 'STAGING' || !sameKeys(actual, expected) ||
      !sameKeys(actual.kdf, expected.kdf)) return false;
  return actual.vaultVersion === expected.vaultVersion && actual.state === 'STAGING' &&
    actual.createdAt === expected.createdAt && actual.updatedAt === expected.updatedAt &&
    actual.kdf.name === expected.kdf.name && actual.kdf.hash === expected.kdf.hash &&
    actual.kdf.iterations === expected.kdf.iterations &&
    actual.salt instanceof Uint8Array && sameBytes(actual.salt, expected.salt) &&
    actual.wrapIv instanceof Uint8Array && sameBytes(actual.wrapIv, expected.wrapIv) &&
    actual.wrappedDek instanceof ArrayBuffer &&
    sameBytes(new Uint8Array(actual.wrappedDek), new Uint8Array(expected.wrappedDek));
}

type ReservedMutation = 'committed' | 'not-owned' | { aborted: unknown };

export class IndexedDbVaultStore implements VaultStore {
  private readonly factory: IDBFactory;
  private databasePromise: Promise<IDBDatabase> | null = null;
  private connectionRetired = false;
  private activeConnection: IDBDatabase | null = null;
  private abandonOpen: (() => void) | null = null;

  constructor(factory: IDBFactory | undefined = globalThis.indexedDB, private readonly existingOnly = false) {
    if (!factory) {
      throw new Error('IndexedDB non disponibile: impossibile usare il Secure Local Vault.');
    }
    this.factory = factory;
  }

  /** The owner must drain admitted work before retiring its runtime. */
  async retireConnection(): Promise<void> {
    this.connectionRetired = true;
    this.abandonOpen?.();
    this.activeConnection?.close();
    this.activeConnection = null;
  }

  protected openDatabase(): Promise<IDBDatabase> {
    if (this.connectionRetired) return Promise.reject(new Error('Sessione archivio non più attuale.'));
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.factory.open(DB_NAME, DB_VERSION);
      let abandoned = false;
      const fail = (error: Error | DOMException) => {
        abandoned = true;
        this.abandonOpen = null;
        reject(error);
      };
      this.abandonOpen = () => fail(new Error('Sessione archivio non più attuale.'));

      request.onupgradeneeded = () => {
        if (abandoned || this.connectionRetired || this.existingOnly) { request.transaction?.abort(); return; }
        const db = request.result;
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE);
        }
        if (!db.objectStoreNames.contains(RECORDS_STORE)) {
          db.createObjectStore(RECORDS_STORE, { keyPath: 'recordKey' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        if (abandoned || this.connectionRetired) { db.close(); return; }
        this.abandonOpen = null;
        this.activeConnection = db;
        resolve(db);
      };
      request.onerror = () => fail(request.error ?? new Error('Apertura IndexedDB non riuscita.'));
      request.onblocked = () => fail(new Error('Apertura IndexedDB bloccata da un’altra sessione.'));
    });

    return this.databasePromise;
  }

  async getMetadata(): Promise<VaultMetadataV1 | null> {
    const db = await this.openDatabase();
    const tx = db.transaction(METADATA_STORE, 'readonly');
    const result = await requestToPromise(tx.objectStore(METADATA_STORE).get(CURRENT_METADATA_KEY));
    return (result as VaultMetadataV1 | undefined) ?? null;
  }

  /** Candidate-only initial reservation. Both stores must be empty in the
   * same readwrite transaction; add() must never replace an existing owner.
   * Success means the reservation has committed, not just a request success. */
  async claimInitialMetadata(metadata: VaultMetadataV1): Promise<void> {
    if (metadata.state !== 'STAGING') throw new Error('Configurazione iniziale non valida.');
    const db = await this.openDatabase();
    if (db.version !== 1) throw new Error('Versione archivio non ammessa per la configurazione iniziale.');
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([METADATA_STORE, RECORDS_STORE], 'readwrite');
      const refused = () => new Error('Archivio non vuoto. Nessun dato è stato sostituito.');
      let failure: unknown = null;
      const abort = (error: unknown) => {
        failure = error;
        try { tx.abort(); } catch { reject(error); }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(failure ?? tx.error ?? refused());
      tx.onerror = () => { failure ??= tx.error ?? refused(); };
      try {
        const meta = tx.objectStore(METADATA_STORE);
        const records = tx.objectStore(RECORDS_STORE);
        const metaCount = meta.count();
        const recordCount = records.count();
        let remaining = 2;
        const reserve = () => {
          if (--remaining !== 0) return;
          try {
            if (metaCount.result !== 0 || recordCount.result !== 0) throw refused();
            meta.add(metadata, CURRENT_METADATA_KEY);
          } catch (error) { abort(error); }
        };
        metaCount.onsuccess = recordCount.onsuccess = reserve;
      } catch (error) { abort(error); }
    });
  }

  /** Compare ownership and mutate within one transaction covering both stores.
   * Only onabort is evidence of a refused ACTIVE write; request errors or a
   * thrown exception alone never authorize recovery. */
  private async mutateReservedStaging(
    expected: VaultMetadataV1, action: 'activate' | 'discard',
    assertAuthorized?: () => void, onCommitInvoked?: () => void
  ): Promise<ReservedMutation> {
    assertAuthorized?.();
    const db = await this.openDatabase();
    if (db.version !== 1 || this.connectionRetired) throw new Error('Sessione archivio non più attuale.');
    return new Promise<ReservedMutation>((resolve, reject) => {
      const tx = db.transaction([METADATA_STORE, RECORDS_STORE], 'readwrite');
      let failure: unknown = null;
      let owned = false;
      let activationAttempted = false;
      const refused = () => new Error('Transazione archivio iniziale annullata.');
      const abort = (error: unknown) => {
        failure = error;
        try { tx.abort(); } catch { reject(error); }
      };
      tx.oncomplete = () => resolve(owned ? 'committed' : 'not-owned');
      tx.onerror = () => { failure ??= tx.error ?? refused(); };
      tx.onabort = () => {
        const error = failure ?? tx.error ?? refused();
        if (activationAttempted) resolve({ aborted: error });
        else reject(error);
      };
      try {
        const meta = tx.objectStore(METADATA_STORE);
        const current = meta.get(CURRENT_METADATA_KEY);
        const count = meta.count();
        let remaining = 2;
        const mutate = () => {
          if (--remaining !== 0) return;
          try {
            if (count.result !== 1 || !isOwnedStaging(current.result, expected)) return;
            assertAuthorized?.();
            if (this.connectionRetired) throw new Error('Sessione archivio non più attuale.');
            owned = true;
            if (action === 'activate') {
              onCommitInvoked?.();
              activationAttempted = true;
              meta.put({ ...expected, state: 'ACTIVE', updatedAt: new Date().toISOString() }, CURRENT_METADATA_KEY);
            } else {
              meta.delete(CURRENT_METADATA_KEY);
              tx.objectStore(RECORDS_STORE).clear();
            }
          } catch (error) { abort(error); }
        };
        current.onsuccess = count.onsuccess = mutate;
      } catch (error) { abort(error); }
    });
  }

  async activateReservedMetadata(
    expected: VaultMetadataV1, assertAuthorized?: () => void, onCommitInvoked?: () => void
  ): Promise<void> {
    const outcome = await this.mutateReservedStaging(expected, 'activate', assertAuthorized, onCommitInvoked);
    if (outcome === 'committed') return;
    if (outcome === 'not-owned') throw new Error('Riserva iniziale non più attuale.');
    // The activation transaction has definitely aborted. Recheck the exact
    // reservation and authority in a fresh atomic transaction; a competing
    // ACTIVE/STAGING, revocation or unreadable store must not be cleared.
    try {
      await this.mutateReservedStaging(expected, 'discard', assertAuthorized);
    } catch {
      // Preserve the activation error and leave recovery to protected reopen.
    }
    throw outcome.aborted;
  }

  async discardReservedMetadata(expected: VaultMetadataV1): Promise<boolean> {
    return await this.mutateReservedStaging(expected, 'discard') === 'committed';
  }

  async putMetadata(metadata: VaultMetadataV1): Promise<void> {
    const db = await this.openDatabase();
    const tx = db.transaction(METADATA_STORE, 'readwrite');
    const done = transactionDone(tx);
    await requestToPromise(tx.objectStore(METADATA_STORE).put(metadata, CURRENT_METADATA_KEY));
    await done;
  }

  async getRecord(key: VaultRecordKey): Promise<EncryptedVaultRecord | null> {
    const db = await this.openDatabase();
    const tx = db.transaction(RECORDS_STORE, 'readonly');
    const result = await requestToPromise(tx.objectStore(RECORDS_STORE).get(key));
    return (result as EncryptedVaultRecord | undefined) ?? null;
  }

  putRecord(record: EncryptedVaultRecord): Promise<void> {
    return this.putRecords([record]);
  }

  async putRecords(records: EncryptedVaultRecord[]): Promise<void> {
    const db = await this.openDatabase();
    const tx = db.transaction(RECORDS_STORE, 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore(RECORDS_STORE);

    await Promise.all([
      done,
      ...records.map(record => requestToPromise(store.put(record)))
    ]);
  }

  async deleteRecord(key: VaultRecordKey): Promise<void> {
    const db = await this.openDatabase();
    const tx = db.transaction(RECORDS_STORE, 'readwrite');
    const done = transactionDone(tx);
    await requestToPromise(tx.objectStore(RECORDS_STORE).delete(key));
    await done;
  }

  async listRecordKeys(): Promise<VaultRecordKey[]> {
    const db = await this.openDatabase();
    const tx = db.transaction(RECORDS_STORE, 'readonly');
    const keys = await requestToPromise(tx.objectStore(RECORDS_STORE).getAllKeys());
    return keys.filter(isVaultRecordKey);
  }

  async clearAll(): Promise<void> {
    const db = await this.openDatabase();
    const tx = db.transaction([METADATA_STORE, RECORDS_STORE], 'readwrite');
    const done = transactionDone(tx);
    await Promise.all([
      requestToPromise(tx.objectStore(METADATA_STORE).clear()),
      requestToPromise(tx.objectStore(RECORDS_STORE).clear())
    ]);
    await done;
  }
}
