import {
  KDF_ITERATIONS_V1,
  decryptJsonRecord,
  deriveKeyEncryptionKey,
  encryptJsonRecord,
  generateDataEncryptionKey,
  unwrapDataEncryptionKey,
  wrapDataEncryptionKey
} from './cryptoPrimitives';
import type { VaultStore } from './vaultStore';
import type { VaultMetadataV1, VaultRecordKey } from './vaultTypes';

export class SecureVault {
  private sessionDek: CryptoKey | null = null;
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(private readonly store: VaultStore) {}

  private enqueueMutation(operation: () => Promise<void>): Promise<void> {
    const run = this.mutationTail.then(operation, operation);
    this.mutationTail = run.then(() => undefined, () => undefined);
    return run;
  }

  private requireUnlocked(): CryptoKey {
    if (!this.sessionDek) {
      throw new Error('Secure Local Vault bloccato.');
    }
    return this.sessionDek;
  }

  private createSalt(): Uint8Array {
    if (!globalThis.crypto) {
      throw new Error('Web Crypto API non disponibile.');
    }
    return globalThis.crypto.getRandomValues(new Uint8Array(16));
  }

  async createStaging(password: string): Promise<void> {
    const existing = await this.store.getMetadata();
    if (existing) {
      throw new Error(`Secure Local Vault già presente in stato ${existing.state}.`);
    }

    const salt = this.createSalt();
    const dek = await generateDataEncryptionKey();
    const kek = await deriveKeyEncryptionKey(password, salt);
    const wrapped = await wrapDataEncryptionKey(dek, kek);
    const now = new Date().toISOString();

    const metadata: VaultMetadataV1 = {
      vaultVersion: 1,
      state: 'STAGING',
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: KDF_ITERATIONS_V1
      },
      salt,
      wrappedDek: wrapped.wrappedKey,
      wrapIv: wrapped.iv,
      createdAt: now,
      updatedAt: now
    };

    await this.store.putMetadata(metadata);
    this.sessionDek = dek;
  }

  async initializeActive(password: string): Promise<void> {
    await this.createStaging(password);
    await this.activate();
  }

  async unlock(password: string): Promise<void> {
    const metadata = await this.store.getMetadata();
    if (!metadata) {
      throw new Error('Secure Local Vault non configurato.');
    }
    if (metadata.state !== 'ACTIVE') {
      throw new Error(`Secure Local Vault in stato ${metadata.state}: non può essere usato come ACTIVE.`);
    }

    try {
      const kek = await deriveKeyEncryptionKey(password, metadata.salt);
      this.sessionDek = await unwrapDataEncryptionKey(
        metadata.wrappedDek,
        metadata.wrapIv,
        kek
      );
    } catch {
      this.sessionDek = null;
      throw new Error('Password errata o metadata del vault manomesso.');
    }
  }

  lock(): void {
    this.sessionDek = null;
  }

  isUnlocked(): boolean {
    return this.sessionDek !== null;
  }

  async get<T>(key: VaultRecordKey): Promise<T | null> {
    const dek = this.requireUnlocked();
    const record = await this.store.getRecord(key);
    if (!record) return null;
    return decryptJsonRecord<T>(record, dek);
  }

  async put<T>(key: VaultRecordKey, value: T, schemaVersion = 1): Promise<void> {
    const dek = this.requireUnlocked();
    await this.enqueueMutation(async () => {
      const record = await encryptJsonRecord(key, schemaVersion, value, dek);
      await this.store.putRecord(record);
    });
  }

  async delete(key: VaultRecordKey): Promise<void> {
    this.requireUnlocked();
    await this.enqueueMutation(() => this.store.deleteRecord(key));
  }

  async clearAll(): Promise<void> {
    this.lock();
    await this.enqueueMutation(() => this.store.clearAll());
  }

  async activate(): Promise<void> {
    this.requireUnlocked();
    const metadata = await this.store.getMetadata();
    if (!metadata) {
      throw new Error('Secure Local Vault non configurato.');
    }
    if (metadata.state !== 'STAGING') {
      throw new Error(`Attivazione non ammessa per vault ${metadata.state}.`);
    }

    await this.store.putMetadata({
      ...metadata,
      state: 'ACTIVE',
      updatedAt: new Date().toISOString()
    });
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const metadata = await this.store.getMetadata();
    if (!metadata || metadata.state !== 'ACTIVE') {
      throw new Error('Cambio password disponibile solo per vault ACTIVE.');
    }

    let dek: CryptoKey;
    try {
      const oldKek = await deriveKeyEncryptionKey(oldPassword, metadata.salt);
      dek = await unwrapDataEncryptionKey(metadata.wrappedDek, metadata.wrapIv, oldKek);
    } catch {
      throw new Error('Password corrente errata.');
    }

    const salt = this.createSalt();
    const newKek = await deriveKeyEncryptionKey(newPassword, salt);
    const wrapped = await wrapDataEncryptionKey(dek, newKek);

    await this.store.putMetadata({
      ...metadata,
      salt,
      wrappedDek: wrapped.wrappedKey,
      wrapIv: wrapped.iv,
      updatedAt: new Date().toISOString()
    });

    this.sessionDek = dek;
  }

  async discardStaging(): Promise<void> {
    const metadata = await this.store.getMetadata();
    if (!metadata) {
      this.lock();
      return;
    }
    if (metadata.state === 'ACTIVE') {
      throw new Error('Un vault ACTIVE non può essere eliminato tramite discardStaging.');
    }

    await this.store.clearAll();
    this.lock();
  }
}
