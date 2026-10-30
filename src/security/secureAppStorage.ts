import type {
  AppData,
  AppSettings,
  OnlineSubmission,
  OnlineTest,
  UdaRecord
} from '../types';
import { createEmptyCopilotState } from '../copilot/emptyCopilotState';
import {
  isCopilotStateV1,
  normalizeLoadedCopilotState,
  type CopilotStateV1
} from '../copilot/state';
import type { LibraryStateV1 } from '../library/types';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import type { ProfessionalMemoryStateV1 } from '../memory/types';
import { normalizePlanningState } from '../planning/normalizePlanningState';
import type { PlanningState } from '../planning/types';
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
  planning: PlanningState | null;
  library: LibraryStateV1 | null;
  professionalMemory: ProfessionalMemoryStateV1;
  copilotState: CopilotStateV1;
  meta: SecureMeta | null;
}

export interface CompleteSecureAppSnapshot {
  appData: AppData;
  settings: AppSettings;
  udas: UdaRecord[];
  customTests: Record<string, OnlineTest>;
  submissions: OnlineSubmission[];
  planning: PlanningState;
  library: LibraryStateV1;
  professionalMemory?: ProfessionalMemoryStateV1;
  copilotState?: CopilotStateV1;
  meta: SecureMeta;
}

type CanonicalCompleteSecureAppSnapshot = CompleteSecureAppSnapshot & {
  professionalMemory: ProfessionalMemoryStateV1;
  copilotState: CopilotStateV1;
};

const SNAPSHOT_KEYS = [
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
] as const;

function canonicalizeCompleteSnapshot(
  snapshot: CompleteSecureAppSnapshot
): CanonicalCompleteSecureAppSnapshot {
  return {
    appData: snapshot.appData,
    settings: sanitizePersistedSettings(snapshot.settings),
    udas: snapshot.udas,
    customTests: snapshot.customTests,
    submissions: snapshot.submissions,
    planning: normalizePlanningState(snapshot.planning),
    library: snapshot.library,
    professionalMemory: snapshot.professionalMemory ?? createEmptyProfessionalMemoryState(),
    copilotState: normalizeLoadedCopilotState(snapshot.copilotState ?? createEmptyCopilotState()),
    meta: snapshot.meta
  };
}

function snapshotEquals(left: SecureAppSnapshot, right: SecureAppSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireCompleteSnapshot(snapshot: SecureAppSnapshot): CanonicalCompleteSecureAppSnapshot {
  for (const key of SNAPSHOT_KEYS) {
    if (snapshot[key] === null) {
      throw new Error(`Restore non verificabile: record ${key} mancante nel readback.`);
    }
  }
  return snapshot as CanonicalCompleteSecureAppSnapshot;
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
    const [
      appData,
      settings,
      udas,
      customTests,
      submissions,
      storedPlanning,
      library,
      professionalMemory,
      storedCopilotState,
      meta
    ] = await Promise.all([
      this.vault.get<AppData>('appData'),
      this.vault.get<AppSettings>('settings'),
      this.vault.get<UdaRecord[]>('udas'),
      this.vault.get<Record<string, OnlineTest>>('customTests'),
      this.vault.get<OnlineSubmission[]>('submissions'),
      this.vault.get<unknown>('planning'),
      this.vault.get<LibraryStateV1>('library'),
      this.vault.get<ProfessionalMemoryStateV1>('professionalMemory'),
      this.vault.get<CopilotStateV1>('copilotState'),
      this.vault.get<SecureMeta>('meta')
    ]);

    const planning = storedPlanning === null ? null : normalizePlanningState(storedPlanning);
    const copilotState = isCopilotStateV1(storedCopilotState)
      ? normalizeLoadedCopilotState(storedCopilotState)
      : createEmptyCopilotState();

    return {
      appData,
      settings,
      udas,
      customTests,
      submissions,
      planning,
      library,
      professionalMemory: professionalMemory ?? createEmptyProfessionalMemoryState(),
      copilotState,
      meta
    };
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

  saveSettingsAndMeta(settings: AppSettings, meta: SecureMeta): Promise<void> {
    return this.vault.putMany([
      { key: 'settings', value: sanitizePersistedSettings(settings) },
      { key: 'meta', value: meta }
    ]);
  }

  saveUdas(value: UdaRecord[]): Promise<void> {
    return this.vault.put('udas', value);
  }

  saveUdasAndMeta(udas: UdaRecord[], meta: SecureMeta): Promise<void> {
    return this.vault.putMany([
      { key: 'udas', value: udas },
      { key: 'meta', value: meta }
    ]);
  }

  saveCustomTests(value: Record<string, OnlineTest>): Promise<void> {
    return this.vault.put('customTests', value);
  }

  saveCustomTestsAndMeta(tests: Record<string, OnlineTest>, meta: SecureMeta): Promise<void> {
    return this.vault.putMany([
      { key: 'customTests', value: tests },
      { key: 'meta', value: meta }
    ]);
  }

  saveSubmissions(value: OnlineSubmission[]): Promise<void> {
    return this.vault.put('submissions', value);
  }

  saveSubmissionsAndMeta(submissions: OnlineSubmission[], meta: SecureMeta): Promise<void> {
    return this.vault.putMany([
      { key: 'submissions', value: submissions },
      { key: 'meta', value: meta }
    ]);
  }

  savePlanning(value: PlanningState): Promise<void> {
    return this.vault.put('planning', value);
  }

  savePlanningAndMeta(planning: PlanningState, meta: SecureMeta): Promise<void> {
    return this.vault.putMany([
      { key: 'planning', value: planning },
      { key: 'meta', value: meta }
    ]);
  }

  saveLibrary(value: LibraryStateV1): Promise<void> {
    return this.vault.put('library', value);
  }

  saveLibraryAndMeta(library: LibraryStateV1, meta: SecureMeta): Promise<void> {
    return this.vault.putMany([
      { key: 'library', value: library },
      { key: 'meta', value: meta }
    ]);
  }

  saveLibraryUdasAndMeta(library: LibraryStateV1, udas: UdaRecord[], meta: SecureMeta): Promise<void> {
    return this.vault.putMany([
      { key: 'library', value: library },
      { key: 'udas', value: udas },
      { key: 'meta', value: meta }
    ]);
  }

  saveProfessionalMemory(value: ProfessionalMemoryStateV1): Promise<void> {
    return this.vault.put('professionalMemory', value);
  }

  saveProfessionalMemoryAndMeta(
    memory: ProfessionalMemoryStateV1,
    meta: SecureMeta
  ): Promise<void> {
    return this.vault.putMany([
      { key: 'professionalMemory', value: memory },
      { key: 'meta', value: meta }
    ]);
  }

  saveCopilotState(copilotState: CopilotStateV1): Promise<void> {
    return this.vault.put('copilotState', copilotState);
  }

  saveCopilotStateAndMeta(copilotState: CopilotStateV1, meta: SecureMeta): Promise<void> {
    return this.vault.putMany([
      { key: 'copilotState', value: copilotState },
      { key: 'meta', value: meta }
    ]);
  }

  saveMeta(value: SecureMeta): Promise<void> {
    return this.vault.put('meta', value);
  }

  private writeCompleteSnapshotAtomic(snapshot: CompleteSecureAppSnapshot): Promise<void> {
    const sanitized = canonicalizeCompleteSnapshot(snapshot);
    return this.vault.putMany([
      { key: 'appData', value: sanitized.appData },
      { key: 'settings', value: sanitized.settings },
      { key: 'udas', value: sanitized.udas },
      { key: 'customTests', value: sanitized.customTests },
      { key: 'submissions', value: sanitized.submissions },
      { key: 'planning', value: sanitized.planning },
      { key: 'library', value: sanitized.library },
      { key: 'professionalMemory', value: sanitized.professionalMemory },
      { key: 'copilotState', value: sanitized.copilotState },
      { key: 'meta', value: sanitized.meta }
    ]);
  }

  private async restorePreviousPhysicalSnapshot(snapshot: SecureAppSnapshot): Promise<void> {
    const operations: Array<[VaultRecordKey, unknown]> = [
      ['appData', snapshot.appData],
      ['settings', snapshot.settings],
      ['udas', snapshot.udas],
      ['customTests', snapshot.customTests],
      ['submissions', snapshot.submissions],
      ['planning', snapshot.planning],
      ['library', snapshot.library],
      ['professionalMemory', snapshot.professionalMemory],
      ['copilotState', snapshot.copilotState],
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

  async restoreSnapshotVerified(
    candidate: CompleteSecureAppSnapshot,
    previousLogical?: CompleteSecureAppSnapshot
  ): Promise<CanonicalCompleteSecureAppSnapshot> {
    const previousPhysical = previousLogical ? null : await this.loadSnapshot();
    const canonicalCandidate = canonicalizeCompleteSnapshot(candidate);
    const canonicalPrevious = previousLogical ? canonicalizeCompleteSnapshot(previousLogical) : null;

    try {
      await this.writeCompleteSnapshotAtomic(canonicalCandidate);
      const verified = requireCompleteSnapshot(await this.loadSnapshot());
      if (!snapshotEquals(verified, canonicalCandidate)) {
        throw new Error('Restore non verificabile: il readback non coincide con lo snapshot candidato.');
      }
      return verified;
    } catch (restoreError) {
      try {
        if (canonicalPrevious) {
          await this.writeCompleteSnapshotAtomic(canonicalPrevious);
          const rollbackReadback = requireCompleteSnapshot(await this.loadSnapshot());
          if (!snapshotEquals(rollbackReadback, canonicalPrevious)) {
            throw new Error('Il readback del rollback non coincide con lo snapshot precedente.');
          }
        } else if (previousPhysical) {
          await this.restorePreviousPhysicalSnapshot(previousPhysical);
          const rollbackReadback = await this.loadSnapshot();
          if (!snapshotEquals(rollbackReadback, previousPhysical)) {
            throw new Error('Il readback del rollback non coincide con lo snapshot precedente.');
          }
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
