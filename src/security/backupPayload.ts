import type { AppData, AppSettings, OnlineSubmission, OnlineTest, UdaRecord } from '../types';
import { createEmptyPlanningState } from '../planning/emptyPlanningState';
import { createEmptyLibraryState } from '../library/emptyLibraryState';
import type { PlanningStateV1 } from '../planning/types';
import type { LibraryStateV1 } from '../library/types';
import type { CompleteSecureAppSnapshot, SecureMeta } from './secureAppStorage';

export const BACKUP_DATA_VERSION_V2 = 2;
export const BACKUP_DATA_VERSION_V3 = 3;
export const BACKUP_DATA_VERSION_V4 = 4;

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

export interface SecureBackupPayloadV4 {
  app: 'registro-docente';
  backupDataVersion: typeof BACKUP_DATA_VERSION_V4;
  exportedAt: string;
  snapshot: CompleteSecureAppSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalHttpUrl(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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

const LIBRARY_KINDS = new Set(['image', 'file', 'web', 'text', 'note', 'concept', 'internal']);
const LIBRARY_STATUSES = new Set(['captured', 'ready', 'needs-review', 'restricted', 'failed']);
const LIBRARY_PRIVACY = new Set(['unknown', 'teacher-professional', 'student-personal']);
const LIBRARY_LINK_TARGETS = new Set(['uda', 'lesson', 'activity']);

function isLibraryPayload(value: unknown): boolean {
  return isRecord(value)
    && isOptionalString(value.mimeType)
    && isOptionalString(value.text)
    && isOptionalString(value.dataUrl);
}

function isLibraryStateV1(value: unknown): value is LibraryStateV1 {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.sources)) return false;

  return value.sources.every(source => {
    if (!isRecord(source)) return false;
    if (
      typeof source.id !== 'string'
      || !source.id.trim()
      || typeof source.title !== 'string'
      || !source.title.trim()
      || typeof source.capturedAt !== 'string'
      || !source.capturedAt.trim()
    ) {
      return false;
    }
    if (!LIBRARY_KINDS.has(String(source.kind))) return false;
    if (!LIBRARY_STATUSES.has(String(source.status))) return false;
    if (!LIBRARY_PRIVACY.has(String(source.privacy))) return false;
    if (!isOptionalString(source.origin)) return false;
    if (!isOptionalHttpUrl(source.sourceUrl)) return false;
    if (!isOptionalString(source.extractedText)) return false;
    if (!isOptionalString(source.notes)) return false;
    if (!isLibraryPayload(source.payload) || !Array.isArray(source.links)) return false;

    return source.links.every(link => (
      isRecord(link)
      && LIBRARY_LINK_TARGETS.has(String(link.targetType))
      && typeof link.targetId === 'string'
      && Boolean(link.targetId.trim())
    ));
  });
}

function isSnapshotV4(value: unknown): value is CompleteSecureAppSnapshot {
  return isSnapshotV3(value)
    && isRecord(value)
    && isLibraryStateV1(value.library);
}

export function createBackupPayload(
  snapshot: CompleteSecureAppSnapshot,
  exportedAt = new Date().toISOString()
): SecureBackupPayloadV4 {
  return {
    app: 'registro-docente',
    backupDataVersion: BACKUP_DATA_VERSION_V4,
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
    if (payload.backupDataVersion === BACKUP_DATA_VERSION_V4) {
      if (!isSnapshotV4(payload.snapshot)) {
        throw new Error('Il backup v4 non contiene uno snapshot completo con una biblioteca privata valida.');
      }
      return payload.snapshot;
    }

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
