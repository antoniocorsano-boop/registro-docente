import { describe, expect, test } from 'bun:test';
import { buildAgentRoutingRequest } from '../library/agentIntent';
import { handleAgentIntentRequest } from '../server/agentIntentRoute';
import {
  createAgentIntentRuntime,
  resolveAgentIntentRuntimeConfig,
  type AgentIntentRuntime
} from '../server/agentIntentRuntime';
import {
  AgentIntentProviderError,
  type GovernedAgentIntentProvider
} from '../server/agentIntentProvider';
import { createGeminiAgentIntentProvider } from '../server/geminiAgentIntentProvider';

const request = buildAgentRoutingRequest({
  message: 'Preparazione Attività per fare comprendere il funzionamento della centrale elettrica',
  surface: 'uda',
  hasCurrentClass: true,
  hasCurrentUda: true,
  hasSelectedSource: true
});

const prepareEnvelope = {
  schema: 'registro.agent-intent/v1' as const,
  intent: 'PREPARE' as const,
  goal: 'far comprendere il funzionamento della centrale elettrica',
  requestedArtifact: 'attività didattica',
  contextTarget: 'current' as const,
  classReference: 'current',
  udaReference: 'current',
  sourceReference: 'current',
  confidence: 'high' as const,
  needsClarification: false
};

function fakeRuntime(output: unknown): AgentIntentRuntime {
  return {
    config: resolveAgentIntentRuntimeConfig({}),
    interpret: async () => ({
      output,
      receipt: {
        requestId: 'intent-test',
        provider: 'fake',
        model: 'fake-model',
        durationMs: 1,
        attemptCount: 1
      }
    })
  };
}

describe('AGENT-INTENT-01 governed server boundary', () => {
  test('accepts only the minimized teacher-submitted routing request', async () => {
    const success = await handleAgentIntentRequest(request, fakeRuntime(prepareEnvelope));
    expect(success.status).toBe(200);
    expect(success.body).toEqual({ intent: prepareEnvelope });

    let calls = 0;
    const runtime: AgentIntentRuntime = {
      ...fakeRuntime(prepareEnvelope),
      interpret: async () => {
        calls += 1;
        return fakeRuntime(prepareEnvelope).interpret(request);
      }
    };
    const rejected = await handleAgentIntentRequest({
      ...request,
      sourceText: 'contenuto che non deve uscire'
    }, runtime);
    expect(rejected.status).toBe(400);
    expect(calls).toBe(0);
  });

  test('fails closed before the provider when explicit teacher submission is absent', async () => {
    let calls = 0;
    const runtime: AgentIntentRuntime = {
      ...fakeRuntime(prepareEnvelope),
      interpret: async () => {
        calls += 1;
        return fakeRuntime(prepareEnvelope).interpret(request);
      }
    };
    const rejected = await handleAgentIntentRequest({
      ...request,
      explicitTeacherSubmission: false
    }, runtime);
    expect(rejected.status).toBe(400);
    expect(calls).toBe(0);
  });

  test('rejects malformed provider output without exposing a partial intent', async () => {
    const result = await handleAgentIntentRequest(request, fakeRuntime({
      ...prepareEnvelope,
      authorized: true
    }));
    expect(result.status).toBe(502);
    expect(result.body).toEqual({
      error: {
        code: 'PROVIDER_OUTPUT_INVALID',
        message: 'Il Copilota non ha restituito un’interpretazione valida.',
        retriable: false
      }
    });
  });

  test('normalizes provider failures without raw vendor diagnostics', async () => {
    const runtime: AgentIntentRuntime = {
      config: resolveAgentIntentRuntimeConfig({}),
      interpret: async () => {
        throw new AgentIntentProviderError('rate-limited');
      }
    };
    const result = await handleAgentIntentRequest(request, runtime);
    expect(result.status).toBe(429);
    expect(JSON.stringify(result.body)).not.toContain('Agent intent provider failure');
    expect(JSON.stringify(result.body)).not.toContain('Gemini');
  });

  test('runtime performs exactly one provider attempt and uses a small bounded configuration', async () => {
    let calls = 0;
    const provider: GovernedAgentIntentProvider = {
      descriptor: { id: 'fake', displayName: 'Fake', model: 'gemini-3.8-flash' },
      generate: async () => {
        calls += 1;
        return { output: prepareEnvelope, metadata: {} };
      }
    };
    const config = resolveAgentIntentRuntimeConfig({ AGENT_INTENT_TIMEOUT_MS: '10000' });
    expect(config.maxOutputTokens).toBeLessThanOrEqual(512);
    expect(config.deadlineMs).toBe(10_000);
    const runtime = createAgentIntentRuntime(config, provider);
    const result = await runtime.interpret(request, { requestId: 'one-attempt' });
    expect(result.output).toEqual(prepareEnvelope);
    expect(result.receipt.attemptCount).toBe(1);
    expect(calls).toBe(1);
  });

  test('Gemini adapter receives only minimized routing data and structured no-tool settings', async () => {
    let captured: Record<string, any> | null = null;
    const provider = createGeminiAgentIntentProvider({
      apiKey: 'test-key',
      clientFactory: () => ({
        models: {
          generateContent: async (input: Record<string, unknown>) => {
            captured = input as Record<string, any>;
            return { text: JSON.stringify(prepareEnvelope) };
          }
        }
      })
    });

    const result = await provider.generate(request, {
      requestId: 'structured',
      signal: new AbortController().signal,
      maxOutputTokens: 512
    });
    expect(result.output).toEqual(prepareEnvelope);
    expect(captured).not.toBeNull();
    expect(captured?.model).toBe('gemini-3.8-flash');
    expect(captured?.config?.responseMimeType).toBe('application/json');
    expect(captured?.config?.candidateCount).toBe(1);
    expect(captured?.config?.maxOutputTokens).toBe(512);
    expect(captured?.config?.tools).toBeUndefined();
    const serialized = JSON.stringify(captured);
    expect(serialized).toContain(request.message);
    for (const forbidden of ['sourceText', 'extractedText', 'studentName', 'dataBase64', 'attachment']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
