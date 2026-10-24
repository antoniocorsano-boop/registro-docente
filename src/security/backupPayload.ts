import type { AppData, AppSettings, OnlineSubmission, OnlineTest, UdaRecord } from '../types';
import { createEmptyPlanningState } from '../planning/emptyPlanningState';
import { createEmptyLibraryState } from '../library/emptyLibraryState';
import type { PlanningStateV1 } from '../planning/types';
import type { CompleteSecureAppSnapshot, SecureMeta } from './secureAppStorage';

export const BACKUP_DATA_VERSION_V2 = 2;
export const BACKUP_DATA_VERSION_V3 = 3;

interface SecureBackupSnapshotV2 {
  appData: AppData;
  settings: AppSettings;
  udas: UdaRecord[];
  customTests: Record<string, OnlineTest>;
  submissions: OnlineSubmission[];
  meta: SecureMeta;
}

interface SecureBackupSnapshotV3 extends SecureBackupSnapshotV2 {
  planning: PlanningStateV1;
}

export interface SecureBackupPayloadV2 {
  app: 'registro-docente';
  backupDataVersion: typeof BACKUP_DATA_VERSION_V2;
  exportedAt: string;
  snapshot: SecureBackupSnapshotV2;
}

export interface SecureBackupPayloadV3 {
  app: 'registro-docente';
  backupDataVersion: typeof BACKUP_DATA_VERSION_V3;
  exportedAt: string;
  snapshot: SecureBackupSnapshotV3;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlanningStateV1(value: unknown): value is PlanningStateV1 {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  return Array.isArray(value.profiles)
    && Array.isArray(value.arenaContexts)
    && Array.isArray(value.resources)
    && Array.isArray(value.masterPrograms)
    && Array.isArray(value.classInstances);
}

function isSnapshotV2(value: unknown): value is SecureBackupSnapshotV2 {
  if (!isRecord(value)) return false;
  return isRecord(value.appData)
    && Array.isArray((value.appData as Record<string, unknown>).classes)
    && isRecord(value.settings)
    && Array.isArray(value.udas)
    && isRecord(value.customTests)
    && Array.isArray(value.submissions)
    && isRecord(value.meta);
}

function isSnapshotV3(value: unknown): value is SecureBackupSnapshotV3 {
  return isSnapshotV2(value)
    && isRecord(value)
    && isPlanningStateV1(value.planning);
}

export function createBackupPayload(
  snapshot: CompleteSecureAppSnapshot,
  exportedAt = new Date().toISOString()
): SecureBackupPayloadV3 {
  const { library: _library, ...snapshotV3 } = snapshot;
  return {
    app: 'registro-docente',
    backupDataVersion: BACKUP_DATA_VERSION_V3,
    exportedAt,
    snapshot: snapshotV3
  };
}

export function normalizeBackupPayload(
  payload: unknown,
  current: CompleteSecureAppSnapshot
): CompleteSecureAppSnapshot {
  if (!isRecord(payload)) {
    throw new Error('Backup registro-docente non valido.');
  }

  if (payload.app !== undefined && payload.app !== 'registro-docente') {
    throw new Error('Il file non appartiene a registro-docente.');
  }

  if (payload.backupDataVersion !== undefined) {
    if (payload.backupDataVersion === BACKUP_DATA_VERSION_V3) {
      if (!isSnapshotV3(payload.snapshot)) {
        throw new Error('Il backup v3 non contiene uno snapshot completo dei dati del Registro.');
      }
      return {
        ...payload.snapshot,
        library: createEmptyLibraryState()
      };
    }

    if (payload.backupDataVersion === BACKUP_DATA_VERSION_V2) {
      if (!isSnapshotV2(payload.snapshot)) {
        throw new Error('Il backup v2 non contiene uno snapshot completo dei dati del Registro.');
      }
      return {
        ...payload.snapshot,
        planning: createEmptyPlanningState(),
        library: createEmptyLibraryState()
      };
    }

    throw new Error(`Versione dati backup non supportata: ${String(payload.backupDataVersion)}.`);
  }

  const legacyData = isRecord(payload.data) ? payload.data : null;
  const legacyClasses = Array.isArray(payload.classes)
    ? payload.classes
    : legacyData && Array.isArray(legacyData.classes)
      ? legacyData.classes
      : null;

  if (!legacyClasses) {
    throw new Error('Il backup legacy non contiene dati validi del registro-docente.');
  }

  const appData: AppData = legacyData && Array.isArray(legacyData.classes)
    ? legacyData as unknown as AppData
    : { classes: legacyClasses as AppData['classes'], currentClassId: null };

  return {
    appData,
    settings: isRecord(payload.settings) ? payload.settings as unknown as AppSettings : current.settings,
    udas: Array.isArray(payload.udas) ? payload.udas as UdaRecord[] : current.udas,
    customTests: isRecord(payload.customTests)
      ? payload.customTests as Record<string, OnlineTest>
      : current.customTests,
    submissions: Array.isArray(payload.submissions)
      ? payload.submissions as OnlineSubmission[]
      : current.submissions,
    planning: createEmptyPlanningState(),
    library: createEmptyLibraryState(),
    meta: isRecord(payload.meta) ? payload.meta as unknown as SecureMeta : current.meta
  };
}
