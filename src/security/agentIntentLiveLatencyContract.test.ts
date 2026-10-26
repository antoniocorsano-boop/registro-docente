import { describe, expect, test } from 'bun:test';
import { resolveAgentIntentRuntimeConfig } from '../server/agentIntentRuntime';

describe('AGENT-INTENT-01 live latency budget', () => {
  test('default provider deadline leaves bounded headroom beyond the observed 10s live timeout', () => {
    const config = resolveAgentIntentRuntimeConfig({});

    expect(config.deadlineMs).toBeGreaterThanOrEqual(20_000);
    expect(config.deadlineMs).toBeLessThanOrEqual(30_000);
    expect(config.maxOutputTokens).toBeLessThanOrEqual(512);
  });

  test('an explicit governed timeout remains honored inside the existing safety bounds', () => {
    expect(resolveAgentIntentRuntimeConfig({ AGENT_INTENT_TIMEOUT_MS: '10000' }).deadlineMs).toBe(10_000);
    expect(resolveAgentIntentRuntimeConfig({ AGENT_INTENT_TIMEOUT_MS: '30000' }).deadlineMs).toBe(30_000);
  });
});
