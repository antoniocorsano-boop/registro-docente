import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDurableMutationCoordinator } from '../persistence/durableMutationCoordinator';
import { createEmptyPlanningState } from '../planning/emptyPlanningState';
import {
  computeDocenteOsTeachingProjectionFingerprint,
  previewDocenteOsTeachingProjection,
  type DocenteOsTeachingProjectionV1
} from '../planning/docenteOsTeachingProjection';
import {
  bindAcceptedDocenteOsTeachingProjection,
  reconcileDocenteOsTeachingProjectionClasses
} from '../planning/docenteOsProjectionReconciliation';

function loadProjection(): DocenteOsTeachingProjectionV1 {
  const fixture = JSON.parse(readFileSync(
    join(process.cwd(), 'docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json'),
    'utf8'
  ));
  const preview = previewDocenteOsTeachingProjection(fixture);
  if (!preview.ok) throw new Error(`Fixture non valida: ${preview.code}`);
  return preview.projection;
}

function mutateProjection(
  current: DocenteOsTeachingProjectionV1,
  options: { schoolYear?: string; titleSuffix: string }
): DocenteOsTeachingProjectionV1 {
  const changed = {
    ...current,
    ...(options.schoolYear ? { schoolYear: options.schoolYear } : {}),
    generatedAt: '2026-10-30T06:30:00.000Z',
    classes: current.classes.map((section, index) => index === 0
      ? {
          ...section,
          udas: section.udas.map((uda, udaIndex) => udaIndex === 0
            ? { ...uda, title: `${uda.title}${options.titleSuffix}` }
            : uda)
        }
      : section)
  };
  const { projectionFingerprint: _fingerprint, ...fingerprintInput } = changed;
  return {
    ...changed,
    projectionFingerprint: {
      algorithm: 'SHA-256',
      hash: computeDocenteOsTeachingProjectionFingerprint(fingerprintInput as Omit<DocenteOsTeachingProjectionV1, 'projectionFingerprint'>)
    }
  } as DocenteOsTeachingProjectionV1;
}

describe('A4-R2B class reconciliation authority', () => {
  test('compact and display aliases resolve one source section to the unique real Registro class id', () => {
    const projection = loadProjection();
    expect(projection.classes[0]?.compactLabel).toBe('1A');
    expect(projection.classes[0]?.displayLabel).toBe('1ª A');

    expect(reconcileDocenteOsTeachingProjectionClasses(projection, [
      { id: 'class-1a', name: '1A' },
      { id: 'class-1c', name: '1C' }
    ])).toEqual([
      { sourceSectionId: 'section-1a', status: 'resolved', registroClassId: 'class-1a' }
    ]);
  });

  test('duplicate real semantic identity fails closed as ambiguous', () => {
    const projection = loadProjection();
    expect(reconcileDocenteOsTeachingProjectionClasses(projection, [
      { id: 'class-1a-a', name: '1A' },
      { id: 'class-1a-b', name: '1ª A' }
    ])).toEqual([
      { sourceSectionId: 'section-1a', status: 'ambiguous' }
    ]);
  });

  test('missing local class is unresolved', () => {
    const projection = loadProjection();
    expect(reconcileDocenteOsTeachingProjectionClasses(projection, [
      { id: 'class-1c', name: '1C' }
    ])).toEqual([
      { sourceSectionId: 'section-1a', status: 'unresolved' }
    ]);
  });

  test('local class-list drift never silently retargets an accepted source section to a different real id', () => {
    const projection = loadProjection();
    expect(reconcileDocenteOsTeachingProjectionClasses(
      projection,
      [{ id: 'class-1a-new', name: '1A' }],
      [{ sourceSectionId: 'section-1a', status: 'resolved', registroClassId: 'class-1a-old' }]
    )).toEqual([
      { sourceSectionId: 'section-1a', status: 'unresolved' }
    ]);
  });

  test('previous unresolved mapping can heal when one real Registro class later becomes available', () => {
    const projection = loadProjection();
    expect(reconcileDocenteOsTeachingProjectionClasses(
      projection,
      [{ id: 'class-1a', name: '1A' }],
      [{ sourceSectionId: 'section-1a', status: 'unresolved' }]
    )).toEqual([
      { sourceSectionId: 'section-1a', status: 'resolved', registroClassId: 'class-1a' }
    ]);
  });

  test('previous ambiguity can heal when duplicate semantic class identities are removed', () => {
    const projection = loadProjection();
    expect(reconcileDocenteOsTeachingProjectionClasses(
      projection,
      [{ id: 'class-1a', name: '1A' }],
      [{ sourceSectionId: 'section-1a', status: 'ambiguous' }]
    )).toEqual([
      { sourceSectionId: 'section-1a', status: 'resolved', registroClassId: 'class-1a' }
    ]);
  });
});

describe('A4-R2B accepted projection binding authority', () => {
  test('same accepted fingerprint is idempotent and does not duplicate the projection', () => {
    const projection = loadProjection();
    const reconciliation = reconcileDocenteOsTeachingProjectionClasses(projection, [{ id: 'class-1a', name: '1A' }]);
    const accepted = bindAcceptedDocenteOsTeachingProjection(createEmptyPlanningState(), projection, reconciliation, {
      status: 'accepted',
      acceptedAt: '2026-10-30T07:00:00.000Z'
    });
    const repeated = bindAcceptedDocenteOsTeachingProjection(accepted, projection, reconciliation, {
      status: 'accepted',
      acceptedAt: '2026-10-30T08:00:00.000Z'
    });

    expect(repeated).toBe(accepted);
    expect(repeated.docenteOsProjections).toHaveLength(1);
  });

  test('new fingerprint remains uncommitted until an explicit acceptance decision', () => {
    const projection = loadProjection();
    const reconciliation = reconcileDocenteOsTeachingProjectionClasses(projection, [{ id: 'class-1a', name: '1A' }]);
    const accepted = bindAcceptedDocenteOsTeachingProjection(createEmptyPlanningState(), projection, reconciliation, {
      status: 'accepted',
      acceptedAt: '2026-10-30T07:00:00.000Z'
    });
    const updated = mutateProjection(projection, { titleSuffix: ' — aggiornamento' });

    expect(updated.projectionFingerprint.hash).not.toBe(projection.projectionFingerprint.hash);
    expect(bindAcceptedDocenteOsTeachingProjection(accepted, updated, reconciliation, { status: 'not-accepted' }))
      .toBe(accepted);
  });

  test('explicit acceptance replaces only the matching school-year and discipline slot', () => {
    const projection = loadProjection();
    const reconciliation = reconcileDocenteOsTeachingProjectionClasses(projection, [{ id: 'class-1a', name: '1A' }]);
    const unrelated = mutateProjection(projection, { schoolYear: '2027/2028', titleSuffix: ' — anno successivo' });
    let current = bindAcceptedDocenteOsTeachingProjection(createEmptyPlanningState(), projection, reconciliation, {
      status: 'accepted',
      acceptedAt: '2026-10-30T07:00:00.000Z'
    });
    current = bindAcceptedDocenteOsTeachingProjection(current, unrelated, reconciliation, {
      status: 'accepted',
      acceptedAt: '2026-10-30T07:30:00.000Z'
    });

    const updated = mutateProjection(projection, { titleSuffix: ' — aggiornamento accettato' });
    const replaced = bindAcceptedDocenteOsTeachingProjection(current, updated, reconciliation, {
      status: 'accepted',
      acceptedAt: '2026-10-30T09:00:00.000Z'
    });

    expect(replaced.docenteOsProjections).toHaveLength(2);
    expect(replaced.docenteOsProjections.find(item => item.projection.schoolYear === '2026/2027')?.projection.projectionFingerprint.hash)
      .toBe(updated.projectionFingerprint.hash);
    expect(replaced.docenteOsProjections.find(item => item.projection.schoolYear === '2027/2028')?.projection.projectionFingerprint.hash)
      .toBe(unrelated.projectionFingerprint.hash);
  });
});

describe('A4-R2B commit-first projection acceptance boundary', () => {
  test('failed durable save cannot publish the new accepted projection or success', async () => {
    const projection = loadProjection();
    const reconciliation = reconcileDocenteOsTeachingProjectionClasses(projection, [
      { id: 'class-1a', name: '1A' }
    ]);
    const coordinator = createDurableMutationCoordinator();
    let committedPlanning = createEmptyPlanningState();
    let published = false;
    let successReported = false;

    await expect(coordinator.enqueue({
      getCommitted: () => committedPlanning,
      derive: current => bindAcceptedDocenteOsTeachingProjection(current, projection, reconciliation, {
        status: 'accepted',
        acceptedAt: '2026-10-30T10:00:00.000Z'
      }),
      persist: async () => {
        throw new Error('forced projection persistence failure');
      },
      publish: candidate => {
        published = true;
        committedPlanning = candidate;
      },
      afterCommit: () => {
        successReported = true;
      }
    })).rejects.toThrow('forced projection persistence failure');

    expect(published).toBe(false);
    expect(successReported).toBe(false);
    expect(committedPlanning.docenteOsProjections).toEqual([]);
  });

  test('App reconciles at serialized execution time and reuses the prior accepted mapping before replacement', () => {
    const appSource = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    const start = appSource.indexOf('const handleAcceptDocenteOsTeachingProjection = useCallback');
    const end = appSource.indexOf('const commitLibraryMutation = useCallback', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const handlerSource = appSource.slice(start, end);

    const commitIndex = handlerSource.indexOf('commitPlanningMutation(current => {');
    const reconciliationIndex = handlerSource.indexOf('reconcileDocenteOsTeachingProjectionClasses');
    expect(commitIndex).toBeGreaterThanOrEqual(0);
    expect(reconciliationIndex).toBeGreaterThan(commitIndex);
    expect(handlerSource).toContain('previousAcceptedProjection');
    expect(handlerSource).toContain('previousAcceptedProjection?.classReconciliation');
    expect(handlerSource).toContain('bindAcceptedDocenteOsTeachingProjection');
  });
});
