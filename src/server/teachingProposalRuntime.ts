import type { AiBudgetProfile, AiRemoteTier } from '../copilot/aiBudgetGovernor.ts';
import type {
  GovernedTeachingProposalProvider,
  TeachingProposalProviderInput
} from './teachingProposalProvider.ts';

export interface TeachingProposalRuntimeConfig {
  provider: 'gemini';
  model: 'gemini-3.8-flash';
  deadlineMs: number;
  maxTextBytes: number;
  maxInlineBytes: number;
  maxOutputTokens: number;
}

export interface TeachingProposalRuntimeBudgetReceipt {
  tier: AiRemoteTier;
  profile: AiBudgetProfile;
  escalated: boolean;
}

export interface TeachingProposalRuntimeReceipt {
  requestId: string;
  provider: string;
  model: string;
  modelVersion?: string;
  providerResponseId?: string;
  durationMs: number;
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  attemptCount: 1;
  budget?: TeachingProposalRuntimeBudgetReceipt;
}

export interface TeachingProposalRuntimeOptions {
  signal?: AbortSignal;
  requestId?: string;
  maxOutputTokens?: number;
  budget?: TeachingProposalRuntimeBudgetReceipt;
}

export interface TeachingProposalRuntime {
  readonly config: TeachingProposalRuntimeConfig;
  generate(
    input: TeachingProposalProviderInput,
    options?: TeachingProposalRuntimeOptions
  ): Promise<{ output: unknown; receipt: TeachingProposalRuntimeReceipt }>;
}

export type TeachingProposalRuntimeErrorCode = 'timeout' | 'aborted';

export class TeachingProposalRuntimeError extends Error {
  readonly code: TeachingProposalRuntimeErrorCode;

  constructor(code: TeachingProposalRuntimeErrorCode) {
    super(code === 'timeout' ? 'Teaching proposal provider timed out.' : 'Teaching proposal request aborted.');
    this.name = 'TeachingProposalRuntimeError';
    this.code = code;
  }
}

const DEFAULT_CONFIG: TeachingProposalRuntimeConfig = {
  provider: 'gemini',
  model: 'gemini-3.8-flash',
  deadlineMs: 45_000,
  maxTextBytes: 262_144,
  maxInlineBytes: 8 * 1024 * 1024,
  maxOutputTokens: 2_048
};

function governedTimeout(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value.trim())) return DEFAULT_CONFIG.deadlineMs;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 5_000 && parsed <= 120_000
    ? parsed
    : DEFAULT_CONFIG.deadlineMs;
}

export function resolveTeachingProposalRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): TeachingProposalRuntimeConfig {
  return {
    ...DEFAULT_CONFIG,
    deadlineMs: governedTimeout(env.LIBRARY_PROPOSAL_TIMEOUT_MS)
  };
}

function createRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `proposal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function abortPromise(signal: AbortSignal, error: TeachingProposalRuntimeError): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(error);
      return;
    }
    signal.addEventListener('abort', () => reject(error), { once: true });
  });
}

function governedOutputCap(configuredMaximum: number, requested: number | undefined): number {
  if (!Number.isSafeInteger(requested) || (requested ?? 0) <= 0) return configuredMaximum;
  return Math.min(configuredMaximum, requested!);
}

export function createTeachingProposalRuntime(
  config: TeachingProposalRuntimeConfig,
  provider: GovernedTeachingProposalProvider
): TeachingProposalRuntime {
  return {
    config: { ...config },
    async generate(
      input: TeachingProposalProviderInput,
      options: TeachingProposalRuntimeOptions = {}
    ): Promise<{ output: unknown; receipt: TeachingProposalRuntimeReceipt }> {
      const requestId = options.requestId?.trim() || createRequestId();
      if (options.signal?.aborted) throw new TeachingProposalRuntimeError('aborted');

      const controller = new AbortController();
      const startedAt = Date.now();
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      let externalAbortHandler: (() => void) | undefined;

      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          controller.abort();
          reject(new TeachingProposalRuntimeError('timeout'));
        }, config.deadlineMs);
      });

      let externalAbort: Promise<never> | undefined;
      if (options.signal) {
        externalAbortHandler = () => controller.abort();
        options.signal.addEventListener('abort', externalAbortHandler, { once: true });
        externalAbort = abortPromise(options.signal, new TeachingProposalRuntimeError('aborted'));
      }

      const providerCall = provider.generate(input, {
        requestId,
        signal: controller.signal,
        maxOutputTokens: governedOutputCap(config.maxOutputTokens, options.maxOutputTokens)
      });

      try {
        const result = await Promise.race([
          providerCall,
          timeout,
          ...(externalAbort ? [externalAbort] : [])
        ]);
        const metadata = result.metadata ?? {};
        return {
          output: result.output,
          receipt: {
            requestId,
            provider: provider.descriptor.id,
            model: provider.descriptor.model,
            ...(metadata.modelVersion ? { modelVersion: metadata.modelVersion } : {}),
            ...(metadata.providerResponseId ? { providerResponseId: metadata.providerResponseId } : {}),
            durationMs: Math.max(0, Date.now() - startedAt),
            ...(typeof metadata.promptTokens === 'number' ? { promptTokens: metadata.promptTokens } : {}),
            ...(typeof metadata.outputTokens === 'number' ? { outputTokens: metadata.outputTokens } : {}),
            ...(typeof metadata.totalTokens === 'number' ? { totalTokens: metadata.totalTokens } : {}),
            attemptCount: 1,
            ...(options.budget ? { budget: { ...options.budget } } : {})
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
