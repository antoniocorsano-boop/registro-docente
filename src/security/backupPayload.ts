import type { AppData, AppSettings, OnlineSubmission, OnlineTest, UdaRecord } from '../types';
import { createEmptyCopilotState } from '../copilot/emptyCopilotState';
import {
  isCopilotStateV1,
  normalizeLoadedCopilotState,
  type CopilotStateV1
} from '../copilot/state';
import { createEmptyLibraryState } from '../library/emptyLibraryState';
import type { LibraryStateV1 } from '../library/types';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import type { ProfessionalMemoryStateV1 } from '../memory/types';
import { createEmptyPlanningState } from '../planning/emptyPlanningState';
import type { PlanningStateV1 } from '../planning/types';
import type { CompleteSecureAppSnapshot, SecureMeta } from './secureAppStorage';

export const BACKUP_DATA_VERSION_V2 = 2;
export const BACKUP_DATA_VERSION_V3 = 3;
export const BACKUP_DATA_VERSION_V4 = 4;
export const BACKUP_DATA_VERSION_V5 = 5;
export const BACKUP_DATA_VERSION_V6 = 6;

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

interface SecureBackupSnapshotV4 extends SecureBackupSnapshotV3 {
  library: LibraryStateV1;
}

type SecureBackupSnapshotV5 = Omit<CompleteSecureAppSnapshot, 'professionalMemory' | 'copilotState'> & {
  professionalMemory: ProfessionalMemoryStateV1;
};

type SecureBackupSnapshotV6 = Omit<CompleteSecureAppSnapshot, 'professionalMemory' | 'copilotState'> & {
  professionalMemory: ProfessionalMemoryStateV1;
  copilotState: CopilotStateV1;
};

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
  snapshot: SecureBackupSnapshotV4;
}

export interface SecureBackupPayloadV5 {
  app: 'registro-docente';
  backupDataVersion: typeof BACKUP_DATA_VERSION_V5;
  exportedAt: string;
  snapshot: SecureBackupSnapshotV5;
}

export interface SecureBackupPayloadV6 {
  app: 'registro-docente';
  backupDataVersion: typeof BACKUP_DATA_VERSION_V6;
  exportedAt: string;
  snapshot: SecureBackupSnapshotV6;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every(key => allowed.has(key));
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalNonEmptyString(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && Boolean(value.trim()));
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

function isLibraryPayload(value: unknown, kind: unknown): boolean {
  if (!isRecord(value)
    || !isOptionalString(value.mimeType)
    || !isOptionalString(value.text)
    || !isOptionalString(value.dataUrl)) {
    return false;
  }

  const dataUrl = value.dataUrl;
  if (dataUrl !== undefined) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return false;
    if (kind === 'image' && !dataUrl.startsWith('data:image/')) return false;
  }

  return true;
}

function isIsoDate(value: unknown): boolean {
  return typeof value === 'string'
    && Boolean(value.trim())
    && Number.isFinite(Date.parse(value));
}

function isLibraryProvenance(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  if (typeof value.derivedFromSourceId !== 'string' || !value.derivedFromSourceId.trim()) return false;
  if (value.generation === undefined) return true;
  if (!isRecord(value.generation)) return false;
  return typeof value.generation.provider === 'string'
    && Boolean(value.generation.provider.trim())
    && typeof value.generation.model === 'string'
    && Boolean(value.generation.model.trim())
    && isIsoDate(value.generation.generatedAt)
    && value.generation.kind === 'activity';
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
    if (!isLibraryProvenance(source.provenance)) return false;
    if (!isLibraryPayload(source.payload, source.kind) || !Array.isArray(source.links)) return false;

    return source.links.every(link => (
      isRecord(link)
      && LIBRARY_LINK_TARGETS.has(String(link.targetType))
      && typeof link.targetId === 'string'
      && Boolean(link.targetId.trim())
    ));
  });
}

const MEMORY_CATEGORIES = [
  'format-preference',
  'didactic-pattern',
  'material-reuse',
  'planning-continuity',
  'workflow-preference'
] as const;
const MEMORY_CATEGORY_SET = new Set<string>(MEMORY_CATEGORIES);
const MEMORY_EVENT_KINDS = new Set([
  'proposal-adopted',
  'proposal-rejected',
  'proposal-modified',
  'source-reused',
  'source-linked',
  'artifact-created',
  'remember-explicit'
]);
const MEMORY_PROVENANCE_KINDS = new Set([
  'teacher-explicit',
  'product-event',
  'consolidated-inference'
]);
const MEMORY_ALLOWED_PRIVACY = new Set([
  'TEACHER_PROFESSIONAL',
  'CURRICULUM_PLANNING',
  'PUBLIC_EXTERNAL_CONTENT',
  'AGGREGATED_NON_IDENTIFIABLE'
]);
const MEMORY_ENTRY_STATUSES = new Set(['active', 'stale']);
const MEMORY_CONTEXT_KEYS = [
  'className',
  'udaId',
  'lessonId',
  'sourceId',
  'planningProfileId',
  'assessmentId'
] as const;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every(item => typeof item === 'string' && Boolean(item.trim()));
}

function isMemoryContext(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, MEMORY_CONTEXT_KEYS)) return false;
  return MEMORY_CONTEXT_KEYS.every(key => isOptionalNonEmptyString(value[key]));
}

function isMemoryProvenance(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['kind', 'canonicalRef'])) return false;
  return MEMORY_PROVENANCE_KINDS.has(String(value.kind))
    && isOptionalNonEmptyString(value.canonicalRef);
}

function isMemoryEvent(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'id',
    'kind',
    'category',
    'occurredAt',
    'descriptor',
    'context',
    'provenance',
    'privacyClassification'
  ])) return false;

  return typeof value.id === 'string'
    && Boolean(value.id.trim())
    && MEMORY_EVENT_KINDS.has(String(value.kind))
    && MEMORY_CATEGORY_SET.has(String(value.category))
    && isIsoDate(value.occurredAt)
    && typeof value.descriptor === 'string'
    && Boolean(value.descriptor.trim())
    && isMemoryContext(value.context)
    && isMemoryProvenance(value.provenance)
    && MEMORY_ALLOWED_PRIVACY.has(String(value.privacyClassification));
}

function isMemoryEntry(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'id',
    'category',
    'summary',
    'provenance',
    'sourceEventIds',
    'canonicalRefs',
    'createdAt',
    'updatedAt',
    'correctedByTeacherAt',
    'status',
    'context',
    'privacyClassification'
  ])) return false;

  return typeof value.id === 'string'
    && Boolean(value.id.trim())
    && MEMORY_CATEGORY_SET.has(String(value.category))
    && typeof value.summary === 'string'
    && Boolean(value.summary.trim())
    && isMemoryProvenance(value.provenance)
    && isStringArray(value.sourceEventIds)
    && isStringArray(value.canonicalRefs)
    && isIsoDate(value.createdAt)
    && isIsoDate(value.updatedAt)
    && (value.correctedByTeacherAt === undefined || isIsoDate(value.correctedByTeacherAt))
    && MEMORY_ENTRY_STATUSES.has(String(value.status))
    && isMemoryContext(value.context)
    && MEMORY_ALLOWED_PRIVACY.has(String(value.privacyClassification));
}

function isProfessionalMemoryStateV1(value: unknown): value is ProfessionalMemoryStateV1 {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ['schemaVersion', 'events', 'entries', 'settings'])
    || value.schemaVersion !== 1
    || !Array.isArray(value.events)
    || !Array.isArray(value.entries)
    || !isRecord(value.settings)) {
    return false;
  }

  const settings = value.settings;
  if (!hasOnlyKeys(settings, ['autoRemember']) || !isRecord(settings.autoRemember)) {
    return false;
  }
  const autoRemember = settings.autoRemember;
  if (!hasOnlyKeys(autoRemember, MEMORY_CATEGORIES)) return false;

  return MEMORY_CATEGORIES.every(category => typeof autoRemember[category] === 'boolean')
    && value.events.every(isMemoryEvent)
    && value.entries.every(isMemoryEntry);
}

function isSnapshotV4(value: unknown): value is SecureBackupSnapshotV4 {
  return isSnapshotV3(value)
    && isRecord(value)
    && isLibraryStateV1(value.library);
}

function isSnapshotV5(value: unknown): value is SecureBackupSnapshotV5 {
  return isSnapshotV4(value)
    && isRecord(value)
    && isProfessionalMemoryStateV1(value.professionalMemory);
}

function isSnapshotV6(value: unknown): value is SecureBackupSnapshotV6 {
  if (!isRecord(value) || !isSnapshotV5(value)) return false;
  return isCopilotStateV1((value as Record<string, unknown>).copilotState);
}

export function createBackupPayload(
  snapshot: CompleteSecureAppSnapshot,
  exportedAt = new Date().toISOString()
): SecureBackupPayloadV6 {
  return {
    app: 'registro-docente',
    backupDataVersion: BACKUP_DATA_VERSION_V6,
    exportedAt,
    snapshot: {
      ...snapshot,
      professionalMemory: snapshot.professionalMemory ?? createEmptyProfessionalMemoryState(),
      copilotState: normalizeLoadedCopilotState(snapshot.copilotState ?? createEmptyCopilotState())
    }
  };
}

export function normalizeBackupPayload(
  payload: unknown,
  current: CompleteSecureAppSnapshot
): CompleteSecureAppSnapshot & {
  professionalMemory: ProfessionalMemoryStateV1;
  copilotState: CopilotStateV1;
} {
  if (!isRecord(payload)) {
    throw new Error('Backup registro-docente non valido.');
  }

  if (payload.app !== undefined && payload.app !== 'registro-docente') {
    throw new Error('Il file non appartiene a registro-docente.');
  }

  if (payload.backupDataVersion !== undefined) {
    if (payload.backupDataVersion === BACKUP_DATA_VERSION_V6) {
      if (!isSnapshotV6(payload.snapshot)) {
        throw new Error('Il backup v6 non contiene uno snapshot completo con stato Copilota valido e supervisionato.');
      }
      return {
        ...payload.snapshot,
        copilotState: normalizeLoadedCopilotState(payload.snapshot.copilotState)
      };
    }

    if (payload.backupDataVersion === BACKUP_DATA_VERSION_V5) {
      if (!isSnapshotV5(payload.snapshot)) {
        throw new Error('Il backup v5 non contiene uno snapshot completo con memoria professionale valida e privacy-safe.');
      }
      return {
        ...payload.snapshot,
        copilotState: createEmptyCopilotState()
      };
    }

    if (payload.backupDataVersion === BACKUP_DATA_VERSION_V4) {
      if (!isSnapshotV4(payload.snapshot)) {
        throw new Error('Il backup v4 non contiene uno snapshot completo con una biblioteca privata valida.');
      }
      return {
        ...payload.snapshot,
        professionalMemory: createEmptyProfessionalMemoryState(),
        copilotState: createEmptyCopilotState()
      };
    }

    if (payload.backupDataVersion === BACKUP_DATA_VERSION_V3) {
      if (!isSnapshotV3(payload.snapshot)) {
        throw new Error('Il backup v3 non contiene uno snapshot completo dei dati del Registro.');
      }
      return {
        ...payload.snapshot,
        library: createEmptyLibraryState(),
        professionalMemory: createEmptyProfessionalMemoryState(),
        copilotState: createEmptyCopilotState()
      };
    }

    if (payload.backupDataVersion === BACKUP_DATA_VERSION_V2) {
      if (!isSnapshotV2(payload.snapshot)) {
        throw new Error('Il backup v2 non contiene uno snapshot completo dei dati del Registro.');
      }
      return {
        ...payload.snapshot,
        planning: createEmptyPlanningState(),
        library: createEmptyLibraryState(),
        professionalMemory: createEmptyProfessionalMemoryState(),
        copilotState: createEmptyCopilotState()
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
    professionalMemory: createEmptyProfessionalMemoryState(),
    copilotState: createEmptyCopilotState(),
    meta: isRecord(payload.meta) ? payload.meta as unknown as SecureMeta : current.meta
  };
}
