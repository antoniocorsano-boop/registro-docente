import type {
  AppData,
  AppSettings,
  OnlineSubmission,
  OnlineTest,
  UdaRecord
} from '../types';
import { sanitizePersistedSettings } from './dataClassification';
import type { VaultActivationState } from './vaultTypes';
import { SecureVault } from './secureVault';

export type VaultGateState =
  | 'CHECKING'
  | 'SETUP_REQUIRED'
  | 'MIGRATION_REQUIRED'
  | 'LOCKED'
  | 'MIGRATING'
  | 'READY'
  | 'ERROR';

export interface VaultBootstrapInput {
  metadataState: VaultActivationState | null;
  hasLegacyData: boolean;
  indexedDbAvailable: boolean;
  webCryptoAvailable: boolean;
}

export interface SecureMeta {
  changes: number;
  lastBackup: string | null;
}

export interface SecureAppSnapshot {
  appData: AppData | null;
  settings: AppSettings | null;
  udas: UdaRecord[] | null;
  customTests: Record<string, OnlineTest> | null;
  submissions: OnlineSubmission[] | null;
  meta: SecureMeta | null;
}

export function decideVaultBootstrap(input: VaultBootstrapInput): VaultGateState {
  if (!input.indexedDbAvailable || !input.webCryptoAvailable) {
    return 'ERROR';
  }

  if (input.metadataState === 'STAGING') {
    return 'ERROR';
  }

  if (input.metadataState === 'ACTIVE') {
    return 'LOCKED';
  }

  return input.hasLegacyData ? 'MIGRATION_REQUIRED' : 'SETUP_REQUIRED';
}

export class SecureAppStorage {
  constructor(private readonly vault: SecureVault) {}

  async loadSnapshot(): Promise<SecureAppSnapshot> {
    const [appData, settings, udas, customTests, submissions, meta] = await Promise.all([
      this.vault.get<AppData>('appData'),
      this.vault.get<AppSettings>('settings'),
      this.vault.get<UdaRecord[]>('udas'),
      this.vault.get<Record<string, OnlineTest>>('customTests'),
      this.vault.get<OnlineSubmission[]>('submissions'),
      this.vault.get<SecureMeta>('meta')
    ]);

    return { appData, settings, udas, customTests, submissions, meta };
  }

  saveAppData(value: AppData): Promise<void> {
    return this.vault.put('appData', value);
  }

  saveSettings(value: AppSettings): Promise<void> {
    return this.vault.put('settings', sanitizePersistedSettings(value));
  }

  saveUdas(value: UdaRecord[]): Promise<void> {
    return this.vault.put('udas', value);
  }

  saveCustomTests(value: Record<string, OnlineTest>): Promise<void> {
    return this.vault.put('customTests', value);
  }

  saveSubmissions(value: OnlineSubmission[]): Promise<void> {
    return this.vault.put('submissions', value);
  }

  saveMeta(value: SecureMeta): Promise<void> {
    return this.vault.put('meta', value);
  }
}
