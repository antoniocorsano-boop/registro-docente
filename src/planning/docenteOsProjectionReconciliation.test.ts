import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createEmptyPlanningState } from './emptyPlanningState';
import {
  computeDocenteOsTeachingProjectionFingerprint,
  previewDocenteOsTeachingProjection,
  type DocenteOsTeachingProjectionV1
} from './docenteOsTeachingProjection';
import {
  bindAcceptedDocenteOsTeachingProjection,
  reconcileDocenteOsTeachingProjectionClasses
} from './docenteOsProjectionReconciliation';

function loadProjection(): DocenteOsTeachingProjectionV1 {
  const raw = JSON.parse(readFileSync(
    new URL('../../docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json', import.meta.url),
    'utf8'
  ));
  const preview = previewDocenteOsTeachingProjection(raw);
  if (!preview.ok) throw new Error(`Fixture non valida: ${preview.code}`);
  return preview.projection;
}

function changedProjection(current: DocenteOsTeachingProjectionV1): DocenteOsTeachingProjectionV1 {
  const changed = {
    ...current,
    generatedAt: '2026-10-30T06:30:00.000Z',
    classes: current.classes.map((section, index) => index === 0
      ? {
          ...section,
          udas: section.udas.map((uda, udaIndex) => udaIndex === 0
            ? { ...uda, title: `${uda.title} — aggiornamento` }
            : uda)
        }
      : section)
  };
  const { projectionFingerprint: _projectionFingerprint, ...fingerprintInput } = changed;
  return {
    ...changed,
    projectionFingerprint: {
      algorithm: 'SHA-256',
      hash: computeDocenteOsTeachingProjectionFingerprint(fingerprintInput)
    }
  };
}

describe('A4-R2B Docente OS projection class reconciliation', () => {
  test('resolves compact 1A to the unique real Registro class id', () => {
    const projection = loadProjection();
    expect(reconcileDocenteOsTeachingProjectionClasses(projection, [
      { id: 'class-1a', name: '1A' },
      { id: 'class-1c', name: '1C' }
    ])).toEqual([
      { sourceSectionId: 'section-1a', status: 'resolved', registroClassId: 'class-1a' }
    ]);
  });

  test('display label 1ª A remains one source section and never creates a second local class identity', () => {
    const projection = loadProjection();
    expect(projection.classes[0]?.displayLabel).toBe('1ª A');
    const reconciliation = reconcileDocenteOsTeachingProjectionClasses(projection, [
      { id: 'class-1a', name: '1A' }
    ]);
    expect(reconciliation).toHaveLength(1);
    expect(reconciliation[0]).toEqual({
      sourceSectionId: 'section-1a',
      status: 'resolved',
      registroClassId: 'class-1a'
    });
  });

  test('fails closed as ambiguous when two real class ids share semantic key 1:A', () => {
    const projection = loadProjection();
    expect(reconcileDocenteOsTeachingProjectionClasses(projection, [
      { id: 'class-1a-a', name: '1A' },
      { id: 'class-1a-b', name: '1ª A' }
    ])).toEqual([
      { sourceSectionId: 'section-1a', status: 'ambiguous' }
    ]);
  });

  test('returns unresolved when no local Registro class matches the projected section', () => {
    const projection = loadProjection();
    expect(reconcileDocenteOsTeachingProjectionClasses(projection, [
      { id: 'class-1c', name: '1C' }
    ])).toEqual([
      { sourceSectionId: 'section-1a', status: 'unresolved' }
    ]);
  });

  test('does not silently retarget an accepted class id after local class-list drift', () => {
    const projection = loadProjection();
    const accepted = [
      { sourceSectionId: 'section-1a', status: 'resolved' as const, registroClassId: 'class-1a-old' }
    ];

    expect(reconcileDocenteOsTeachingProjectionClasses(
      projection,
      [{ id: 'class-1a-new', name: '1A' }],
      accepted
    )).toEqual([
      { sourceSectionId: 'section-1a', status: 'unresolved' }
    ]);
  });
});

describe('A4-R2B accepted projection binding', () => {
  test('same accepted fingerprint is idempotent and creates no duplicate', () => {
    const projection = loadProjection();
    const reconciliation = reconcileDocenteOsTeachingProjectionClasses(projection, [
      { id: 'class-1a', name: '1A' }
    ]);
    const initial = createEmptyPlanningState();
    const accepted = bindAcceptedDocenteOsTeachingProjection(initial, projection, reconciliation, {
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

  test('new fingerprint for the same school year and discipline stays uncommitted until explicit acceptance', () => {
    const projection = loadProjection();
    const reconciliation = reconcileDocenteOsTeachingProjectionClasses(projection, [
      { id: 'class-1a', name: '1A' }
    ]);
    const accepted = bindAcceptedDocenteOsTeachingProjection(createEmptyPlanningState(), projection, reconciliation, {
      status: 'accepted',
      acceptedAt: '2026-10-30T07:00:00.000Z'
    });
    const updated = changedProjection(projection);
    expect(updated.projectionFingerprint.hash).not.toBe(projection.projectionFingerprint.hash);

    const previewOnly = bindAcceptedDocenteOsTeachingProjection(accepted, updated, reconciliation, {
      status: 'not-accepted'
    });
    expect(previewOnly).toBe(accepted);
    expect(previewOnly.docenteOsProjections[0]?.projection.projectionFingerprint.hash)
      .toBe(projection.projectionFingerprint.hash);
  });

  test('explicit acceptance replaces only the matching school-year and discipline projection', () => {
    const projection = loadProjection();
    const reconciliation = reconcileDocenteOsTeachingProjectionClasses(projection, [
      { id: 'class-1a', name: '1A' }
    ]);
    const accepted = bindAcceptedDocenteOsTeachingProjection(createEmptyPlanningState(), projection, reconciliation, {
      status: 'accepted',
      acceptedAt: '2026-10-30T07:00:00.000Z'
    });
    const updated = changedProjection(projection);
    const replaced = bindAcceptedDocenteOsTeachingProjection(accepted, updated, reconciliation, {
      status: 'accepted',
      acceptedAt: '2026-10-30T09:00:00.000Z'
    });

    expect(replaced.docenteOsProjections).toHaveLength(1);
    expect(replaced.docenteOsProjections[0]?.projection.projectionFingerprint.hash)
      .toBe(updated.projectionFingerprint.hash);
    expect(replaced.docenteOsProjections[0]?.acceptedAt).toBe('2026-10-30T09:00:00.000Z');
  });
});
