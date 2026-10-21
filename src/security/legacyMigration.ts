import {
  CUSTOM_TESTS_KEY,
  META_KEY,
  SETTINGS_KEY,
  STORAGE_KEY,
  SUBMISSIONS_KEY,
  UDA_KEY
} from '../utils';
import { sanitizePersistedSettings } from './dataClassification';
import { SecureVault } from './secureVault';
import type { VaultRecordKey } from './vaultTypes';

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

export interface MigrationResult {
  migratedKeys: string[];
  invariants: MigrationInvariants;
}

const LEGACY_ENTRIES = [
  [STORAGE_KEY, 'appData'],
  [CUSTOM_TESTS_KEY, 'customTests'],
  [SETTINGS_KEY, 'settings'],
  [UDA_KEY, 'udas'],
  [SUBMISSIONS_KEY, 'submissions'],
  [META_KEY, 'meta']
] as const;

const MIGRATION_RECORDS: ReadonlyArray<{
  legacyKey: string;
  property: Exclude<keyof LegacySnapshot, 'presentKeys'>;
  recordKey: VaultRecordKey;
}> = [
  { legacyKey: STORAGE_KEY, property: 'appData', recordKey: 'appData' },
  { legacyKey: CUSTOM_TESTS_KEY, property: 'customTests', recordKey: 'customTests' },
  { legacyKey: SETTINGS_KEY, property: 'settings', recordKey: 'settings' },
  { legacyKey: UDA_KEY, property: 'udas', recordKey: 'udas' },
  { legacyKey: SUBMISSIONS_KEY, property: 'submissions', recordKey: 'submissions' },
  { legacyKey: META_KEY, property: 'meta', recordKey: 'meta' }
];

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

function valuesMatch(expected: unknown, actual: unknown): boolean {
  return JSON.stringify(expected) === JSON.stringify(actual);
}

type LegacySnapshotProperty = Exclude<keyof LegacySnapshot, 'presentKeys'>;

function setLegacySnapshotProperty(
  snapshot: LegacySnapshot,
  property: LegacySnapshotProperty,
  value: unknown
): void {
  switch (property) {
    case 'appData': snapshot.appData = value; break;
    case 'customTests': snapshot.customTests = value; break;
    case 'settings': snapshot.settings = value as LegacySettings; break;
    case 'udas': snapshot.udas = value; break;
    case 'submissions': snapshot.submissions = value; break;
    case 'meta': snapshot.meta = value; break;
  }
}

export function collectLegacySnapshot(storage: KeyValueStorage): LegacySnapshot {
  const snapshot: LegacySnapshot = { presentKeys: [] };

  for (const [key, property] of LEGACY_ENTRIES) {
    const raw = storage.getItem(key);
    if (raw === null) continue;

    const parsed = parseLegacyJson(key, raw);
    setLegacySnapshotProperty(snapshot, property, parsed);
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

export async function migrateLegacyToVault(
  storage: KeyValueStorage,
  vault: SecureVault,
  password: string
): Promise<MigrationResult> {
  const source = collectLegacySnapshot(storage);
  const validation = validateLegacySnapshot(source);
  if (!validation.valid) {
    throw new Error(`Snapshot legacy non valido: ${validation.errors.join(' ')}`);
  }
  if (source.presentKeys.length === 0) {
    throw new Error('Nessun dato legacy da migrare.');
  }

  const sanitized = sanitizeLegacySnapshot(source);
  const expectedInvariants = buildMigrationInvariants(sanitized);

  await vault.createStaging(password);

  try {
    for (const mapping of MIGRATION_RECORDS) {
      const value = sanitized[mapping.property];
      if (value === undefined) continue;
      await vault.put(mapping.recordKey, value);
    }

    const readback: LegacySnapshot = { presentKeys: [...sanitized.presentKeys] };
    for (const mapping of MIGRATION_RECORDS) {
      const expected = sanitized[mapping.property];
      if (expected === undefined) continue;

      const actual = await vault.get(mapping.recordKey);
      if (!valuesMatch(expected, actual)) {
        throw new Error(`Readback/invarianti non coerenti per ${mapping.recordKey}.`);
      }
      setLegacySnapshotProperty(readback, mapping.property, actual);
    }

    const actualInvariants = buildMigrationInvariants(readback);
    if (!valuesMatch(expectedInvariants, actualInvariants)) {
      throw new Error('Verifica invarianti della migrazione non riuscita.');
    }

    await vault.activate();
  } catch (error) {
    try {
      await vault.discardStaging();
    } catch {
      // Preserve the original migration error; an ACTIVE vault cannot be discarded here.
    }
    throw error;
  }

  for (const legacyKey of source.presentKeys) {
    storage.removeItem(legacyKey);
  }

  return {
    migratedKeys: [...source.presentKeys],
    invariants: expectedInvariants
  };
}
