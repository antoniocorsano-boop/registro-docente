import {
  toRemoteRoutingProjection,
  type CopilotContextProjectionV1
} from '../copilot/contextProjection';

export type AgentIntentId =
  | 'REVIEW'
  | 'LINK'
  | 'PREPARE'
  | 'ADAPT'
  | 'SIMPLIFY'
  | 'COMPARE'
  | 'CREATE_MATERIAL'
  | 'CREATE_ASSESSMENT'
  | 'RETRIEVE_LIBRARY'
  | 'ANSWER'
  | 'CLARIFY'
  | 'UNSUPPORTED';

export type AgentIntentConfidence = 'high' | 'medium' | 'low';
export type AgentIntentContextTarget = 'current' | 'explicit' | 'unknown';
export type AgentRoutingSurface =
  | 'home'
  | 'class-dashboard'
  | 'library'
  | 'uda'
  | 'lesson'
  | 'planning'
  | 'other-teacher-surface';

export interface IntentEnvelopeV1 {
  schema: 'registro.agent-intent/v1';
  intent: AgentIntentId;
  goal: string;
  requestedArtifact?: string;
  contextTarget: AgentIntentContextTarget;
  classReference?: 'current' | string;
  udaReference?: 'current' | string;
  sourceReference?: 'current' | string | 'none';
  confidence: AgentIntentConfidence;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export interface AgentRoutingContextV1 {
  surface: AgentRoutingSurface;
  hasCurrentClass: boolean;
  hasCurrentUda: boolean;
  hasSelectedSource: boolean;
}

export interface AgentRoutingRequestV1 {
  schema: 'registro.agent-routing-request/v1';
  message: string;
  context: AgentRoutingContextV1;
  explicitTeacherSubmission: true;
}

export interface BuildAgentRoutingRequestInput extends AgentRoutingContextV1 {
  message: string;
}

const AGENT_INTENTS = new Set<AgentIntentId>([
  'REVIEW',
  'LINK',
  'PREPARE',
  'ADAPT',
  'SIMPLIFY',
  'COMPARE',
  'CREATE_MATERIAL',
  'CREATE_ASSESSMENT',
  'RETRIEVE_LIBRARY',
  'ANSWER',
  'CLARIFY',
  'UNSUPPORTED'
]);
const CONFIDENCES = new Set<AgentIntentConfidence>(['high', 'medium', 'low']);
const CONTEXT_TARGETS = new Set<AgentIntentContextTarget>(['current', 'explicit', 'unknown']);
const SURFACES = new Set<AgentRoutingSurface>([
  'home',
  'class-dashboard',
  'library',
  'uda',
  'lesson',
  'planning',
  'other-teacher-surface'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(record: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  const extra = Object.keys(record).find(key => !allowedSet.has(key));
  if (extra) throw new TypeError(`${label} contains unsupported field: ${extra}`);
}

function requiredString(value: unknown, label: string, maxLength = 2_000): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new TypeError(`${label} is invalid`);
  return normalized;
}

function optionalString(value: unknown, label: string, maxLength = 500): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, label, maxLength);
}

export function parseIntentEnvelopeV1(value: unknown): IntentEnvelopeV1 {
  if (!isRecord(value)) throw new TypeError('intent envelope must be an object');
  assertExactKeys(value, [
    'schema',
    'intent',
    'goal',
    'requestedArtifact',
    'contextTarget',
    'classReference',
    'udaReference',
    'sourceReference',
    'confidence',
    'needsClarification',
    'clarificationQuestion'
  ], 'intent envelope');

  if (value.schema !== 'registro.agent-intent/v1') throw new TypeError('unsupported intent envelope schema');
  if (typeof value.intent !== 'string' || !AGENT_INTENTS.has(value.intent as AgentIntentId)) {
    throw new TypeError('unsupported agent intent');
  }
  if (typeof value.contextTarget !== 'string' || !CONTEXT_TARGETS.has(value.contextTarget as AgentIntentContextTarget)) {
    throw new TypeError('invalid context target');
  }
  if (typeof value.confidence !== 'string' || !CONFIDENCES.has(value.confidence as AgentIntentConfidence)) {
    throw new TypeError('invalid confidence');
  }
  if (typeof value.needsClarification !== 'boolean') throw new TypeError('needsClarification must be boolean');

  const intent = value.intent as AgentIntentId;
  const confidence = value.confidence as AgentIntentConfidence;
  const needsClarification = value.needsClarification;
  const clarificationQuestion = optionalString(value.clarificationQuestion, 'clarificationQuestion');

  if (confidence === 'low' && !needsClarification) {
    throw new TypeError('low-confidence intent must require clarification');
  }
  if (intent === 'CLARIFY' && (!needsClarification || !clarificationQuestion)) {
    throw new TypeError('CLARIFY requires a clarification question');
  }
  if (needsClarification && !clarificationQuestion) {
    throw new TypeError('clarificationQuestion is required when clarification is needed');
  }

  const envelope: IntentEnvelopeV1 = {
    schema: 'registro.agent-intent/v1',
    intent,
    goal: requiredString(value.goal, 'goal'),
    contextTarget: value.contextTarget as AgentIntentContextTarget,
    confidence,
    needsClarification
  };

  const requestedArtifact = optionalString(value.requestedArtifact, 'requestedArtifact');
  const classReference = optionalString(value.classReference, 'classReference');
  const udaReference = optionalString(value.udaReference, 'udaReference');
  const sourceReference = optionalString(value.sourceReference, 'sourceReference');
  if (requestedArtifact) envelope.requestedArtifact = requestedArtifact;
  if (classReference) envelope.classReference = classReference;
  if (udaReference) envelope.udaReference = udaReference;
  if (sourceReference) envelope.sourceReference = sourceReference;
  if (clarificationQuestion) envelope.clarificationQuestion = clarificationQuestion;
  return envelope;
}

export function parseAgentRoutingRequestV1(value: unknown): AgentRoutingRequestV1 {
  if (!isRecord(value)) throw new TypeError('agent routing request must be an object');
  assertExactKeys(value, ['schema', 'message', 'context', 'explicitTeacherSubmission'], 'agent routing request');
  if (value.schema !== 'registro.agent-routing-request/v1') throw new TypeError('unsupported routing request schema');
  if (value.explicitTeacherSubmission !== true) throw new TypeError('explicit teacher submission is required');
  if (!isRecord(value.context)) throw new TypeError('routing context must be an object');
  assertExactKeys(value.context, ['surface', 'hasCurrentClass', 'hasCurrentUda', 'hasSelectedSource'], 'routing context');
  if (typeof value.context.surface !== 'string' || !SURFACES.has(value.context.surface as AgentRoutingSurface)) {
    throw new TypeError('unsupported routing surface');
  }
  for (const key of ['hasCurrentClass', 'hasCurrentUda', 'hasSelectedSource'] as const) {
    if (typeof value.context[key] !== 'boolean') throw new TypeError(`${key} must be boolean`);
  }

  return {
    schema: 'registro.agent-routing-request/v1',
    message: requiredString(value.message, 'message', 4_000),
    context: {
      surface: value.context.surface as AgentRoutingSurface,
      hasCurrentClass: value.context.hasCurrentClass as boolean,
      hasCurrentUda: value.context.hasCurrentUda as boolean,
      hasSelectedSource: value.context.hasSelectedSource as boolean
    },
    explicitTeacherSubmission: true
  };
}

export function buildAgentRoutingRequest(input: BuildAgentRoutingRequestInput): AgentRoutingRequestV1 {
  return parseAgentRoutingRequestV1({
    schema: 'registro.agent-routing-request/v1',
    message: input.message,
    context: {
      surface: input.surface,
      hasCurrentClass: input.hasCurrentClass,
      hasCurrentUda: input.hasCurrentUda,
      hasSelectedSource: input.hasSelectedSource
    },
    explicitTeacherSubmission: true
  });
}

export function buildAgentRoutingRequestFromProjection(
  message: string,
  context: CopilotContextProjectionV1
): AgentRoutingRequestV1 {
  return buildAgentRoutingRequest({
    message,
    ...toRemoteRoutingProjection(context)
  });
}
