import type { AgentRoutingRequestV1 } from '../library/agentIntent.ts';

export interface AgentIntentProviderDescriptor {
  id: string;
  displayName: string;
  model: string;
}

export interface AgentIntentProviderCallContext {
  requestId: string;
  signal: AbortSignal;
  maxOutputTokens: number;
}

export interface AgentIntentProviderCallResult {
  output: unknown;
  metadata: {
    providerResponseId?: string;
    modelVersion?: string;
    promptTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export interface GovernedAgentIntentProvider {
  readonly descriptor: AgentIntentProviderDescriptor;
  generate(
    input: AgentRoutingRequestV1,
    context: AgentIntentProviderCallContext
  ): Promise<AgentIntentProviderCallResult>;
}

export type AgentIntentProviderErrorCode =
  | 'not-configured'
  | 'rate-limited'
  | 'timeout'
  | 'blocked'
  | 'unavailable'
  | 'output-invalid'
  | 'provider-error';

export class AgentIntentProviderError extends Error {
  readonly code: AgentIntentProviderErrorCode;

  constructor(code: AgentIntentProviderErrorCode) {
    super(`Agent intent provider failure: ${code}`);
    this.name = 'AgentIntentProviderError';
    this.code = code;
  }
}
