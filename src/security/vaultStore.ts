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

export class IndexedDbVaultStore implements VaultStore {
  private readonly factory: IDBFactory;
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(factory: IDBFactory | undefined = globalThis.indexedDB) {
    if (!factory) {
      throw new Error('IndexedDB non disponibile: impossibile usare il Secure Local Vault.');
    }
    this.factory = factory;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.factory.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE);
        }
        if (!db.objectStoreNames.contains(RECORDS_STORE)) {
          db.createObjectStore(RECORDS_STORE, { keyPath: 'recordKey' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Apertura IndexedDB non riuscita.'));
      request.onblocked = () => reject(new Error('Apertura IndexedDB bloccata da un’altra sessione.'));
    });

    return this.databasePromise;
  }

  async getMetadata(): Promise<VaultMetadataV1 | null> {
    const db = await this.openDatabase();
    const tx = db.transaction(METADATA_STORE, 'readonly');
    const result = await requestToPromise(tx.objectStore(METADATA_STORE).get(CURRENT_METADATA_KEY));
    return (result as VaultMetadataV1 | undefined) ?? null;
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
