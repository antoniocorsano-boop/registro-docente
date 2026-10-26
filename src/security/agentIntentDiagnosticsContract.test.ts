import { afterEach, describe, expect, test } from 'bun:test';
import { buildAgentRoutingRequest } from '../library/agentIntent';
import {
  AgentIntentClientError,
  interpretCopilotIntent
} from '../services/agentIntentService';

const request = buildAgentRoutingRequest({
  message: 'Preparazione Attività per fare comprendere il funzionamento della centrale elettrica',
  surface: 'library',
  hasCurrentClass: true,
  hasCurrentUda: true,
  hasSelectedSource: true
});

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('AGENT-INTENT-02 safe diagnostics contract', () => {
  test('preserves only stable server failure code and retriable flag for local fallback diagnostics', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({
          available: true,
          provider: 'Google Gemini',
          model: 'gemini-3.8-flash'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        error: {
          code: 'PROVIDER_OUTPUT_INVALID',
          message: 'Il Copilota non ha restituito un’interpretazione valida.',
          retriable: false
        }
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    try {
      await interpretCopilotIntent(request);
      throw new Error('expected interpretCopilotIntent to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AgentIntentClientError);
      expect((error as AgentIntentClientError).code).toBe('REQUEST_FAILED');
      expect((error as any).routeCode).toBe('PROVIDER_OUTPUT_INVALID');
      expect((error as any).retriable).toBe(false);
      expect((error as Error).message).not.toContain('Gemini');
      expect((error as Error).message).not.toContain('Il Copilota non ha restituito');
    }
  });

  test('does not promote unknown server diagnostics into the allowlisted route code', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ available: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        error: {
          code: 'RAW_VENDOR_ERROR',
          message: 'upstream secret-ish detail',
          retriable: true
        }
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    try {
      await interpretCopilotIntent(request);
      throw new Error('expected interpretCopilotIntent to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AgentIntentClientError);
      expect((error as any).routeCode).toBeUndefined();
      expect((error as Error).message).not.toContain('RAW_VENDOR_ERROR');
      expect((error as Error).message).not.toContain('upstream secret-ish detail');
    }
  });

  test('exposes the allowlisted fallback code only as a non-visible Composer data attribute', async () => {
    const composer = await Bun.file('src/components/LibraryCopilotComposer.tsx').text();
    expect(composer).toContain('AgentIntentClientError');
    expect(composer).toContain('data-agent-intent-fallback-code');
    expect(composer).toContain('error instanceof AgentIntentClientError');
    expect(composer).not.toContain('PROVIDER_OUTPUT_INVALID</');
    expect(composer).not.toContain('PROVIDER_TIMEOUT</');
  });
});
