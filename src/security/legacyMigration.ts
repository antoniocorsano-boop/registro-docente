import {
  CUSTOM_TESTS_KEY,
  META_KEY,
  SETTINGS_KEY,
  STORAGE_KEY,
  SUBMISSIONS_KEY,
  UDA_KEY
} from '../utils';
import { sanitizePersistedSettings } from './dataClassification';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

interface LegacyEmbeddingConfig {
  apiKey?: string;
  [key: string]: unknown;
}

export interface LegacySettings {
  embeddingConfig?: LegacyEmbeddingConfig;
  [key: string]: unknown;
}

export interface LegacySnapshot {
  appData?: unknown;
  customTests?: unknown;
  settings?: LegacySettings;
  udas?: unknown;
  submissions?: unknown;
  meta?: unknown;
  presentKeys: string[];
}

export interface LegacyValidationResult {
  valid: boolean;
  errors: string[];
}

export interface MigrationInvariants {
  classes: number;
  students: number;
  grades: number;
  behaviors: number;
  submissions: number;
  udas: number;
}

const LEGACY_ENTRIES = [
  [STORAGE_KEY, 'appData'],
  [CUSTOM_TESTS_KEY, 'customTests'],
  [SETTINGS_KEY, 'settings'],
  [UDA_KEY, 'udas'],
  [SUBMISSIONS_KEY, 'submissions'],
  [META_KEY, 'meta']
] as const;

function parseLegacyJson(key: string, raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`JSON legacy non valido per la chiave ${key}.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function collectLegacySnapshot(storage: KeyValueStorage): LegacySnapshot {
  const snapshot: LegacySnapshot = { presentKeys: [] };

  for (const [key, property] of LEGACY_ENTRIES) {
    const raw = storage.getItem(key);
    if (raw === null) continue;

    const parsed = parseLegacyJson(key, raw);
    (snapshot as Record<string, unknown>)[property] = parsed;
    snapshot.presentKeys.push(key);
  }

  return snapshot;
}

export function validateLegacySnapshot(snapshot: LegacySnapshot): LegacyValidationResult {
  const errors: string[] = [];

  if (snapshot.appData !== undefined) {
    if (!isRecord(snapshot.appData) || !Array.isArray(snapshot.appData.classes)) {
      errors.push('appData.classes deve essere un array.');
    }
  }

  if (snapshot.customTests !== undefined && !isRecord(snapshot.customTests)) {
    errors.push('customTests deve essere un oggetto.');
  }

  if (snapshot.settings !== undefined && !isRecord(snapshot.settings)) {
    errors.push('settings deve essere un oggetto.');
  }

  if (snapshot.udas !== undefined && !Array.isArray(snapshot.udas)) {
    errors.push('udas deve essere un array.');
  }

  if (snapshot.submissions !== undefined && !Array.isArray(snapshot.submissions)) {
    errors.push('submissions deve essere un array.');
  }

  if (snapshot.meta !== undefined && !isRecord(snapshot.meta)) {
    errors.push('meta deve essere un oggetto.');
  }

  return { valid: errors.length === 0, errors };
}

export function buildMigrationInvariants(snapshot: LegacySnapshot): MigrationInvariants {
  const classes = isRecord(snapshot.appData) && Array.isArray(snapshot.appData.classes)
    ? snapshot.appData.classes
    : [];

  let students = 0;
  let grades = 0;
  let behaviors = 0;

  for (const classValue of classes) {
    if (!isRecord(classValue)) continue;
    if (Array.isArray(classValue.students)) students += classValue.students.length;
    if (Array.isArray(classValue.grades)) grades += classValue.grades.length;
    if (Array.isArray(classValue.behaviors)) behaviors += classValue.behaviors.length;
  }

  return {
    classes: classes.length,
    students,
    grades,
    behaviors,
    submissions: Array.isArray(snapshot.submissions) ? snapshot.submissions.length : 0,
    udas: Array.isArray(snapshot.udas) ? snapshot.udas.length : 0
  };
}

export function sanitizeLegacySnapshot(snapshot: LegacySnapshot): LegacySnapshot {
  return {
    ...snapshot,
    presentKeys: [...snapshot.presentKeys],
    settings: snapshot.settings
      ? sanitizePersistedSettings(snapshot.settings)
      : undefined
  };
}
