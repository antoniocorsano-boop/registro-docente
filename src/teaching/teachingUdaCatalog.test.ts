import { describe, expect, test } from 'bun:test';
import type { AcceptedDocenteOsTeachingProjection, DocenteOsProjectionClassReconciliation } from '../planning/types';
import type { ClassData, UdaRecord } from '../types';
import {
  buildTeachingUdaCatalog,
  resolveTeachingUdaCandidate,
  type TeachingUdaClassReconciliation
} from './teachingUdaCatalog';

const FINGERPRINT = 'a'.repeat(64);

function classData(id: string, name: string): ClassData {
  return { id, name, students: [], grades: [], behaviors: [] };
}

function localUda(overrides: Partial<UdaRecord> = {}): UdaRecord {
  return {
    id: 'local-uda-1',
    title: 'Materiali e risorse',
    className: '1ª A',
    hours: 6,
    period: 'Q1',
    startMonth: 0,
    durationMonths: 2,
    ...overrides
  };
}

function acceptedProjection(
  reconciliation: DocenteOsProjectionClassReconciliation[] = [
    { sourceSectionId: 'section-1a', status: 'resolved', registroClassId: 'class-1a' }
  ]
): AcceptedDocenteOsTeachingProjection {
  return {
    acceptedAt: '2026-10-30T10:00:00.000Z',
    classReconciliation: reconciliation,
    projection: {
      contract: 'DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1',
      contractVersion: 1,
      sourceProduct: 'DOCENTE_OS',
      targetProduct: 'REGISTRO_DOCENTE',
      importMode: 'READ_ONLY_PROJECTION',
      acceptanceRequired: true,
      automaticWriteAllowed: false,
      schoolYear: '2026/2027',
      disciplineName: 'Tecnologia',
      generatedAt: '2026-10-30T09:00:00.000Z',
      projectionFingerprint: { algorithm: 'SHA-256', hash: FINGERPRINT },
      provenance: {
        repository: 'antoniocorsano-boop/docente-os-2026-27',
        sourceCommit: '0123456789abcdef0123456789abcdef01234567',
        sourceBranch: 'develop'
      },
      classes: [{
        sourceSectionId: 'section-1a',
        grade: 1,
        sectionCode: 'A',
        compactLabel: '1A',
        displayLabel: '1ª A',
        sectionStatus: 'CONFERMATA',
        canonicalPlan: {
          code: 'CAN-PLAN-1',
          assetId: 'plan-asset-1',
          generationId: 'plan-generation-1'
        },
        udas: [{
          sourceUdaRef: '1-01',
          projectedUdaId: 'docente-os:section-1a:plan-generation-1:1-01',
          title: 'Tecnologia, bisogni, risorse e sistemi',
          focus: 'Bisogni, risorse e sistemi',
          plannedHours: 8,
          period: 'Settembre/Ottobre',
          packRefs: ['CAN-PACK-1A'],
          canonicalGenerationId: 'plan-generation-1'
        }]
      }],
      privacyClass: 'PROFESSIONAL_NON_PERSONAL'
    }
  };
}

function reconciliationMap(
  items: DocenteOsProjectionClassReconciliation[]
): TeachingUdaClassReconciliation {
  return { [FINGERPRINT]: items };
}

describe('A4-R2B Task 6 unified UDA catalog', () => {
  test('local and projected UDA coexist under one canonical Registro class', () => {
    const classes = [classData('class-1a', '1A')];
    const accepted = acceptedProjection();
    const catalog = buildTeachingUdaCatalog({
      localUdas: [localUda()],
      acceptedProjections: [accepted],
      classReconciliation: reconciliationMap(accepted.classReconciliation),
      classes
    });

    expect(catalog).toHaveLength(2);
    expect(catalog.map(item => item.classId)).toEqual(['class-1a', 'class-1a']);
    expect(catalog.map(item => item.origin).sort()).toEqual(['docente-os', 'registro']);

    const projected = resolveTeachingUdaCandidate(
      'docente-os:section-1a:plan-generation-1:1-01',
      catalog
    );
    expect(projected).toMatchObject({
      origin: 'docente-os',
      classId: 'class-1a',
      classLabel: '1A',
      title: 'Tecnologia, bisogni, risorse e sistemi',
      periodLabel: 'Settembre/Ottobre',
      plannedHours: 8,
      sourceRef: '1-01',
      writableByRegistro: false,
      provenance: {
        sourceSectionId: 'section-1a',
        sourceCommit: '0123456789abcdef0123456789abcdef01234567',
        projectionFingerprint: FINGERPRINT
      }
    });

    const local = resolveTeachingUdaCandidate('local-uda-1', catalog);
    expect(local).toMatchObject({
      origin: 'registro',
      classId: 'class-1a',
      classLabel: '1A',
      sourceRef: 'local-uda-1',
      writableByRegistro: true
    });
  });

  test.each(['ambiguous', 'unresolved'] as const)(
    '%s projected class mapping produces no selectable projected UDA',
    status => {
      const accepted = acceptedProjection([{ sourceSectionId: 'section-1a', status }]);
      const catalog = buildTeachingUdaCatalog({
        localUdas: [localUda()],
        acceptedProjections: [accepted],
        classReconciliation: reconciliationMap(accepted.classReconciliation),
        classes: [classData('class-1a', '1A')]
      });

      expect(catalog.map(item => item.id)).toEqual(['local-uda-1']);
    }
  );

  test('stale resolved mapping fails closed instead of silently retargeting', () => {
    const accepted = acceptedProjection();
    const catalog = buildTeachingUdaCatalog({
      localUdas: [],
      acceptedProjections: [accepted],
      classReconciliation: reconciliationMap(accepted.classReconciliation),
      classes: [classData('different-class', '1A')]
    });

    expect(catalog).toEqual([]);
  });

  test('re-imported projected ID is deduplicated without cloning a local UDA', () => {
    const accepted = acceptedProjection();
    const catalog = buildTeachingUdaCatalog({
      localUdas: [],
      acceptedProjections: [accepted, structuredClone(accepted)],
      classReconciliation: reconciliationMap(accepted.classReconciliation),
      classes: [classData('class-1a', '1A')]
    });

    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.id).toBe('docente-os:section-1a:plan-generation-1:1-01');
    expect(catalog[0]?.origin).toBe('docente-os');
  });
});
