import { createEmptyCopilotPreferenceState } from './preferenceLearning';
import type { CopilotStateV1 } from './state';

export function createEmptyCopilotState(): CopilotStateV1 {
  return {
    schemaVersion: 1,
    missions: [],
    deferred: [],
    dismissals: [],
    preferences: createEmptyCopilotPreferenceState()
  };
}
