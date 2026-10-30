import type {
  AcceptedDocenteOsTeachingProjection,
  DocenteOsProjectionClassReconciliation
} from '../planning/types';
import type { ClassData, UdaLesson, UdaRecord } from '../types';
import { resolveCanonicalRegistroClass } from './classIdentity';

export type TeachingUdaClassReconciliation = Readonly<
  Record<string, readonly DocenteOsProjectionClassReconciliation[]>
>;

export interface TeachingUdaCandidateProvenance {
  sourceSectionId: string;
  sourceCommit: string;
  sourceRepository: string;
  sourceBranch: string;
  projectionFingerprint: string;
  canonicalGenerationId: string;
}

export interface TeachingUdaCandidate {
  id: string;
  origin: 'registro' | 'docente-os';
  classId: string;
  classLabel: string;
  className: string;
  title: string;
  periodLabel: string;
  period: string;
  plannedHours: number;
  sourceRef: string;
  writableByRegistro: boolean;
  lessons: readonly UdaLesson[];
  localUda?: UdaRecord;
  focus?: string;
  provenance?: TeachingUdaCandidateProvenance;
}

export interface BuildTeachingUdaCatalogInput {
  localUdas: readonly UdaRecord[];
  acceptedProjections: readonly AcceptedDocenteOsTeachingProjection[];
  classReconciliation: TeachingUdaClassReconciliation;
  classes: ClassData[];
}

function projectionFingerprintCounts(
  acceptedProjections: readonly AcceptedDocenteOsTeachingProjection[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const accepted of acceptedProjections) {
    const fingerprint = accepted.projection.projectionFingerprint.hash;
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  }
  return counts;
}

function projectedUdaIdCounts(
  acceptedProjections: readonly AcceptedDocenteOsTeachingProjection[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const accepted of acceptedProjections) {
    for (const projectedClass of accepted.projection.classes) {
      for (const projectedUda of projectedClass.udas) {
        counts.set(
          projectedUda.projectedUdaId,
          (counts.get(projectedUda.projectedUdaId) ?? 0) + 1
        );
      }
    }
  }
  return counts;
}

export function buildTeachingUdaClassReconciliationIndex(
  acceptedProjections: readonly AcceptedDocenteOsTeachingProjection[]
): TeachingUdaClassReconciliation {
  const counts = projectionFingerprintCounts(acceptedProjections);
  const entries: Array<[string, readonly DocenteOsProjectionClassReconciliation[]]> = [];

  for (const accepted of acceptedProjections) {
    const fingerprint = accepted.projection.projectionFingerprint.hash;
    if (counts.get(fingerprint) !== 1) continue;
    entries.push([fingerprint, accepted.classReconciliation]);
  }

  return Object.fromEntries(entries);
}

function localCandidate(uda: UdaRecord, classes: ClassData[]): TeachingUdaCandidate | null {
  const resolution = resolveCanonicalRegistroClass(uda.className, classes);
  if (resolution.status !== 'resolved') return null;

  return {
    id: uda.id,
    origin: 'registro',
    classId: resolution.classId,
    classLabel: resolution.label,
    className: resolution.label,
    title: uda.title,
    periodLabel: uda.period,
    period: uda.period,
    plannedHours: uda.hours,
    sourceRef: uda.id,
    writableByRegistro: true,
    lessons: uda.lessons ?? [],
    localUda: uda
  };
}

function resolvedProjectionClass(
  sourceSectionId: string,
  fingerprint: string,
  classReconciliation: TeachingUdaClassReconciliation
): Extract<DocenteOsProjectionClassReconciliation, { status: 'resolved' }> | null {
  const matches = (classReconciliation[fingerprint] ?? [])
    .filter(item => item.sourceSectionId === sourceSectionId);
  if (matches.length !== 1) return null;

  const match = matches[0];
  return match?.status === 'resolved' ? match : null;
}

export function buildTeachingUdaCatalog({
  localUdas,
  acceptedProjections,
  classReconciliation,
  classes
}: BuildTeachingUdaCatalogInput): TeachingUdaCandidate[] {
  const catalog: TeachingUdaCandidate[] = [];
  const seenIds = new Set<string>();
  const fingerprintCounts = projectionFingerprintCounts(acceptedProjections);
  const projectedIdCounts = projectedUdaIdCounts(acceptedProjections);

  for (const uda of localUdas) {
    const candidate = localCandidate(uda, classes);
    if (!candidate || seenIds.has(candidate.id)) continue;
    seenIds.add(candidate.id);
    catalog.push(candidate);
  }

  for (const accepted of acceptedProjections) {
    const projection = accepted.projection;
    const fingerprint = projection.projectionFingerprint.hash;
    if (fingerprintCounts.get(fingerprint) !== 1) continue;

    for (const projectedClass of projection.classes) {
      const reconciliation = resolvedProjectionClass(
        projectedClass.sourceSectionId,
        fingerprint,
        classReconciliation
      );
      if (!reconciliation) continue;

      const currentResolution = resolveCanonicalRegistroClass(projectedClass.compactLabel, classes);
      if (
        currentResolution.status !== 'resolved'
        || currentResolution.classId !== reconciliation.registroClassId
      ) {
        continue;
      }

      for (const projectedUda of projectedClass.udas) {
        if (projectedIdCounts.get(projectedUda.projectedUdaId) !== 1) continue;
        if (seenIds.has(projectedUda.projectedUdaId)) continue;
        seenIds.add(projectedUda.projectedUdaId);
        catalog.push({
          id: projectedUda.projectedUdaId,
          origin: 'docente-os',
          classId: reconciliation.registroClassId,
          classLabel: currentResolution.label,
          className: currentResolution.label,
          title: projectedUda.title,
          periodLabel: projectedUda.period,
          period: projectedUda.period,
          plannedHours: projectedUda.plannedHours,
          sourceRef: projectedUda.sourceUdaRef,
          writableByRegistro: false,
          lessons: [],
          focus: projectedUda.focus,
          provenance: {
            sourceSectionId: projectedClass.sourceSectionId,
            sourceCommit: projection.provenance.sourceCommit,
            sourceRepository: projection.provenance.repository,
            sourceBranch: projection.provenance.sourceBranch,
            projectionFingerprint: fingerprint,
            canonicalGenerationId: projectedUda.canonicalGenerationId
          }
        });
      }
    }
  }

  return catalog;
}

export function resolveTeachingUdaCandidate(
  udaId: string,
  catalog: readonly TeachingUdaCandidate[]
): TeachingUdaCandidate | null {
  const matches = catalog.filter(candidate => candidate.id === udaId);
  return matches.length === 1 ? matches[0] ?? null : null;
}

export function assertTeachingUdaWritableByRegistro(candidate: TeachingUdaCandidate): void {
  if (!candidate.writableByRegistro) {
    throw new Error('A4_R2_PROJECTED_UDA_READ_ONLY');
  }
}
