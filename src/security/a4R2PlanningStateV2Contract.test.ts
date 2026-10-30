import { describe, expect, test } from 'bun:test';
import { normalizePlanningState } from '../planning/normalizePlanningState';

describe('A4-R2B encrypted planning v2 migration contract', () => {
  test('promotes historical planning v1 in place to current v2 without fabricating accepted projections', () => {
    const legacy = {
      schemaVersion: 1,
      profiles: [],
      arenaContexts: [],
      resources: [],
      masterPrograms: [],
      classInstances: []
    };

    expect(normalizePlanningState(legacy)).toEqual({
      ...legacy,
      schemaVersion: 2,
      docenteOsProjections: []
    });
  });
});
