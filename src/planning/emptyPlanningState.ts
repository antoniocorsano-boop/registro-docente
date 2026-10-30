import type { PlanningState } from './types';

export function createEmptyPlanningState(): PlanningState {
  return {
    schemaVersion: 2,
    profiles: [],
    arenaContexts: [],
    resources: [],
    masterPrograms: [],
    classInstances: [],
    docenteOsProjections: []
  };
}
