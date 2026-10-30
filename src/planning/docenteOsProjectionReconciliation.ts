import {
  previewDocenteOsTeachingProjection,
  type DocenteOsTeachingProjectionV1
} from './docenteOsTeachingProjection';
import type {
  DocenteOsProjectionClassReconciliation,
  PlanningStateV2
} from './types';
import { resolveCanonicalRegistroClass } from '../teaching/classIdentity';

export type DocenteOsProjectionAcceptanceDecision =
  | { status: 'accepted'; acceptedAt: string }
  | { status: 'not-accepted' };

type RegistroClassIdentity = { id: string; name: string };

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function sameProjectionSlot(
  left: DocenteOsTeachingProjectionV1,
  right: DocenteOsTeachingProjectionV1
): boolean {
  return left.schoolYear === right.schoolYear
    && left.disciplineName.trim().toLocaleLowerCase('it') === right.disciplineName.trim().toLocaleLowerCase('it');
}

export function findAcceptedDocenteOsTeachingProjectionForSlot(
  current: PlanningStateV2,
  projection: DocenteOsTeachingProjectionV1
) {
  return current.docenteOsProjections.find(item => sameProjectionSlot(item.projection, projection));
}

function toStoredReconciliation(
  sourceSectionId: string,
  resolution: ReturnType<typeof resolveCanonicalRegistroClass>
): DocenteOsProjectionClassReconciliation {
  if (resolution.status === 'resolved') {
    return {
      sourceSectionId,
      status: 'resolved',
      registroClassId: resolution.classId
    };
  }

  return {
    sourceSectionId,
    status: resolution.status
  };
}

export function reconcileDocenteOsTeachingProjectionClasses(
  projection: DocenteOsTeachingProjectionV1,
  classes: RegistroClassIdentity[],
  previous: DocenteOsProjectionClassReconciliation[] = []
): DocenteOsProjectionClassReconciliation[] {
  const previousBySection = new Map(previous.map(item => [item.sourceSectionId, item]));

  return projection.classes.map(section => {
    const current = resolveCanonicalRegistroClass(section.compactLabel, classes);
    const prior = previousBySection.get(section.sourceSectionId);

    if (prior?.status === 'resolved') {
      if (current.status === 'ambiguous') {
        return { sourceSectionId: section.sourceSectionId, status: 'ambiguous' };
      }
      if (current.status === 'resolved' && current.classId === prior.registroClassId) {
        return {
          sourceSectionId: section.sourceSectionId,
          status: 'resolved',
          registroClassId: prior.registroClassId
        };
      }
      return { sourceSectionId: section.sourceSectionId, status: 'unresolved' };
    }

    if (prior?.status === 'ambiguous') {
      return { sourceSectionId: section.sourceSectionId, status: 'ambiguous' };
    }
    if (prior?.status === 'unresolved') {
      return { sourceSectionId: section.sourceSectionId, status: 'unresolved' };
    }

    return toStoredReconciliation(section.sourceSectionId, current);
  });
}

function assertCompleteReconciliation(
  projection: DocenteOsTeachingProjectionV1,
  reconciliation: DocenteOsProjectionClassReconciliation[]
): void {
  const sourceSectionIds = new Set(projection.classes.map(section => section.sourceSectionId));
  if (reconciliation.length !== sourceSectionIds.size) {
    throw new Error('La riconciliazione delle classi Docente OS è incompleta.');
  }

  const seen = new Set<string>();
  for (const item of reconciliation) {
    if (!sourceSectionIds.has(item.sourceSectionId) || seen.has(item.sourceSectionId)) {
      throw new Error('La riconciliazione delle classi Docente OS contiene sezioni non valide o duplicate.');
    }
    if (item.status === 'resolved' && !item.registroClassId.trim()) {
      throw new Error('La riconciliazione risolta richiede un identificativo classe Registro.');
    }
    seen.add(item.sourceSectionId);
  }
}

export function bindAcceptedDocenteOsTeachingProjection(
  current: PlanningStateV2,
  projection: DocenteOsTeachingProjectionV1,
  reconciliation: DocenteOsProjectionClassReconciliation[],
  decision: DocenteOsProjectionAcceptanceDecision
): PlanningStateV2 {
  if (decision.status !== 'accepted') return current;

  const preview = previewDocenteOsTeachingProjection(projection);
  if (!preview.ok) {
    throw new Error(`Proiezione Docente OS non valida: ${preview.code}.`);
  }
  if (!isIsoTimestamp(decision.acceptedAt)) {
    throw new Error('Data di accettazione della proiezione Docente OS non valida.');
  }
  assertCompleteReconciliation(projection, reconciliation);

  const fingerprint = projection.projectionFingerprint.hash;
  if (current.docenteOsProjections.some(item => item.projection.projectionFingerprint.hash === fingerprint)) {
    return current;
  }

  const accepted = {
    projection,
    acceptedAt: decision.acceptedAt,
    classReconciliation: reconciliation
  };
  const slotIndex = current.docenteOsProjections.findIndex(item => sameProjectionSlot(item.projection, projection));

  if (slotIndex < 0) {
    return {
      ...current,
      docenteOsProjections: [...current.docenteOsProjections, accepted]
    };
  }

  const next = [...current.docenteOsProjections];
  next[slotIndex] = accepted;
  return {
    ...current,
    docenteOsProjections: next
  };
}
