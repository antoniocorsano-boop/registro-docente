export type VaultActivationState = 'STAGING' | 'ACTIVE';

export type VaultRecordKey =
  | 'appData'
  | 'settings'
  | 'udas'
  | 'customTests'
  | 'submissions'
  | 'planning'
  | 'library'
  | 'meta';

export interface VaultKdfParametersV1 {
  name: 'PBKDF2';
  hash: 'SHA-256';
  iterations: 600_000;
}

export interface VaultMetadataV1 {
  vaultVersion: 1;
  state: VaultActivationState;
  kdf: VaultKdfParametersV1;
  salt: Uint8Array;
  wrappedDek: ArrayBuffer;
  wrapIv: Uint8Array;
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedVaultRecord {
  recordKey: string;
  schemaVersion: number;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}
