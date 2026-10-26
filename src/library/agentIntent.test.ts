import { describe, expect, test } from 'bun:test';
import { buildCopilotContextProjection } from '../copilot/contextProjection';
import { AGENT_INTENT_REFERENCE_CORPUS } from './fixtures/agentIntentReferenceCorpus';

const MODULE = new URL('./agentIntent.ts', import.meta.url);

describe('AGENT-INTENT-01 contract', () => {
  test('materializes the approved structured intent contract', async () => {
    expect(await Bun.file(MODULE).exists()).toBe(true);
    if (!await Bun.file(MODULE).exists()) return;

    const module = await import('./agentIntent') as Record<string, unknown>;
    expect(typeof module.parseIntentEnvelopeV1).toBe('function');
    expect(typeof module.parseAgentRoutingRequestV1).toBe('function');
    expect(typeof module.buildAgentRoutingRequest).toBe('function');
    expect(typeof module.buildAgentRoutingRequestFromProjection).toBe('function');
  });

  test('accepts the real PREPARE envelope but rejects authority-bearing extras', async () => {
    if (!await Bun.file(MODULE).exists()) {
      expect(await Bun.file(MODULE).exists()).toBe(true);
      return;
    }
    const { parseIntentEnvelopeV1 } = await import('./agentIntent');
    const valid = {
      schema: 'registro.agent-intent/v1',
      intent: 'PREPARE',
      goal: 'far comprendere il funzionamento della centrale elettrica',
      requestedArtifact: 'attività didattica',
      contextTarget: 'current',
      classReference: 'current',
      udaReference: 'current',
      sourceReference: 'current',
      confidence: 'high',
      needsClarification: false
    };
    expect(parseIntentEnvelopeV1(valid)).toEqual(valid);
    expect(() => parseIntentEnvelopeV1({ ...valid, authorized: true })).toThrow();
    expect(() => parseIntentEnvelopeV1({ ...valid, dispatch: 'NOW' })).toThrow();
    expect(() => parseIntentEnvelopeV1({ ...valid, intent: 'DELETE' })).toThrow();
  });

  test('requires clarification semantics when confidence is low', async () => {
    if (!await Bun.file(MODULE).exists()) {
      expect(await Bun.file(MODULE).exists()).toBe(true);
      return;
    }
    const { parseIntentEnvelopeV1 } = await import('./agentIntent');
    expect(() => parseIntentEnvelopeV1({
      schema: 'registro.agent-intent/v1',
      intent: 'PREPARE',
      goal: 'fare qualcosa con la fonte',
      contextTarget: 'current',
      confidence: 'low',
      needsClarification: false
    })).toThrow();

    const clarify = parseIntentEnvelopeV1({
      schema: 'registro.agent-intent/v1',
      intent: 'CLARIFY',
      goal: 'capire se collegare o preparare',
      contextTarget: 'current',
      confidence: 'low',
      needsClarification: true,
      clarificationQuestion: 'Vuoi collegare la fonte o preparare una nuova attività?'
    });
    expect(clarify.intent).toBe('CLARIFY');
  });

  test('builds a minimized routing request and strips product/source payloads by construction', async () => {
    if (!await Bun.file(MODULE).exists()) {
      expect(await Bun.file(MODULE).exists()).toBe(true);
      return;
    }
    const { buildAgentRoutingRequest, parseAgentRoutingRequestV1 } = await import('./agentIntent');
    const request = buildAgentRoutingRequest({
      message: 'Preparazione Attività per fare comprendere il funzionamento della centrale elettrica',
      surface: 'uda',
      hasCurrentClass: true,
      hasCurrentUda: true,
      hasSelectedSource: true
    });

    expect(request).toEqual({
      schema: 'registro.agent-routing-request/v1',
      message: 'Preparazione Attività per fare comprendere il funzionamento della centrale elettrica',
      context: {
        surface: 'uda',
        hasCurrentClass: true,
        hasCurrentUda: true,
        hasSelectedSource: true
      },
      explicitTeacherSubmission: true
    });

    const serialized = JSON.stringify(request);
    for (const forbidden of ['sourceText', 'extractedText', 'studentName', 'grades', 'attachment', 'udaContent']) {
      expect(serialized).not.toContain(forbidden);
    }

    expect(() => parseAgentRoutingRequestV1({
      ...request,
      sourceText: 'NON DEVE USCIRE'
    })).toThrow();
  });

  test('derives the legacy routing wire contract from the unified local projection', async () => {
    const module = await import('./agentIntent') as Record<string, unknown>;
    expect(typeof module.buildAgentRoutingRequestFromProjection).toBe('function');
    if (typeof module.buildAgentRoutingRequestFromProjection !== 'function') return;

    const context = buildCopilotContextProjection({
      surface: 'planning',
      className: '3C',
      udaId: 'uda-energia',
      sourceId: 'source-1',
      planningProfileId: 'planning-2026-27'
    });
    const buildRequest = module.buildAgentRoutingRequestFromProjection as (
      message: string,
      context: typeof context
    ) => unknown;

    expect(buildRequest('Rivedi questa fonte', context)).toEqual({
      schema: 'registro.agent-routing-request/v1',
      message: 'Rivedi questa fonte',
      context: {
        surface: 'planning',
        hasCurrentClass: true,
        hasCurrentUda: true,
        hasSelectedSource: true
      },
      explicitTeacherSubmission: true
    });
  });

  test('freezes a realistic corpus including the production finding', () => {
    expect(AGENT_INTENT_REFERENCE_CORPUS.length).toBeGreaterThanOrEqual(30);
    const real = AGENT_INTENT_REFERENCE_CORPUS.find(item => item.id === 'prepare-real-01');
    expect(real).toEqual({
      id: 'prepare-real-01',
      utterance: 'Preparazione Attività per fare comprendere il funzionamento della centrale elettrica',
      expected: 'PREPARE',
      class: 'nominal'
    });
    expect(AGENT_INTENT_REFERENCE_CORPUS.some(item => item.expected === 'CLARIFY')).toBe(true);
    expect(AGENT_INTENT_REFERENCE_CORPUS.some(item => item.expected === 'UNSUPPORTED')).toBe(true);
  });
});
