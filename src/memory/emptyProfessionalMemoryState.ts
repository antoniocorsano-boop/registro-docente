import type { ProfessionalMemoryStateV1 } from './types';

export function createEmptyProfessionalMemoryState(): ProfessionalMemoryStateV1 {
  return {
    schemaVersion: 1,
    events: [],
    entries: [],
    settings: {
      autoRemember: {
        'format-preference': false,
        'didactic-pattern': false,
        'material-reuse': false,
        'planning-continuity': false,
        'workflow-preference': false
      }
    }
  };
}
