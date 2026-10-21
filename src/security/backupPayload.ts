import type { AppData, AppSettings, OnlineSubmission, OnlineTest, UdaRecord } from '../types';
import type { CompleteSecureAppSnapshot, SecureMeta } from './secureAppStorage';

export const BACKUP_DATA_VERSION_V2 = 2;

export interface SecureBackupPayloadV2 {
  app: 'registro-docente';
  backupDataVersion: typeof BACKUP_DATA_VERSION_V2;
  exportedAt: string;
  snapshot: CompleteSecureAppSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCompleteSnapshot(value: unknown): value is CompleteSecureAppSnapshot {
  if (!isRecord(value)) return false;
  return isRecord(value.appData)
    && Array.isArray((value.appData as Record<string, unknown>).classes)
    && isRecord(value.settings)
    && Array.isArray(value.udas)
    && isRecord(value.customTests)
    && Array.isArray(value.submissions)
    && isRecord(value.meta);
}

export function createBackupPayload(
  snapshot: CompleteSecureAppSnapshot,
  exportedAt = new Date().toISOString()
): SecureBackupPayloadV2 {
  return {
    app: 'registro-docente',
    backupDataVersion: BACKUP_DATA_VERSION_V2,
    exportedAt,
    snapshot
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
    if (payload.backupDataVersion !== BACKUP_DATA_VERSION_V2) {
      throw new Error(`Versione dati backup non supportata: ${String(payload.backupDataVersion)}.`);
    }
    if (!isCompleteSnapshot(payload.snapshot)) {
      throw new Error('Il backup v2 non contiene uno snapshot completo dei dati del Registro.');
    }
    return payload.snapshot;
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
    meta: isRecord(payload.meta) ? payload.meta as unknown as SecureMeta : current.meta
  };
}
