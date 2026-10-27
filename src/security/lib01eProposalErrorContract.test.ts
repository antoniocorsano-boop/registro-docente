import { describe, expect, test } from 'bun:test';
import { handleLibraryProposalRequest } from '../server/libraryProposalRoute';
import { TeachingProposalProviderError } from '../server/teachingProposalProvider';
import { TeachingProposalRuntimeError } from '../server/teachingProposalRuntime';

const VALID_OUTPUT = {
  title: 'Catena energetica',
  objective: 'Riconoscere le trasformazioni di energia.',
  teacherSetup: 'Predisporre la fonte.',
  studentTask: 'Ricostruire la catena energetica.',
  steps: ['Osserva', 'Ricostruisci'],
  questions: ['Quale energia entra?'],
  adaptationHint: 'Usare una tabella guida.'
};

const BASE_REQUEST = {
  schemaVersion: 1,
  action: 'prepare-activity',
  classification: 'TEACHER_PROFESSIONAL',
  explicitTeacherOptIn: true,
  source: {
    id: 'source-lib01e-route',
    kind: 'note',
    title: 'Energia',
    text: 'Una centrale trasforma energia primaria in energia elettrica.'
  },
  context: {
    udaId: 'uda-lib01e-route',
    udaTitle: 'Energia e trasformazioni',
    className: '3C',
    period: 'Q1',
    lessonId: 'lesson-lib01e-route',
    lessonTopic: 'Trasformazioni di energia'
  }
} as const;

const RECEIPT = {
  requestId: 'request-lib01e-route',
  provider: 'google-gemini',
  model: 'gemini-3.8-flash',
  modelVersion: 'gemini-3.8-flash-2026-09',
  providerResponseId: 'response-lib01e-route',
  durationMs: 123,
  promptTokens: 456,
  outputTokens: 123,
  totalTokens: 579,
  attemptCount: 1 as const
};

type Runtime = {
  config: {
    provider: 'gemini';
    model: 'gemini-3.8-flash';
    deadlineMs: number;
    maxTextBytes: number;
    maxInlineBytes: number;
    maxOutputTokens: number;
  };
  generate: (
    input: unknown,
    options?: { signal?: AbortSignal; requestId?: string }
  ) => Promise<{ output: unknown; receipt: typeof RECEIPT }>;
};

function runtimeStub(options: {
  output?: unknown;
  error?: unknown;
  maxTextBytes?: number;
  maxInlineBytes?: number;
} = {}) {
  const calls: Array<{ input: unknown; options: unknown }> = [];
  const runtime: Runtime = {
    config: {
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      deadlineMs: 45_000,
      maxTextBytes: options.maxTextBytes ?? 262_144,
      maxInlineBytes: options.maxInlineBytes ?? 8 * 1024 * 1024,
      maxOutputTokens: 2_048
    },
    async generate(input, callOptions) {
      calls.push({ input, options: callOptions });
      if (options.error) throw options.error;
      return { output: options.output ?? VALID_OUTPUT, receipt: RECEIPT };
    }
  };
  return { runtime, calls };
}

function errorEnvelope(body: Record<string, unknown>) {
  return body.error as Record<string, unknown>;
}

describe('LIB-01E governed proposal route contract', () => {
  test('rejects UTF-8 text above the governed byte budget before runtime invocation', async () => {
    const { runtime, calls } = runtimeStub();
    const body = structuredClone(BASE_REQUEST) as any;
    body.source.text = 'é'.repeat(131_073); // 262,146 UTF-8 bytes.

    const result = await handleLibraryProposalRequest(body, runtime as any, {
      requestId: 'request-too-large'
    } as any);

    expect(result.status).toBe(413);
    expect(errorEnvelope(result.body)).toMatchObject({
      code: 'SOURCE_TOO_LARGE',
      retriable: false
    });
    expect(calls).toHaveLength(0);
  });

  test('preserves the inline-binary ceiling and rejects oversize content before runtime invocation', async () => {
    const { runtime, calls } = runtimeStub({ maxInlineBytes: 4 });
    const body = structuredClone(BASE_REQUEST) as any;
    body.source = {
      id: 'source-image',
      kind: 'image',
      title: 'Schema energetico',
      mimeType: 'image/png',
      dataBase64: 'QUJDREVG' // 6 decoded bytes > test ceiling of 4.
    };

    const result = await handleLibraryProposalRequest(body, runtime as any, {
      requestId: 'request-inline-too-large'
    } as any);

    expect(result.status).toBe(413);
    expect(errorEnvelope(result.body).code).toBe('SOURCE_TOO_LARGE');
    expect(calls).toHaveLength(0);
  });

  test('returns stable policy and invalid-request envelopes', async () => {
    const { runtime } = runtimeStub();
    const denied = structuredClone(BASE_REQUEST) as any;
    denied.classification = 'STUDENT_PERSONAL';
    denied.explicitTeacherOptIn = false;

    const policy = await handleLibraryProposalRequest(denied, runtime as any, {} as any);
    expect(policy.status).toBe(403);
    expect(errorEnvelope(policy.body)).toMatchObject({
      code: 'REMOTE_POLICY_DENIED',
      retriable: false
    });

    const invalid = structuredClone(BASE_REQUEST) as any;
    invalid.provider = 'attacker-controlled-provider';
    const malformed = await handleLibraryProposalRequest(invalid, runtime as any, {} as any);
    expect(malformed.status).toBe(400);
    expect(errorEnvelope(malformed.body)).toMatchObject({
      code: 'REQUEST_INVALID',
      retriable: false
    });
  });

  test('maps known runtime/provider failures to stable HTTP envelopes without raw vendor diagnostics', async () => {
    const scenarios = [
      { error: new TeachingProposalProviderError('not-configured', 'VENDOR SECRET not configured'), status: 503, code: 'PROVIDER_NOT_CONFIGURED', retriable: false },
      { error: new TeachingProposalProviderError('rate-limited', 'VENDOR SECRET quota'), status: 429, code: 'PROVIDER_RATE_LIMITED', retriable: true },
      { error: new TeachingProposalRuntimeError('timeout'), status: 504, code: 'PROVIDER_TIMEOUT', retriable: true },
      { error: new TeachingProposalProviderError('timeout', 'VENDOR SECRET timeout'), status: 504, code: 'PROVIDER_TIMEOUT', retriable: true },
      { error: new TeachingProposalProviderError('blocked', 'VENDOR SECRET safety'), status: 422, code: 'PROVIDER_BLOCKED', retriable: false },
      { error: new TeachingProposalProviderError('unavailable', 'VENDOR SECRET upstream'), status: 503, code: 'PROVIDER_UNAVAILABLE', retriable: true },
      { error: new TeachingProposalProviderError('output-invalid', 'VENDOR SECRET malformed'), status: 502, code: 'PROVIDER_OUTPUT_INVALID', retriable: false },
      { error: new TeachingProposalProviderError('provider-error', 'VENDOR SECRET unknown'), status: 502, code: 'PROVIDER_ERROR', retriable: false }
    ];

    for (const scenario of scenarios) {
      const { runtime, calls } = runtimeStub({ error: scenario.error });
      const result = await handleLibraryProposalRequest(BASE_REQUEST, runtime as any, {
        requestId: `request-${scenario.code}`
      } as any);
      expect(result.status).toBe(scenario.status);
      expect(errorEnvelope(result.body)).toMatchObject({
        code: scenario.code,
        retriable: scenario.retriable
      });
      expect(JSON.stringify(result.body)).not.toContain('VENDOR SECRET');
      expect(calls).toHaveLength(1);
    }
  });

  test('keeps canonical local parsing after provider structured output', async () => {
    const { runtime } = runtimeStub({ output: { ...VALID_OUTPUT, steps: [] } });
    const result = await handleLibraryProposalRequest(BASE_REQUEST, runtime as any, {
      requestId: 'request-invalid-local-parse'
    } as any);

    expect(result.status).toBe(502);
    expect(errorEnvelope(result.body)).toMatchObject({
      code: 'PROVIDER_OUTPUT_INVALID',
      retriable: false
    });
  });

  test('returns proposal plus metadata-only receipt while keeping the persisted proposal contract unchanged', async () => {
    const { runtime, calls } = runtimeStub();
    const result = await handleLibraryProposalRequest(BASE_REQUEST, runtime as any, {
      requestId: 'request-lib01e-route',
      now: () => '2026-10-25T08:15:00.000Z'
    } as any);

    expect(result.status).toBe(200);
    expect(calls).toHaveLength(1);
    const body = result.body as any;
    expect(body.receipt).toEqual({
      ...RECEIPT,
      budget: {
        tier: 'remote-low',
        profile: 'balanced',
        escalated: false
      }
    });
    expect(body.proposal).toMatchObject({
      schemaVersion: 1,
      kind: 'activity',
      sourceId: 'source-lib01e-route',
      context: { udaId: 'uda-lib01e-route', lessonId: 'lesson-lib01e-route' },
      provenance: {
        mode: 'remote',
        provider: 'google-gemini',
        model: 'gemini-3.8-flash',
        generatedAt: '2026-10-25T08:15:00.000Z'
      }
    });
    const serializedProposal = JSON.stringify(body.proposal);
    expect(serializedProposal).not.toContain('request-lib01e-route');
    expect(serializedProposal).not.toContain('promptTokens');
    expect(serializedProposal).not.toContain('providerResponseId');
  });
});