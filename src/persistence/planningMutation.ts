import type { PlanningStateV1 } from '../planning/types';

export function applyPlanningMutation(
  current: PlanningStateV1,
  derive: (current: PlanningStateV1) => PlanningStateV1
): PlanningStateV1 {
  return derive(current);
}
