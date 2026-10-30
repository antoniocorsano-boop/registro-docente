import { previewDocenteOsTeachingProjection } from './docenteOsTeachingProjection';
import type {
  AcceptedDocenteOsTeachingProjection,
  DocenteOsProjectionClassReconciliation,
  PlanningStateV1,
  PlanningStateV2
} from './types';

const V1_KEYS = [
  'schemaVersion',
  'profiles',
  'arenaContexts',
  'resources',
  'masterPrograms',
  'classInstances'
] as const;
const V2_KEYS = [...V1_KEYS, 'docenteOsProjections'] as const;
const ACCEPTED_PROJECTION_KEYS = ['projection', 'acceptedAt', 'classReconciliation'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function hasPlanningArrays(value: Record<string, unknown>): boolean {
  return Array.isArray(value.profiles)
    && Array.isArray(value.arenaContexts)
    && Array.isArray(value.resources)
    && Array.isArray(value.masterPrograms)
    && Array.isArray(value.classInstances);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function isReconciliation(
  value: unknown,
  sourceSectionIds: Set<string>
): value is DocenteOsProjectionClassReconciliation {
  if (!isRecord(value) || !isNonEmptyString(value.sourceSectionId) || !sourceSectionIds.has(value.sourceSectionId)) {
    return false;
  }

  if (value.status === 'resolved') {
    return hasExactKeys(value, ['sourceSectionId', 'status', 'registroClassId'])
      && isNonEmptyString(value.registroClassId);
  }

  if (value.status === 'ambiguous' || value.status === 'unresolved') {
    return hasExactKeys(value, ['sourceSectionId', 'status']);
  }

  return false;
}

function isAcceptedProjection(value: unknown): value is AcceptedDocenteOsTeachingProjection {
  if (!isRecord(value) || !hasExactKeys(value, ACCEPTED_PROJECTION_KEYS) || !isIsoTimestamp(value.acceptedAt)) {
    return false;
  }

  const preview = previewDocenteOsTeachingProjection(value.projection);
  if (!preview.ok || !Array.isArray(value.classReconciliation)) return false;

  const sourceSectionIds = new Set(preview.projection.classes.map(section => section.sourceSectionId));
  if (value.classReconciliation.length !== sourceSectionIds.size) return false;

  const reconciledIds = new Set<string>();
  for (const decision of value.classReconciliation) {
    if (!isReconciliation(decision, sourceSectionIds) || reconciledIds.has(decision.sourceSectionId)) return false;
    reconciledIds.add(decision.sourceSectionId);
  }

  return reconciledIds.size === sourceSectionIds.size;
}

function assertPlanningV1(value: Record<string, unknown>): asserts value is PlanningStateV1 {
  if (!hasExactKeys(value, V1_KEYS) || value.schemaVersion !== 1 || !hasPlanningArrays(value)) {
    throw new Error('Stato planning v1 non valido.');
  }
}

function assertPlanningV2(value: Record<string, unknown>): asserts value is PlanningStateV2 {
  if (
    !hasExactKeys(value, V2_KEYS)
    || value.schemaVersion !== 2
    || !hasPlanningArrays(value)
    || !Array.isArray(value.docenteOsProjections)
  ) {
    throw new Error('Stato planning v2 non valido.');
  }

  const fingerprints = new Set<string>();
  for (const accepted of value.docenteOsProjections) {
    if (!isAcceptedProjection(accepted)) {
      throw new Error('Proiezione Docente OS accettata non valida.');
    }
    const fingerprint = accepted.projection.projectionFingerprint.hash;
    if (fingerprints.has(fingerprint)) {
      throw new Error('Proiezione Docente OS accettata duplicata.');
    }
    fingerprints.add(fingerprint);
  }
}

export function normalizePlanningState(value: unknown): PlanningStateV2 {
  if (!isRecord(value)) throw new Error('Stato planning non valido.');

  if (value.schemaVersion === 1) {
    assertPlanningV1(value);
    return {
      schemaVersion: 2,
      profiles: value.profiles,
      arenaContexts: value.arenaContexts,
      resources: value.resources,
      masterPrograms: value.masterPrograms,
      classInstances: value.classInstances,
      docenteOsProjections: []
    };
  }

  if (value.schemaVersion === 2) {
    assertPlanningV2(value);
    return value;
  }

  throw new Error(`Versione planning non supportata: ${String(value.schemaVersion)}.`);
}
