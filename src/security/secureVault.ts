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

export interface VaultWriteEntry {
  key: VaultRecordKey;
  value: unknown;
  schemaVersion?: number;
}

export class SecureVault {
  private sessionDek: CryptoKey | null = null;
  private initialReservation: VaultMetadataV1 | null = null;
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: VaultStore,
    private readonly reserveInitial?: (metadata: VaultMetadataV1) => Promise<void>
  ) {}

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

  async createStaging(password: string, assertAuthorized?: () => void): Promise<void> {
    assertAuthorized?.();
    const existing = await this.store.getMetadata();
    if (existing) {
      throw new Error(`Secure Local Vault già presente in stato ${existing.state}.`);
    }

    assertAuthorized?.();
    const salt = this.createSalt();
    const dek = await generateDataEncryptionKey();
    assertAuthorized?.();
    const kek = await deriveKeyEncryptionKey(password, salt);
    assertAuthorized?.();
    const wrapped = await wrapDataEncryptionKey(dek, kek);
    assertAuthorized?.();
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

    assertAuthorized?.();
    if (this.reserveInitial) {
      const reservation = structuredClone(metadata);
      await this.reserveInitial(metadata);
      this.initialReservation = reservation;
    } else await this.store.putMetadata(metadata);
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
    this.initialReservation = null;
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
    await this.putMany([{ key, value, schemaVersion }]);
  }

  async putMany(entries: readonly VaultWriteEntry[], assertAuthorized?: () => void): Promise<void> {
    this.requireUnlocked();
    await this.enqueueMutation(async () => {
      assertAuthorized?.();
      const dek = this.requireUnlocked();
      const records = await Promise.all(
        entries.map(entry => encryptJsonRecord(entry.key, entry.schemaVersion ?? 1, entry.value, dek))
      );
      assertAuthorized?.();
      await this.store.putRecords(records);
    });
  }

  async delete(key: VaultRecordKey): Promise<void> {
    this.requireUnlocked();
    await this.enqueueMutation(async () => {
      this.requireUnlocked();
      await this.store.deleteRecord(key);
    });
  }

  async clearAll(): Promise<void> {
    this.lock();
    await this.enqueueMutation(() => this.store.clearAll());
  }

  async activate(assertAuthorized?: () => void, onCommitInvoked?: () => void): Promise<void> {
    assertAuthorized?.();
    this.requireUnlocked();
    if (this.reserveInitial && this.store.activateReservedMetadata && this.store.discardReservedMetadata) {
      const reservation = this.initialReservation;
      if (!reservation) throw new Error('Riserva iniziale non disponibile.');
      let invoked = false;
      try {
        await this.store.activateReservedMetadata(reservation, () => {
          assertAuthorized?.();
          this.requireUnlocked();
          if (this.initialReservation !== reservation) throw new Error('Riserva iniziale non più attuale.');
        }, () => {
          invoked = true;
          onCommitInvoked?.();
        });
      } finally {
        // Once ACTIVE was attempted, only the store's confirmed-abort path
        // may discard the reservation. A generic later catch cannot do so.
        if (invoked) this.initialReservation = null;
      }
      return;
    }
    const metadata = await this.store.getMetadata();
    if (!metadata) {
      throw new Error('Secure Local Vault non configurato.');
    }
    if (metadata.state !== 'STAGING') {
      throw new Error(`Attivazione non ammessa per vault ${metadata.state}.`);
    }

    assertAuthorized?.();
    onCommitInvoked?.();
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
    if (this.reserveInitial && this.store.discardReservedMetadata) {
      const reservation = this.initialReservation;
      try {
        if (!reservation || !await this.store.discardReservedMetadata(reservation)) {
          throw new Error('Riserva iniziale non eliminabile: proprietà non attestata o vault ACTIVE.');
        }
      } finally {
        this.lock();
      }
      return;
    }
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
