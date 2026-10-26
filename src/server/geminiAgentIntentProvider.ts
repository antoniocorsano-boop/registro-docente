import { GoogleGenAI } from '@google/genai';
import {
  AgentIntentProviderError,
  type AgentIntentProviderCallContext,
  type AgentIntentProviderCallResult,
  type GovernedAgentIntentProvider
} from './agentIntentProvider.ts';
import type { AgentRoutingRequestV1 } from '../library/agentIntent.ts';

const GEMINI_MODEL = 'gemini-3.8-flash';

const AGENT_INTENT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'intent', 'goal', 'contextTarget', 'confidence', 'needsClarification'],
  properties: {
    schema: { type: 'string', enum: ['registro.agent-intent/v1'] },
    intent: {
      type: 'string',
      enum: [
        'REVIEW', 'LINK', 'PREPARE', 'ADAPT', 'SIMPLIFY', 'COMPARE',
        'CREATE_MATERIAL', 'CREATE_ASSESSMENT', 'RETRIEVE_LIBRARY', 'ANSWER',
        'CLARIFY', 'UNSUPPORTED'
      ]
    },
    goal: { type: 'string', minLength: 1 },
    requestedArtifact: { type: 'string' },
    contextTarget: { type: 'string', enum: ['current', 'explicit', 'unknown'] },
    classReference: { type: 'string' },
    udaReference: { type: 'string' },
    sourceReference: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    needsClarification: { type: 'boolean' },
    clarificationQuestion: { type: 'string' }
  }
} as const;

const SYSTEM_INSTRUCTION = `Sei il livello di comprensione semantica del Copilota per un docente italiano.
Interpreta il messaggio del docente, ma NON autorizzare, NON eseguire, NON dichiarare che un'azione sia stata eseguita e NON inventare capability.
Restituisci esclusivamente l'oggetto JSON conforme allo schema richiesto.
REVIEW significa controllare/valutare una fonte nel contesto didattico.
LINK significa collegare/associare una fonte al contesto didattico corrente.
PREPARE significa preparare/progettare un'attività didattica a partire dal contesto o dalla fonte.
Usa CLARIFY quando la richiesta contiene più azioni plausibili, è ambigua o la confidenza è bassa; in quel caso needsClarification deve essere true e clarificationQuestion deve essere breve e in italiano.
Usa UNSUPPORTED quando comprendi la richiesta ma non appartiene a REVIEW, LINK o PREPARE e non richiede chiarimento.
Le altre etichette semantiche dello schema possono descrivere desideri futuri, ma non implicano mai disponibilità operativa.
Non chiedere, dedurre o produrre dati personali degli studenti. Non hai strumenti, navigazione web, accesso a fonti, allegati, UDA complete o segreti.`;

interface GeminiClientLike {
  models: {
    generateContent(request: Record<string, unknown>): Promise<any>;
  };
}

export interface GeminiAgentIntentProviderOptions {
  apiKey?: string;
  clientFactory?: (apiKey: string) => unknown;
}

function defaultClientFactory(apiKey: string): GeminiClientLike {
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  }) as unknown as GeminiClientLike;
}

function numericStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as Record<string, unknown>;
  const direct = record.status ?? record.statusCode;
  if (typeof direct === 'number') return direct;
  if (typeof direct === 'string' && /^\d{3}$/.test(direct)) return Number(direct);
  const nested = record.error;
  if (nested && typeof nested === 'object') {
    const value = (nested as Record<string, unknown>).code;
    if (typeof value === 'number') return value;
  }
  return undefined;
}

function vendorReason(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const record = error as Record<string, unknown>;
  const reason = record.reason ?? record.statusText;
  if (typeof reason === 'string') return reason.toUpperCase();
  const nested = record.error;
  if (nested && typeof nested === 'object') {
    const value = (nested as Record<string, unknown>).status;
    if (typeof value === 'string') return value.toUpperCase();
  }
  return '';
}

function normalizeGeminiError(error: unknown): AgentIntentProviderError {
  if (error instanceof AgentIntentProviderError) return error;
  const status = numericStatus(error);
  const reason = vendorReason(error);
  if (status === 429 || reason.includes('RESOURCE_EXHAUSTED')) return new AgentIntentProviderError('rate-limited');
  if (status === 408 || status === 504 || reason.includes('DEADLINE_EXCEEDED')) return new AgentIntentProviderError('timeout');
  if (reason.includes('SAFETY') || reason.includes('BLOCK') || reason.includes('PROHIBITED')) {
    return new AgentIntentProviderError('blocked');
  }
  if (typeof status === 'number' && status >= 500) return new AgentIntentProviderError('unavailable');
  return new AgentIntentProviderError('provider-error');
}

function parseStructuredOutput(response: any): unknown {
  const blockReason = response?.promptFeedback?.blockReason;
  const finishReason = String(response?.candidates?.[0]?.finishReason ?? '').toUpperCase();
  if (blockReason || ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(finishReason)) {
    throw new AgentIntentProviderError('blocked');
  }
  const text = response?.text;
  if (typeof text !== 'string' || !text.trim()) throw new AgentIntentProviderError('output-invalid');
  try {
    return JSON.parse(text);
  } catch {
    throw new AgentIntentProviderError('output-invalid');
  }
}

function metadataFromResponse(response: any): AgentIntentProviderCallResult['metadata'] {
  const usage = response?.usageMetadata;
  return {
    ...(typeof response?.responseId === 'string' ? { providerResponseId: response.responseId } : {}),
    ...(typeof response?.modelVersion === 'string' ? { modelVersion: response.modelVersion } : {}),
    ...(typeof usage?.promptTokenCount === 'number' ? { promptTokens: usage.promptTokenCount } : {}),
    ...(typeof usage?.candidatesTokenCount === 'number' ? { outputTokens: usage.candidatesTokenCount } : {}),
    ...(typeof usage?.totalTokenCount === 'number' ? { totalTokens: usage.totalTokenCount } : {})
  };
}

function buildRoutingPrompt(input: AgentRoutingRequestV1): string {
  const { context } = input;
  return `MESSAGGIO DEL DOCENTE\n${input.message}\n\nCONTESTO MINIMO\nSuperficie: ${context.surface}\nClasse corrente presente: ${context.hasCurrentClass ? 'sì' : 'no'}\nUDA corrente presente: ${context.hasCurrentUda ? 'sì' : 'no'}\nFonte selezionata presente: ${context.hasSelectedSource ? 'sì' : 'no'}\n\nInterpreta soltanto la richiesta. Non eseguire azioni.`;
}

export function createGeminiAgentIntentProvider(
  options: GeminiAgentIntentProviderOptions
): GovernedAgentIntentProvider {
  const apiKey = options.apiKey?.trim();
  const factory = options.clientFactory ?? defaultClientFactory;
  const client = apiKey ? factory(apiKey) as GeminiClientLike : null;

  return {
    descriptor: { id: 'google-gemini', displayName: 'Google Gemini', model: GEMINI_MODEL },
    async generate(input, context): Promise<AgentIntentProviderCallResult> {
      if (!client) throw new AgentIntentProviderError('not-configured');
      try {
        const response = await client.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ role: 'user', parts: [{ text: buildRoutingPrompt(input) }] }],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseJsonSchema: AGENT_INTENT_JSON_SCHEMA,
            candidateCount: 1,
            maxOutputTokens: context.maxOutputTokens,
            thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false },
            automaticContinuation: false,
            abortSignal: context.signal
          }
        });
        return { output: parseStructuredOutput(response), metadata: metadataFromResponse(response) };
      } catch (error) {
        throw normalizeGeminiError(error);
      }
    }
  };
}
