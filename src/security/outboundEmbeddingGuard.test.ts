import { afterEach, describe, expect, test } from 'bun:test';
import { getEmbedding } from '../services/embeddingService';
import type { LocalEmbeddingConfig } from '../types';
import type { DataClassification } from './dataClassification';

type EmbeddingDataContext = {
  classification: DataClassification;
  explicitTeacherOptIn?: boolean;
};

type GuardedGetEmbedding = (
  text: string,
  config: LocalEmbeddingConfig,
  context: EmbeddingDataContext
) => Promise<number[]>;

const guardedGetEmbedding = getEmbedding as unknown as GuardedGetEmbedding;
const originalFetch = globalThis.fetch;

const GEMINI_CONFIG: LocalEmbeddingConfig = {
  provider: 'gemini',
  endpointUrl: '',
  modelName: 'text-embedding-004',
  apiType: 'openai-compatible',
  enabled: true
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function installSuccessfulEmbeddingFetch() {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(
      JSON.stringify({ embeddings: [[0.25, 0.75]], model: 'text-embedding-004' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;
  return calls;
}

describe('SEC-2 runtime outbound embedding guard', () => {
  test('blocks STUDENT_PERSONAL before any Gemini network request even with opt-in', async () => {
    const calls = installSuccessfulEmbeddingFetch();

    await expect(
      guardedGetEmbedding('Studente Mario Rossi, classe 3C', GEMINI_CONFIG, {
        classification: 'STUDENT_PERSONAL',
        explicitTeacherOptIn: true
      })
    ).rejects.toThrow(/flusso dati.*non consentito/i);

    expect(calls).toHaveLength(0);
  });

  test('blocks non-sensitive Gemini traffic without explicit teacher opt-in', async () => {
    const calls = installSuccessfulEmbeddingFetch();

    await expect(
      guardedGetEmbedding('Progettazione di una UDA di tecnologia', GEMINI_CONFIG, {
        classification: 'TEACHER_PROFESSIONAL'
      })
    ).rejects.toThrow(/flusso dati.*non consentito/i);

    expect(calls).toHaveLength(0);
  });

  test('forwards classification and explicit opt-in when Gemini traffic is allowed', async () => {
    const calls = installSuccessfulEmbeddingFetch();

    const vector = await guardedGetEmbedding(
      'Traguardi di competenza per tecnologia',
      GEMINI_CONFIG,
      {
        classification: 'INSTITUTIONAL_CURRICULUM',
        explicitTeacherOptIn: true
      }
    );

    expect(vector).toEqual([0.25, 0.75]);
    expect(calls).toHaveLength(1);

    const payload = JSON.parse(String(calls[0].init?.body));
    expect(payload.classification).toBe('INSTITUTIONAL_CURRICULUM');
    expect(payload.explicitTeacherOptIn).toBe(true);
  });

  test('wires the same deny-by-default policy into the server Gemini boundary', async () => {
    const serverSource = await Bun.file('server.ts').text();

    expect(serverSource).toContain('evaluateDataFlow');
    expect(serverSource).toContain('classification');
    expect(serverSource).toContain('explicitTeacherOptIn');
    expect(serverSource).toContain('REMOTE_PROVIDER');
    expect(serverSource).toContain('status(403)');
  });
});
