import type { CopilotOpportunityKind } from './opportunityResolver';

export type CopilotPreferenceSignalKind =
  | 'play'
  | 'put-aside'
  | 'ignore'
  | 'remove'
  | 'used-as-is'
  | 'small-edits'
  | 'heavy-rework'
  | 'saved-to-library'
  | 'linked-to-uda'
  | 'reused-later'
  | 'discarded'
  | 'abandoned';

export interface CopilotPreferenceSignalV1 {
  id: string;
  opportunityKind: CopilotOpportunityKind;
  signal: CopilotPreferenceSignalKind;
  occurredAt: string;
}

export interface CopilotPreferenceStateV1 {
  schemaVersion: 1;
  signals: CopilotPreferenceSignalV1[];
}

const SIGNAL_WEIGHTS: Record<CopilotPreferenceSignalKind, number> = {
  play: 2,
  'put-aside': 0.5,
  ignore: -1,
  remove: -2,
  'used-as-is': 3,
  'small-edits': 2,
  'heavy-rework': 0.5,
  'saved-to-library': 3,
  'linked-to-uda': 3,
  'reused-later': 3,
  discarded: -3,
  abandoned: -1.5
};

const HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SIGNALS = 200;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function timestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createEmptyCopilotPreferenceState(): CopilotPreferenceStateV1 {
  return { schemaVersion: 1, signals: [] };
}

export function resetCopilotPreferences(): CopilotPreferenceStateV1 {
  return createEmptyCopilotPreferenceState();
}

export function recordCopilotPreferenceSignal(
  state: CopilotPreferenceStateV1,
  input: CopilotPreferenceSignalV1
): CopilotPreferenceStateV1 {
  const next = [...state.signals, { ...input }]
    .sort((left, right) => {
      const leftAt = timestamp(left.occurredAt) ?? Number.NEGATIVE_INFINITY;
      const rightAt = timestamp(right.occurredAt) ?? Number.NEGATIVE_INFINITY;
      if (leftAt !== rightAt) return leftAt - rightAt;
      return left.id.localeCompare(right.id, 'it');
    })
    .slice(-MAX_SIGNALS);

  return { schemaVersion: 1, signals: next };
}

export function copilotPreferenceFactor(
  state: CopilotPreferenceStateV1,
  opportunityKind: CopilotOpportunityKind,
  now: string
): number {
  const nowMs = timestamp(now);
  if (nowMs === null) return 50;

  const raw = state.signals.reduce((total, signal) => {
    if (signal.opportunityKind !== opportunityKind) return total;
    const occurredAt = timestamp(signal.occurredAt);
    if (occurredAt === null) return total;
    const ageMs = Math.max(0, nowMs - occurredAt);
    const decay = Math.pow(0.5, ageMs / HALF_LIFE_MS);
    return total + SIGNAL_WEIGHTS[signal.signal] * decay;
  }, 0);

  return clamp(50 + raw * 5);
}
