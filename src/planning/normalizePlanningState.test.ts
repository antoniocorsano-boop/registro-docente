import { describe, expect, test } from 'bun:test';
import { normalizePlanningState } from './normalizePlanningState';
import { computeDocenteOsTeachingProjectionFingerprint } from './docenteOsTeachingProjection';

const legacyV1 = {
  schemaVersion: 1 as const,
  profiles: [{ id: 'profile-legacy' }],
  arenaContexts: [{ id: 'arena-legacy' }],
  resources: [{ id: 'resource-legacy' }],
  masterPrograms: [{ id: 'master-legacy' }],
  classInstances: [{ id: 'instance-legacy' }]
};

async function frozenProjection() {
  return Bun.file('docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json').json();
}

describe('A4-R2B planning state v2 normalization', () => {
  test('normalizes canonical v1 to v2 without changing any historical planning field', () => {
    const normalized = normalizePlanningState(legacyV1);

    expect(normalized).toEqual({
      ...legacyV1,
      schemaVersion: 2,
      docenteOsProjections: []
    });
    expect(legacyV1.schemaVersion).toBe(1);
    expect((legacyV1 as Record<string, unknown>).docenteOsProjections).toBeUndefined();
  });

  test('round-trips canonical v2 with one validated accepted projection unchanged', async () => {
    const projection = await frozenProjection();
    const v2 = {
      ...legacyV1,
      schemaVersion: 2 as const,
      docenteOsProjections: [{
        projection,
        acceptedAt: '2026-10-30T09:50:00.000Z',
        classReconciliation: [{
          sourceSectionId: 'section-1a',
          status: 'resolved' as const,
          registroClassId: 'class-real-1a'
        }]
      }]
    };

    expect(normalizePlanningState(v2)).toEqual(v2);
  });

  test('fails closed for unknown schemas and invalid accepted projections', async () => {
    expect(() => normalizePlanningState({ ...legacyV1, schemaVersion: 3 })).toThrow();

    const projection = await frozenProjection() as Record<string, any>;
    const invalidProjection = structuredClone(projection);
    invalidProjection.privacyClass = 'PERSONAL';

    expect(() => normalizePlanningState({
      ...legacyV1,
      schemaVersion: 2,
      docenteOsProjections: [{
        projection: invalidProjection,
        acceptedAt: '2026-10-30T09:50:00.000Z',
        classReconciliation: [{
          sourceSectionId: 'section-1a',
          status: 'resolved',
          registroClassId: 'class-real-1a'
        }]
      }]
    })).toThrow();
  });

  test('never accepts incomplete or invented class reconciliation metadata', async () => {
    const projection = await frozenProjection();

    expect(() => normalizePlanningState({
      ...legacyV1,
      schemaVersion: 2,
      docenteOsProjections: [{
        projection,
        acceptedAt: '2026-10-30T09:50:00.000Z',
        classReconciliation: []
      }]
    })).toThrow();
  });

  test('fails closed when two different accepted projections occupy the same school-year and discipline slot', async () => {
    const first = await frozenProjection() as Record<string, any>;
    const second = structuredClone(first);
    second.generatedAt = '2026-10-30T06:30:00.000Z';
    second.classes[0].udas[0].title = `${second.classes[0].udas[0].title} — aggiornamento`;
    const { projectionFingerprint: _projectionFingerprint, ...fingerprintInput } = second;
    second.projectionFingerprint = {
      algorithm: 'SHA-256',
      hash: computeDocenteOsTeachingProjectionFingerprint(fingerprintInput as any)
    };

    expect(second.projectionFingerprint.hash).not.toBe(first.projectionFingerprint.hash);
    expect(() => normalizePlanningState({
      ...legacyV1,
      schemaVersion: 2,
      docenteOsProjections: [
        {
          projection: first,
          acceptedAt: '2026-10-30T09:50:00.000Z',
          classReconciliation: [{
            sourceSectionId: 'section-1a',
            status: 'resolved',
            registroClassId: 'class-real-1a'
          }]
        },
        {
          projection: second,
          acceptedAt: '2026-10-30T10:50:00.000Z',
          classReconciliation: [{
            sourceSectionId: 'section-1a',
            status: 'resolved',
            registroClassId: 'class-real-1a'
          }]
        }
      ]
    })).toThrow('Slot proiezione Docente OS accettata duplicato.');
  });
});
