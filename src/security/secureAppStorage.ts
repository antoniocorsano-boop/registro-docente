import type {
  AppData,
  AppSettings,
  OnlineSubmission,
  OnlineTest,
  UdaRecord
} from '../types';
import { sanitizePersistedSettings } from './dataClassification';
import type { VaultActivationState, VaultRecordKey } from './vaultTypes';
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

export interface CompleteSecureAppSnapshot {
  appData: AppData;
  settings: AppSettings;
  udas: UdaRecord[];
  customTests: Record<string, OnlineTest>;
  submissions: OnlineSubmission[];
  meta: SecureMeta;
}

const SNAPSHOT_KEYS = [
  'appData',
  'settings',
  'udas',
  'customTests',
  'submissions',
  'meta'
] as const;

function sanitizeCompleteSnapshot(snapshot: CompleteSecureAppSnapshot): CompleteSecureAppSnapshot {
  return {
    ...snapshot,
    settings: sanitizePersistedSettings(snapshot.settings)
  };
}

function snapshotEquals(left: SecureAppSnapshot, right: SecureAppSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireCompleteSnapshot(snapshot: SecureAppSnapshot): CompleteSecureAppSnapshot {
  for (const key of SNAPSHOT_KEYS) {
    if (snapshot[key] === null) {
      throw new Error(`Restore non verificabile: record ${key} mancante nel readback.`);
    }
  }
  return snapshot as CompleteSecureAppSnapshot;
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

  saveAppDataAndMeta(appData: AppData, meta: SecureMeta): Promise<void> {
    return this.vault.putMany([
      { key: 'appData', value: appData },
      { key: 'meta', value: meta }
    ]);
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

  private async writeCompleteSnapshot(snapshot: CompleteSecureAppSnapshot): Promise<void> {
    await this.saveAppData(snapshot.appData);
    await this.saveSettings(snapshot.settings);
    await this.saveUdas(snapshot.udas);
    await this.saveCustomTests(snapshot.customTests);
    await this.saveSubmissions(snapshot.submissions);
    await this.saveMeta(snapshot.meta);
  }

  private async restorePreviousSnapshot(snapshot: SecureAppSnapshot): Promise<void> {
    const operations: Array<[VaultRecordKey, unknown]> = [
      ['appData', snapshot.appData],
      ['settings', snapshot.settings],
      ['udas', snapshot.udas],
      ['customTests', snapshot.customTests],
      ['submissions', snapshot.submissions],
      ['meta', snapshot.meta]
    ];

    for (const [key, value] of operations) {
      if (value === null) {
        await this.vault.delete(key);
      } else if (key === 'settings') {
        await this.saveSettings(value as AppSettings);
      } else {
        await this.vault.put(key, value);
      }
    }
  }

  async restoreSnapshotVerified(candidate: CompleteSecureAppSnapshot): Promise<CompleteSecureAppSnapshot> {
    const previous = await this.loadSnapshot();
    const sanitizedCandidate = sanitizeCompleteSnapshot(candidate);

    try {
      await this.writeCompleteSnapshot(sanitizedCandidate);
      const verified = requireCompleteSnapshot(await this.loadSnapshot());
      if (!snapshotEquals(verified, sanitizedCandidate)) {
        throw new Error('Restore non verificabile: il readback non coincide con lo snapshot candidato.');
      }
      return verified;
    } catch (restoreError) {
      try {
        await this.restorePreviousSnapshot(previous);
        const rollbackReadback = await this.loadSnapshot();
        if (!snapshotEquals(rollbackReadback, previous)) {
          throw new Error('Il readback del rollback non coincide con lo snapshot precedente.');
        }
      } catch (rollbackError) {
        const detail = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
        throw new Error(`Restore fallito e rollback non verificato: ${detail}`);
      }

      const detail = restoreError instanceof Error ? restoreError.message : String(restoreError);
      throw new Error(`Restore rifiutato; snapshot precedente ripristinato: ${detail}`);
    }
  }
}
