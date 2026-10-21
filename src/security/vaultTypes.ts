export interface EncryptedVaultRecord {
  recordKey: string;
  schemaVersion: number;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}
