import { describe, expect, test } from 'bun:test';

const PROVIDER_INPUT = {
  source: {
    id: 'source-lib01e-runtime',
    kind: 'note',
    title: 'Energia e trasformazioni',
    text: 'Una centrale trasforma energia primaria in energia elettrica.'
  },
  context: {
    udaId: 'uda-lib01e-runtime',
    udaTitle: 'Energia',
    className: '3C',
    period: 'Q1',
    lessonId: 'lesson-lib01e-runtime',
    lessonTopic: 'Trasformazioni di energia'
  }
};

type ProviderCallContext = {
  requestId: string;
  signal: AbortSignal;
  maxOutputTokens: number;
};

type Provider = {
  descriptor: {
    id: string;
    displayName: string;
    model: string;
  };
  generate(
    input: typeof PROVIDER_INPUT,
    context: ProviderCallContext
  ): Promise<{
    output: unknown;
    metadata: {
      providerResponseId?: string;
      modelVersion?: string;
      promptTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
  }>;
};

type RuntimeConfig = {
  provider: 'gemini';
  model: 'gemini-3.8-flash';
  deadlineMs: number;
  maxTextBytes: number;
  maxInlineBytes: number;
  maxOutputTokens: number;
};

type RuntimeModule = {
  resolveTeachingProposalRuntimeConfig: (
    env?: Record<string, string | undefined>
  ) => RuntimeConfig;
  createTeachingProposalRuntime: (
    config: RuntimeConfig,
    provider: Provider
  ) => {
    generate: (
      input: typeof PROVIDER_INPUT,
      options?: { signal?: AbortSignal; requestId?: string }
    ) => Promise<{
      output: unknown;
      receipt: Record<string, unknown>;
    }>;
  };
};

async function loadRuntimeModule(): Promise<{ module: RuntimeModule | null; error: unknown }> {
  try {
    const module = await import('../server/teachingProposalRuntime');
    return { module: module as RuntimeModule, error: null };
  } catch (error) {
    return { module: null, error };
  }
}

function fakeProvider(
  generate?: Provider['generate']
): { provider: Provider; calls: Array<{ input: typeof PROVIDER_INPUT; context: ProviderCallContext }> } {
  const calls: Array<{ input: typeof PROVIDER_INPUT; context: ProviderCallContext }> = [];
  const provider: Provider = {
    descriptor: {
      id: 'fake-provider',
      displayName: 'Fake Provider',
      model: 'fake-model-v1'
    },
    async generate(input, context) {
      calls.push({ input, context });
      if (generate) return generate(input, context);
      return {
        output: { title: 'Proposta sintetica' },
        metadata: {
          providerResponseId: 'provider-response-1',
          modelVersion: 'fake-model-v1.2',
          promptTokens: 321,
          outputTokens: 123,
          totalTokens: 444
        }
      };
    }
  };
  return { provider, calls };
}

function errorCode(reason: unknown): string | undefined {
  if (!reason || typeof reason !== 'object') return undefined;
  return (reason as Record<string, unknown>).code as string | undefined;
}

describe('LIB-01E governed provider runtime contract', () => {
  test('materializes a provider-neutral runtime before any Gemini-specific hardening', async () => {
    const loaded = await loadRuntimeModule();
    expect(loaded.error).toBeNull();
    expect(typeof loaded.module?.resolveTeachingProposalRuntimeConfig).toBe('function');
    expect(typeof loaded.module?.createTeachingProposalRuntime).toBe('function');
  });

  test('uses canonical defaults and falls back when timeout env is outside the governed range', async () => {
    const loaded = await loadRuntimeModule();
    if (!loaded.module) return;

    const defaults = loaded.module.resolveTeachingProposalRuntimeConfig({});
    expect(defaults).toEqual({
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      deadlineMs: 45_000,
      maxTextBytes: 262_144,
      maxInlineBytes: 8 * 1024 * 1024,
      maxOutputTokens: 2_048
    });

    expect(
      loaded.module.resolveTeachingProposalRuntimeConfig({ LIBRARY_PROPOSAL_TIMEOUT_MS: '4999' }).deadlineMs
    ).toBe(45_000);
    expect(
      loaded.module.resolveTeachingProposalRuntimeConfig({ LIBRARY_PROPOSAL_TIMEOUT_MS: '120001' }).deadlineMs
    ).toBe(45_000);
    expect(
      loaded.module.resolveTeachingProposalRuntimeConfig({ LIBRARY_PROPOSAL_TIMEOUT_MS: '60000' }).deadlineMs
    ).toBe(60_000);
  });

  test('calls the provider exactly once and returns an allowlisted metadata-only receipt', async () => {
    const loaded = await loadRuntimeModule();
    if (!loaded.module) return;

    const config = loaded.module.resolveTeachingProposalRuntimeConfig({});
    const { provider, calls } = fakeProvider();
    const runtime = loaded.module.createTeachingProposalRuntime(config, provider);
    const result = await runtime.generate(PROVIDER_INPUT, { requestId: 'request-lib01e-1' });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.context.requestId).toBe('request-lib01e-1');
    expect(calls[0]?.context.maxOutputTokens).toBe(2_048);
    expect(result.output).toEqual({ title: 'Proposta sintetica' });
    expect(result.receipt).toMatchObject({
      requestId: 'request-lib01e-1',
      provider: 'fake-provider',
      model: 'fake-model-v1',
      modelVersion: 'fake-model-v1.2',
      providerResponseId: 'provider-response-1',
      promptTokens: 321,
      outputTokens: 123,
      totalTokens: 444,
      attemptCount: 1
    });
    expect(typeof result.receipt.durationMs).toBe('number');

    const serializedReceipt = JSON.stringify(result.receipt);
    expect(serializedReceipt).not.toContain('source-lib01e-runtime');
    expect(serializedReceipt).not.toContain('uda-lib01e-runtime');
    expect(serializedReceipt).not.toContain('lesson-lib01e-runtime');
    expect(serializedReceipt).not.toContain('Energia e trasformazioni');
    expect(serializedReceipt).not.toContain('Una centrale trasforma');
    expect(serializedReceipt).not.toContain('3C');
  });

  test('times out one provider invocation without retrying it', async () => {
    const loaded = await loadRuntimeModule();
    if (!loaded.module) return;

    const config = {
      ...loaded.module.resolveTeachingProposalRuntimeConfig({}),
      deadlineMs: 10
    };
    const { provider, calls } = fakeProvider(
      async (_input, context) => await new Promise((resolve, reject) => {
        const onAbort = () => reject(Object.assign(new Error('fake provider aborted'), { code: 'ABORTED' }));
        if (context.signal.aborted) return onAbort();
        context.signal.addEventListener('abort', onAbort, { once: true });
      })
    );
    const runtime = loaded.module.createTeachingProposalRuntime(config, provider);

    let caught: unknown;
    try {
      await runtime.generate(PROVIDER_INPUT, { requestId: 'request-timeout' });
    } catch (reason) {
      caught = reason;
    }

    expect(errorCode(caught)).toBe('timeout');
    expect(calls).toHaveLength(1);
  });

  test('propagates an external abort after a single provider invocation', async () => {
    const loaded = await loadRuntimeModule();
    if (!loaded.module) return;

    const config = loaded.module.resolveTeachingProposalRuntimeConfig({});
    const { provider, calls } = fakeProvider(
      async (_input, context) => await new Promise((resolve, reject) => {
        const onAbort = () => reject(Object.assign(new Error('fake provider aborted'), { code: 'ABORTED' }));
        if (context.signal.aborted) return onAbort();
        context.signal.addEventListener('abort', onAbort, { once: true });
      })
    );
    const runtime = loaded.module.createTeachingProposalRuntime(config, provider);
    const controller = new AbortController();
    const pending = runtime.generate(PROVIDER_INPUT, {
      signal: controller.signal,
      requestId: 'request-external-abort'
    });
    await Promise.resolve();
    controller.abort();

    let caught: unknown;
    try {
      await pending;
    } catch (reason) {
      caught = reason;
    }

    expect(errorCode(caught)).toBe('aborted');
    expect(calls).toHaveLength(1);
  });
});