import type { PlanningState } from '../planning/types';

export function applyPlanningMutation(
  current: PlanningState,
  derive: (current: PlanningState) => PlanningState
): PlanningState {
  return derive(current);
}
