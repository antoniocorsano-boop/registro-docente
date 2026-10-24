import type { PlanningStateV1 } from './types';

export function createEmptyPlanningState(): PlanningStateV1 {
  return {
    schemaVersion: 1,
    profiles: [],
    arenaContexts: [],
    resources: [],
    masterPrograms: [],
    classInstances: []
  };
}
