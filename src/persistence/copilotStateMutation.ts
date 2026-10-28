import type { CopilotMissionV1 } from '../copilot/mission';
import type {
  CopilotDeferredOpportunityV1,
  CopilotOpportunityDismissalV1,
  CopilotOpportunityV1
} from '../copilot/opportunityResolver';
import {
  recordCopilotPreferenceSignal,
  resetCopilotPreferences,
  type CopilotPreferenceSignalKind,
  type CopilotPreferenceSignalV1
} from '../copilot/preferenceLearning';
import type { CopilotStateV1 } from '../copilot/state';

export function appendCopilotMission(state: CopilotStateV1, mission: CopilotMissionV1): CopilotStateV1 {
  if (state.missions.some(item => item.id === mission.id)) {
    throw new Error('Missione Copilota duplicata.');
  }
  return { ...state, missions: [...state.missions, mission] };
}

export function updateCopilotMission(
  state: CopilotStateV1,
  missionId: string,
  derive: (mission: CopilotMissionV1) => CopilotMissionV1
): CopilotStateV1 {
  const index = state.missions.findIndex(item => item.id === missionId);
  if (index < 0) throw new Error('Missione Copilota non trovata.');
  const nextMission = derive(state.missions[index]!);
  if (nextMission.id !== missionId) throw new Error('L’identità della missione non può cambiare.');
  return {
    ...state,
    missions: state.missions.map((item, itemIndex) => itemIndex === index ? nextMission : item)
  };
}

export function deferCopilotOpportunity(
  state: CopilotStateV1,
  input: CopilotDeferredOpportunityV1
): CopilotStateV1 {
  const deferred = state.deferred.filter(item => item.opportunity.id !== input.opportunity.id);
  return { ...state, deferred: [...deferred, input] };
}

export function dismissCopilotOpportunity(
  state: CopilotStateV1,
  input: CopilotOpportunityDismissalV1
): CopilotStateV1 {
  const dismissals = state.dismissals.filter(item => !(
    item.opportunityId === input.opportunityId
    && item.contextFingerprint === input.contextFingerprint
  ));
  return { ...state, dismissals: [...dismissals, input] };
}

export function removeDeferredCopilotOpportunity(
  state: CopilotStateV1,
  opportunityId: CopilotOpportunityV1['id']
): CopilotStateV1 {
  return {
    ...state,
    deferred: state.deferred.filter(item => item.opportunity.id !== opportunityId)
  };
}

export function recordCopilotOutcomeSignal(
  state: CopilotStateV1,
  signal: CopilotPreferenceSignalV1
): CopilotStateV1 {
  return {
    ...state,
    preferences: recordCopilotPreferenceSignal(state.preferences, signal)
  };
}

export function resetCopilotStatePreferences(state: CopilotStateV1): CopilotStateV1 {
  return { ...state, preferences: resetCopilotPreferences() };
}

export function archiveCopilotMission(state: CopilotStateV1, missionId: string): CopilotStateV1 {
  return updateCopilotMission(state, missionId, mission => ({ ...mission, status: 'archived' }));
}

export function recordCopilotMissionOutcome(
  state: CopilotStateV1,
  input: {
    missionId: string;
    signal: CopilotPreferenceSignalKind;
    signalId: string;
    occurredAt: string;
  }
): CopilotStateV1 {
  const mission = state.missions.find(item => item.id === input.missionId);
  if (!mission) throw new Error('Missione Copilota non trovata.');

  const lifecycleState = input.signal === 'discarded'
    ? archiveCopilotMission(state, input.missionId)
    : state;

  return recordCopilotOutcomeSignal(lifecycleState, {
    id: input.signalId,
    opportunityKind: mission.kind,
    signal: input.signal,
    occurredAt: input.occurredAt
  });
}
