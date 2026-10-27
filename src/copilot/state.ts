import type { CopilotMissionV1 } from './mission';
import type {
  CopilotDeferredOpportunityV1,
  CopilotOpportunityDismissalV1
} from './opportunityResolver';
import type { CopilotPreferenceStateV1 } from './preferenceLearning';

export interface CopilotStateV1 {
  schemaVersion: 1;
  missions: CopilotMissionV1[];
  deferred: CopilotDeferredOpportunityV1[];
  dismissals: CopilotOpportunityDismissalV1[];
  preferences: CopilotPreferenceStateV1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every(key => allowed.has(key));
}

const MISSION_STATUSES = new Set(['authorized', 'running', 'suspended', 'ready', 'archived']);
const OPPORTUNITY_SCOPES = new Set(['contextual', 'today', 'later']);
const OPPORTUNITY_KINDS = new Set([
  'prepare-current-lesson',
  'prepare-current-uda',
  'prepare-today-lesson',
  'resume-mission'
]);
const PREFERENCE_SIGNALS = new Set([
  'play', 'put-aside', 'ignore', 'remove', 'used-as-is', 'small-edits', 'heavy-rework',
  'saved-to-library', 'linked-to-uda', 'reused-later', 'discarded', 'abandoned'
]);

function isContextRef(value: unknown): boolean {
  if (!isRecord(value) || !isNonEmptyString(value.className) || !isNonEmptyString(value.udaId)) return false;
  return (value.lessonId === undefined || isNonEmptyString(value.lessonId))
    && (value.sourceId === undefined || isNonEmptyString(value.sourceId));
}

function isMission(value: unknown): value is CopilotMissionV1 {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, [
    'schemaVersion', 'id', 'opportunityId', 'kind', 'goal', 'contextRef', 'sourceRefs',
    'allowedCapabilities', 'expectedOutputs', 'authority', 'budgetProfile', 'createdAt',
    'contextFingerprint', 'semanticExpiry', 'status'
  ])) return false;
  if (value.schemaVersion !== 1
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.opportunityId)
    || !OPPORTUNITY_KINDS.has(String(value.kind))
    || !isNonEmptyString(value.goal)
    || !isContextRef(value.contextRef)
    || !Array.isArray(value.sourceRefs)
    || !value.sourceRefs.every(isNonEmptyString)
    || !Array.isArray(value.allowedCapabilities)
    || !value.allowedCapabilities.every(isNonEmptyString)
    || !Array.isArray(value.expectedOutputs)
    || !isRecord(value.authority)
    || value.authority.persistentProfessionalWrite !== false
    || value.authority.externalAction !== false
    || value.authority.scopeExpansion !== false
    || !['economy', 'balanced', 'quality'].includes(String(value.budgetProfile))
    || !isNonEmptyString(value.createdAt)
    || !Number.isFinite(Date.parse(value.createdAt))
    || !isNonEmptyString(value.contextFingerprint)
    || !isRecord(value.semanticExpiry)
    || !['context', 'date'].includes(String(value.semanticExpiry.kind))
    || !MISSION_STATUSES.has(String(value.status))) return false;

  if (value.semanticExpiry.expiresAt !== undefined
    && (!isNonEmptyString(value.semanticExpiry.expiresAt) || !Number.isFinite(Date.parse(value.semanticExpiry.expiresAt)))) return false;

  return value.expectedOutputs.every(output => (
    isRecord(output)
    && output.kind === 'activity'
    && isNonEmptyString(output.label)
  ));
}

function isOpportunity(value: unknown): boolean {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isNonEmptyString(value.id)
    || !OPPORTUNITY_KINDS.has(String(value.kind))
    || !OPPORTUNITY_SCOPES.has(String(value.scope))
    || !isNonEmptyString(value.title)
    || !isNonEmptyString(value.whyNow)
    || !Array.isArray(value.evidence)
    || !isContextRef(value.contextRef)
    || !isRecord(value.proposedMission)
    || !isRecord(value.rank)
    || !isNonEmptyString(value.createdAt)) return false;

  return value.evidence.every(item => isRecord(item) && isNonEmptyString(item.reason));
}

function isDeferred(value: unknown): boolean {
  return isRecord(value)
    && isOpportunity(value.opportunity)
    && isNonEmptyString(value.contextFingerprint)
    && isNonEmptyString(value.deferredAt)
    && Number.isFinite(Date.parse(value.deferredAt));
}

function isDismissal(value: unknown): boolean {
  return isRecord(value)
    && isNonEmptyString(value.opportunityId)
    && isNonEmptyString(value.contextFingerprint);
}

function isPreferences(value: unknown): value is CopilotPreferenceStateV1 {
  return isRecord(value)
    && value.schemaVersion === 1
    && Array.isArray(value.signals)
    && value.signals.length <= 200
    && value.signals.every(signal => (
      isRecord(signal)
      && isNonEmptyString(signal.id)
      && OPPORTUNITY_KINDS.has(String(signal.opportunityKind))
      && PREFERENCE_SIGNALS.has(String(signal.signal))
      && isNonEmptyString(signal.occurredAt)
      && Number.isFinite(Date.parse(signal.occurredAt))
    ));
}

export function isCopilotStateV1(value: unknown): value is CopilotStateV1 {
  return isRecord(value)
    && hasOnlyKeys(value, ['schemaVersion', 'missions', 'deferred', 'dismissals', 'preferences'])
    && value.schemaVersion === 1
    && Array.isArray(value.missions)
    && value.missions.every(isMission)
    && Array.isArray(value.deferred)
    && value.deferred.every(isDeferred)
    && Array.isArray(value.dismissals)
    && value.dismissals.every(isDismissal)
    && isPreferences(value.preferences);
}

export function normalizeLoadedCopilotState(value: CopilotStateV1): CopilotStateV1 {
  return {
    schemaVersion: 1,
    missions: value.missions.map(mission => ({
      ...mission,
      status: mission.status === 'authorized' || mission.status === 'running'
        ? 'suspended'
        : mission.status
    })),
    deferred: value.deferred.map(item => ({
      ...item,
      opportunity: {
        ...item.opportunity,
        evidence: item.opportunity.evidence.map(evidence => ({ ...evidence })),
        contextRef: { ...item.opportunity.contextRef },
        proposedMission: {
          ...item.opportunity.proposedMission,
          sourceRefs: [...item.opportunity.proposedMission.sourceRefs],
          allowedCapabilities: [...item.opportunity.proposedMission.allowedCapabilities],
          expectedOutputs: item.opportunity.proposedMission.expectedOutputs.map(output => ({ ...output }))
        },
        rank: { ...item.opportunity.rank }
      }
    })),
    dismissals: value.dismissals.map(item => ({ ...item })),
    preferences: {
      schemaVersion: 1,
      signals: value.preferences.signals.map(signal => ({ ...signal }))
    }
  };
}
