import type {
  GovernedAgentIntentProvider,
  AgentIntentProviderCallResult
} from './agentIntentProvider.ts';
import type { AgentRoutingRequestV1 } from '../library/agentIntent.ts';

export interface AgentIntentRuntimeConfig {
  provider: 'gemini';
  model: 'gemini-3.8-flash';
  deadlineMs: number;
  maxOutputTokens: number;
}

export interface AgentIntentRuntimeReceipt {
  requestId: string;
  provider: string;
  model: string;
  durationMs: number;
  attemptCount: 1;
}

export interface AgentIntentRuntime {
  readonly config: AgentIntentRuntimeConfig;
  interpret(
    input: AgentRoutingRequestV1,
    options?: { signal?: AbortSignal; requestId?: string }
  ): Promise<{ output: unknown; receipt: AgentIntentRuntimeReceipt }>;
}

export type AgentIntentRuntimeErrorCode = 'timeout' | 'aborted';

export class AgentIntentRuntimeError extends Error {
  readonly code: AgentIntentRuntimeErrorCode;

  constructor(code: AgentIntentRuntimeErrorCode) {
    super(code === 'timeout' ? 'Agent intent provider timed out.' : 'Agent intent request aborted.');
    this.name = 'AgentIntentRuntimeError';
    this.code = code;
  }
}

const DEFAULT_CONFIG: AgentIntentRuntimeConfig = {
  provider: 'gemini',
  model: 'gemini-3.8-flash',
  deadlineMs: 20_000,
  maxOutputTokens: 512
};

function governedTimeout(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value.trim())) return DEFAULT_CONFIG.deadlineMs;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 3_000 && parsed <= 30_000
    ? parsed
    : DEFAULT_CONFIG.deadlineMs;
}

export function resolveAgentIntentRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): AgentIntentRuntimeConfig {
  return {
    ...DEFAULT_CONFIG,
    deadlineMs: governedTimeout(env.AGENT_INTENT_TIMEOUT_MS)
  };
}

function createRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `intent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function abortPromise(signal: AbortSignal, error: AgentIntentRuntimeError): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(error);
      return;
    }
    signal.addEventListener('abort', () => reject(error), { once: true });
  });
}

export function createAgentIntentRuntime(
  config: AgentIntentRuntimeConfig,
  provider: GovernedAgentIntentProvider
): AgentIntentRuntime {
  return {
    config: { ...config },
    async interpret(
      input: AgentRoutingRequestV1,
      options: { signal?: AbortSignal; requestId?: string } = {}
    ) {
      const requestId = options.requestId?.trim() || createRequestId();
      if (options.signal?.aborted) throw new AgentIntentRuntimeError('aborted');

      const controller = new AbortController();
      const startedAt = Date.now();
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      let externalAbortHandler: (() => void) | undefined;

      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          controller.abort();
          reject(new AgentIntentRuntimeError('timeout'));
        }, config.deadlineMs);
      });

      let externalAbort: Promise<never> | undefined;
      if (options.signal) {
        externalAbortHandler = () => controller.abort();
        options.signal.addEventListener('abort', externalAbortHandler, { once: true });
        externalAbort = abortPromise(options.signal, new AgentIntentRuntimeError('aborted'));
      }

      const providerCall: Promise<AgentIntentProviderCallResult> = provider.generate(input, {
        requestId,
        signal: controller.signal,
        maxOutputTokens: config.maxOutputTokens
      });

      try {
        const result = await Promise.race([
          providerCall,
          timeout,
          ...(externalAbort ? [externalAbort] : [])
        ]);
        return {
          output: result.output,
          receipt: {
            requestId,
            provider: provider.descriptor.id,
            model: provider.descriptor.model,
            durationMs: Math.max(0, Date.now() - startedAt),
            attemptCount: 1 as const
          }
        };
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (options.signal && externalAbortHandler) {
          options.signal.removeEventListener('abort', externalAbortHandler);
        }
      }
    }
  };
}
