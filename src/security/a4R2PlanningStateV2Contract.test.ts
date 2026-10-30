import { describe, expect, test } from 'bun:test';
import { normalizePlanningState } from '../planning/normalizePlanningState';
import { computeDocenteOsTeachingProjectionFingerprint } from '../planning/docenteOsTeachingProjection';

const legacy = {
  schemaVersion: 1,
  profiles: [],
  arenaContexts: [],
  resources: [],
  masterPrograms: [],
  classInstances: []
};

async function frozenProjection() {
  return Bun.file('docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json').json();
}

describe('A4-R2B encrypted planning v2 migration contract', () => {
  test('promotes historical planning v1 in place to current v2 without fabricating accepted projections', () => {
    expect(normalizePlanningState(legacy)).toEqual({
      ...legacy,
      schemaVersion: 2,
      docenteOsProjections: []
    });
  });

  test('rejects two different accepted projections occupying the same school-year and discipline slot', async () => {
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
      ...legacy,
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
