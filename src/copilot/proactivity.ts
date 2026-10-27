export type CopilotProactivityProfile = 'essential' | 'balanced' | 'present';

export interface CopilotProactivityPolicy {
  threshold: number;
  primaryLimit: number;
  allowOverflow: boolean;
}

export const COPILOT_PROACTIVITY_POLICIES: Record<CopilotProactivityProfile, CopilotProactivityPolicy> = {
  essential: { threshold: 70, primaryLimit: 2, allowOverflow: false },
  balanced: { threshold: 50, primaryLimit: 3, allowOverflow: false },
  present: { threshold: 35, primaryLimit: 3, allowOverflow: true }
};

export function normalizeCopilotProactivity(value: unknown): CopilotProactivityProfile {
  return value === 'essential' || value === 'present' || value === 'balanced'
    ? value
    : 'balanced';
}
