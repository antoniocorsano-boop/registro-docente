import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { getEmbedding, getEmbeddingsBatch } from '../services/embeddingService';
import type { LocalEmbeddingConfig } from '../types';
import { openEmbeddingSession, revokeEmbeddingSession } from './embeddingSession';

const originalFetch = globalThis.fetch;
const config: LocalEmbeddingConfig = {
  provider: 'gemini', enabled: true, endpointUrl: '',
  modelName: 'synthetic', apiType: 'openai-compatible'
};
const context = { classification: 'INSTITUTIONAL_CURRICULUM' as const, explicitTeacherOptIn: true };
const reply = () => Response.json({ embeddings: [[0.2, 0.8]], model: 'synthetic' });
beforeEach(openEmbeddingSession);
afterEach(() => { revokeEmbeddingSession(); globalThis.fetch = originalFetch; });

describe('R1-01/03 professional embedding generation authority', () => {
  test('does not retain text or vectors across requests; denies admission while locked', async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return reply(); }) as typeof fetch;
    expect(await getEmbedding('Concetto sintetico', config, context)).toEqual([0.2, 0.8]);
    expect(await getEmbedding('Concetto sintetico', config, context)).toEqual([0.2, 0.8]);
    expect(calls).toBe(2);
    revokeEmbeddingSession();
    await expect(getEmbedding('Concetto sintetico', config, context)).rejects.toThrow(/sessione/i);
    expect(calls).toBe(2);
    openEmbeddingSession();
    expect(await getEmbedding('Concetto sintetico', config, context)).toEqual([0.2, 0.8]);
    expect(calls).toBe(3);
  });

  test('late response from revoked generation is rejected even after reauthentication', async () => {
    let resolve!: (value: Response) => void;
    globalThis.fetch = (() => new Promise<Response>(done => { resolve = done; })) as typeof fetch;
    const pending = getEmbedding('Concetto sintetico tardivo', config, context);
    revokeEmbeddingSession();
    openEmbeddingSession();
    resolve(reply());
    await expect(pending).rejects.toThrow(/sessione.*revocata/i);
  });

  test('batch cannot continue in a different generation', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      revokeEmbeddingSession();
      openEmbeddingSession();
      return reply();
    }) as typeof fetch;
    await expect(getEmbeddingsBatch(['A sintetico', 'B sintetico'], config, context)).rejects.toThrow(/sessione/i);
    expect(calls).toBe(1);
  });
});
