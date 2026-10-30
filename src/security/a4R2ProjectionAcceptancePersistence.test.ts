import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDurableMutationCoordinator } from '../persistence/durableMutationCoordinator';
import { createEmptyPlanningState } from '../planning/emptyPlanningState';
import { previewDocenteOsTeachingProjection } from '../planning/docenteOsTeachingProjection';
import {
  bindAcceptedDocenteOsTeachingProjection,
  reconcileDocenteOsTeachingProjectionClasses
} from '../planning/docenteOsProjectionReconciliation';

describe('A4-R2B commit-first projection acceptance boundary', () => {
  test('failed durable save cannot publish the new accepted projection or success', async () => {
    const fixture = JSON.parse(readFileSync(
      join(process.cwd(), 'docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json'),
      'utf8'
    ));
    const preview = previewDocenteOsTeachingProjection(fixture);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    const reconciliation = reconcileDocenteOsTeachingProjectionClasses(preview.projection, [
      { id: 'class-1a', name: '1A' }
    ]);
    const coordinator = createDurableMutationCoordinator();
    let committedPlanning = createEmptyPlanningState();
    let published = false;
    let successReported = false;

    await expect(coordinator.enqueue({
      getCommitted: () => committedPlanning,
      derive: current => bindAcceptedDocenteOsTeachingProjection(current, preview.projection, reconciliation, {
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

  test('App routes explicit projection acceptance through the existing commit-first planning mutation', () => {
    const appSource = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(appSource).toContain('const handleAcceptDocenteOsTeachingProjection = useCallback');
    expect(appSource).toContain('reconcileDocenteOsTeachingProjectionClasses');
    expect(appSource).toContain('bindAcceptedDocenteOsTeachingProjection');
    expect(appSource).toContain('commitPlanningMutation(current =>');
  });
});
