import type { ResolvedAction } from '@trama/contextual-copilot-core';
import type { IntentEnvelopeV1 } from './agentIntent';
import { resolveLibraryContextActions } from './contextualCoreAdapter';
import type { LibrarySource } from './types';
import type { ResolvedLibraryTeachingContext } from './teachingContext';

export type AgentIntentRoutingResult =
  | { kind: 'ACTION'; action: ResolvedAction; envelope: IntentEnvelopeV1 }
  | { kind: 'PREPARE'; envelope: IntentEnvelopeV1 }
  | { kind: 'CLARIFY'; question: string; envelope: IntentEnvelopeV1 }
  | { kind: 'SOURCE_REQUIRED'; envelope: IntentEnvelopeV1 }
  | { kind: 'UNSUPPORTED'; envelope: IntentEnvelopeV1 }
  | { kind: 'DENIED'; envelope: IntentEnvelopeV1 };

export type AgentIntentRoutingResultWithSource = Exclude<
  AgentIntentRoutingResult,
  { kind: 'SOURCE_REQUIRED' }
>;

export interface RouteAgentIntentInput {
  envelope: IntentEnvelopeV1;
  source: LibrarySource | null;
  teachingContext: ResolvedLibraryTeachingContext | null;
  resolveActions?: (
    source: LibrarySource,
    teachingContext: ResolvedLibraryTeachingContext | null
  ) => Promise<readonly ResolvedAction[]>;
}

export interface RouteAgentIntentWithSourceInput extends Omit<RouteAgentIntentInput, 'source'> {
  source: LibrarySource;
}

const AGENT_TO_ACTION_ID: Partial<Record<IntentEnvelopeV1['intent'], string>> = {
  REVIEW: 'review-source',
  LINK: 'link-source-to-uda'
};

function needsContextBinding(envelope: IntentEnvelopeV1): boolean {
  if (envelope.contextTarget !== 'current') return true;
  return [
    envelope.classReference,
    envelope.udaReference,
    envelope.sourceReference
  ].some(reference => reference !== undefined && reference !== 'current');
}

export function routeAgentIntent(
  input: RouteAgentIntentWithSourceInput
): Promise<AgentIntentRoutingResultWithSource>;
export function routeAgentIntent(
  input: RouteAgentIntentInput
): Promise<AgentIntentRoutingResult>;
export async function routeAgentIntent({
  envelope,
  source,
  teachingContext,
  resolveActions = resolveLibraryContextActions
}: RouteAgentIntentInput): Promise<AgentIntentRoutingResult> {
  if (envelope.needsClarification || envelope.confidence === 'low' || envelope.intent === 'CLARIFY') {
    return {
      kind: 'CLARIFY',
      question: envelope.clarificationQuestion
        ?? 'Puoi specificare meglio che cosa vuoi fare con questa fonte?',
      envelope
    };
  }

  if (needsContextBinding(envelope)) {
    return {
      kind: 'CLARIFY',
      question: 'Hai indicato un contesto specifico. Vuoi usare il contesto corrente oppure selezionare prima quello a cui ti riferisci?',
      envelope
    };
  }

  if (
    !source
    && (
      envelope.intent === 'REVIEW'
      || envelope.intent === 'LINK'
      || envelope.intent === 'PREPARE'
    )
  ) {
    return { kind: 'SOURCE_REQUIRED', envelope };
  }

  if (envelope.intent === 'PREPARE') {
    return teachingContext
      ? { kind: 'PREPARE', envelope }
      : { kind: 'DENIED', envelope };
  }

  const actionId = AGENT_TO_ACTION_ID[envelope.intent];
  if (!actionId) {
    return { kind: 'UNSUPPORTED', envelope };
  }

  if (!source) {
    return { kind: 'SOURCE_REQUIRED', envelope };
  }

  const actions = await resolveActions(source, teachingContext);
  const authorized = actions.find(action => action.id === actionId);
  return authorized
    ? { kind: 'ACTION', action: authorized, envelope }
    : { kind: 'DENIED', envelope };
}
