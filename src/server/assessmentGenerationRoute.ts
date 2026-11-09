import { createHash, randomUUID } from 'node:crypto';
import { resolvePrepareBudget, type AiBudgetAuthorizationV1, type AiBudgetProfile } from '../copilot/aiBudgetGovernor.ts';
import {
  appearsStudentPersonal,
  buildAiBudgetAssessmentKey,
  type AssessmentGenerationRequestV1
} from '../library/assessmentGeneration.ts';
import { parseAssessmentDraftV1 } from '../library/assessmentDraft.ts';
import { evaluateDataFlow } from '../security/dataClassification.ts';
import { TeachingProposalProviderError } from './teachingProposalProvider.ts';
import {
  resolveTeachingProposalRuntimeConfig,
  type TeachingProposalRuntimeConfig
} from './teachingProposalRuntime.ts';

export interface AssessmentGenerationProviderInput {
  source: { kind: AssessmentGenerationRequestV1['source']['kind']; title: string; text: string };
  context: { className: string; objective: string };
}

export interface AssessmentGenerationProvider {
  descriptor: { id: string; displayName: string; model: string };
  generate(
    input: AssessmentGenerationProviderInput,
    options: {signal: AbortSignal; maxOutputTokens: number}
  ): Promise<{
    output: unknown;
    metadata?: {
      modelVersion?: string;
      providerResponseId?: string;
      promptTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
  }>;
}

export interface AssessmentGenerationRouteOptions {
  signal?: AbortSignal;
  now?: () => string;
  config?: TeachingProposalRuntimeConfig;
}

export interface AssessmentGenerationResponse {
  status: number;
  body: Record<string, unknown>;
}

const ALLOWED_SOURCE_KINDS = new Set(['text', 'note', 'concept', 'web', 'internal']);
const ALLOWED_PROFILES = new Set(['economy', 'balanced', 'quality']);
const activeRequests = new WeakMap<AssessmentGenerationProvider, Set<string>>();
const consumedOperationAuthorizations = new Map<string, number>();

function consumeBudgetOperationOnce(token: AiBudgetAuthorizationV1, evaluatedAt: string): boolean {
  const at = Date.parse(evaluatedAt);
  for (const [key, expiresAt] of consumedOperationAuthorizations) {
    if (expiresAt <= at) consumedOperationAuthorizations.delete(key);
  }
  const key = [token.activityKey, token.issuedAt, token.expiresAt].join('\\u001f');
  if (consumedOperationAuthorizations.has(key)) return false;
  consumedOperationAuthorizations.set(key, Date.parse(token.expiresAt));
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}

function trimmedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) return null;
  return value.trim();
}

function parseRequest(value: unknown, maxTextBytes: number): AssessmentGenerationRequestV1 | null {
  if (!isRecord(value) || !onlyKeys(value, [
    'schemaVersion','action','classification','explicitTeacherOptIn','source','context','budget'
  ])) return null;
  if (value.schemaVersion !== 1 || value.action !== 'generate-assessment-draft') return null;
  if (value.classification !== 'TEACHER_PROFESSIONAL' || value.explicitTeacherOptIn !== true) return null;

  if (!isRecord(value.source) || !onlyKeys(value.source, ['kind','status','privacy','title','text'])) return null;
  const source = value.source;
  if (!ALLOWED_SOURCE_KINDS.has(String(source.kind))
    || source.status !== 'ready'
    || source.privacy !== 'teacher-professional') return null;
  const title = trimmedText(source.title, 160);
  const sourceText = trimmedText(source.text, 65_536);
  if (!title || !sourceText || new TextEncoder().encode(sourceText).byteLength > maxTextBytes) return null;

  if (!isRecord(value.context) || !onlyKeys(value.context, ['className','objective'])) return null;
  const className = trimmedText(value.context.className, 100);
  const objective = trimmedText(value.context.objective, 400);
  if (!className || !objective) return null;

  if (!isRecord(value.budget)
    || !onlyKeys(value.budget, ['schemaVersion','profile','activityKey','authorization'])
    || value.budget.schemaVersion !== 1
    || !ALLOWED_PROFILES.has(String(value.budget.profile))
    || value.budget.activityKey !== buildAiBudgetAssessmentKey(className)) return null;

  const authorization = value.budget.authorization;
  if (authorization !== undefined) {
    if (!isRecord(authorization)
      || !onlyKeys(authorization, ['schemaVersion','scope','issuedAt','expiresAt','activityKey'])
      || authorization.schemaVersion !== 1
      || authorization.scope !== 'operation'
      || typeof authorization.issuedAt !== 'string'
      || typeof authorization.expiresAt !== 'string'
      || authorization.activityKey !== value.budget.activityKey) return null;
  }

  return {
    schemaVersion: 1,
    action: 'generate-assessment-draft',
    classification: 'TEACHER_PROFESSIONAL',
    explicitTeacherOptIn: true,
    source: {
      kind: source.kind as AssessmentGenerationRequestV1['source']['kind'],
      status: 'ready',
      privacy: 'teacher-professional',
      title,
      text: sourceText
    },
    context: {className, objective},
    budget: {
      schemaVersion: 1,
      profile: value.budget.profile as AiBudgetProfile,
      activityKey: value.budget.activityKey as string,
      ...(authorization ? { authorization: authorization as unknown as AiBudgetAuthorizationV1 } : {})
    }
  };
}

const ERROR_COPY = {
  REMOTE_POLICY_DENIED: 'La policy non consente di inviare questo materiale al servizio remoto.',
  REQUEST_INVALID: 'La richiesta di generazione della verifica non è valida.',
  SOURCE_TOO_LARGE: 'La fonte supera il limite di elaborazione.',
  AI_BUDGET_ESCALATION_REQUIRED: 'La fonte richiede un’autorizzazione di elaborazione aggiuntiva.',
  REQUEST_CONFLICT: 'Una richiesta equivalente è già in corso.',
  PROVIDER_NOT_CONFIGURED: 'Il servizio remoto per le verifiche non è configurato.',
  PROVIDER_RATE_LIMITED: 'Il servizio remoto ha raggiunto il proprio limite.',
  PROVIDER_TIMEOUT: 'Il servizio remoto non ha risposto entro il tempo previsto.',
  PROVIDER_BLOCKED: 'Il servizio remoto non può elaborare questa richiesta.',
  PROVIDER_UNAVAILABLE: 'Il servizio remoto non è disponibile.',
  PROVIDER_OUTPUT_INVALID: 'Il servizio remoto ha restituito una bozza di verifica non valida.',
  PROVIDER_ERROR: 'La proposta non è stata prodotta.'
} as const;

type ErrorCode = keyof typeof ERROR_COPY;
function failure(code: ErrorCode, status: number, retriable = false): AssessmentGenerationResponse {
  return { status, body: { error: {code, message: ERROR_COPY[code], retriable} } };
}

function providerFailure(error: unknown, timedOut: boolean): AssessmentGenerationResponse {
  if (timedOut) return failure('PROVIDER_TIMEOUT', 504, true);
  if (error instanceof TeachingProposalProviderError) {
    switch (error.code) {
      case 'not-configured': return failure('PROVIDER_NOT_CONFIGURED', 503);
      case 'rate-limited': return failure('PROVIDER_RATE_LIMITED', 429, true);
      case 'timeout': return failure('PROVIDER_TIMEOUT', 504, true);
      case 'blocked': return failure('PROVIDER_BLOCKED', 422);
      case 'unavailable': return failure('PROVIDER_UNAVAILABLE', 503, true);
      case 'output-invalid': return failure('PROVIDER_OUTPUT_INVALID', 502);
      default: return failure('PROVIDER_ERROR', 502);
    }
  }
  return failure('PROVIDER_ERROR', 502);
}

/**
 * S3b: server-side gate. No method here can write a test, UDA, Vault entry,
 * student result or source provenance. Status/privacy assertions are also
 * checked locally at the dispatch boundary because the Vault is client-only.
 */
export async function handleAssessmentGenerationRequest(
  raw: unknown,
  provider: AssessmentGenerationProvider,
  options: AssessmentGenerationRouteOptions = {}
): Promise<AssessmentGenerationResponse> {
  if (!isRecord(raw) || raw.classification !== 'TEACHER_PROFESSIONAL'
    || evaluateDataFlow('TEACHER_PROFESSIONAL','REMOTE_PROVIDER', raw.explicitTeacherOptIn === true) !== 'ALLOW') {
    return failure('REMOTE_POLICY_DENIED', 403);
  }
  const config = options.config ?? resolveTeachingProposalRuntimeConfig();
  const request = parseRequest(raw, config.maxTextBytes);
  if (!request) return failure('REQUEST_INVALID', 400);
  if ([request.context.objective, request.source.title, request.source.text].some(appearsStudentPersonal)) {
    return failure('REMOTE_POLICY_DENIED', 403);
  }
  const textBytes = new TextEncoder().encode([
    request.source.title, request.source.text, request.context.className, request.context.objective
  ].join('\n')).byteLength;
  const evaluatedAt = (options.now ?? (() => new Date().toISOString()))();
  const budget = resolvePrepareBudget({
    profile: request.budget.profile,
    activityKey: request.budget.activityKey,
    textBytes,
    inlineBytes: 0,
    memoryItems: 0,
    ...(request.budget.authorization ? { authorization: request.budget.authorization } : {}),
    now: evaluatedAt
  });
  if (budget.kind === 'escalation-required') {
    return failure('AI_BUDGET_ESCALATION_REQUIRED', 409);
  }
  if (budget.escalated
    && request.budget.authorization?.scope === 'operation'
    && !consumeBudgetOperationOnce(request.budget.authorization, evaluatedAt)) {
    return failure('AI_BUDGET_ESCALATION_REQUIRED', 409);
  }
  if (options.signal?.aborted) return failure('PROVIDER_ERROR', 499);

  const fingerprint = createHash('sha256')
    .update(JSON.stringify({source:request.source,context:request.context}))
    .digest('hex');
  const running = activeRequests.get(provider) ?? new Set<string>();
  if (running.has(fingerprint)) return failure('REQUEST_CONFLICT', 409, true);
  running.add(fingerprint);
  activeRequests.set(provider, running);

  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;
  let timedOut = false;
  const requestId = randomUUID();
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new Error('generation-timeout'));
      }, config.deadlineMs);
    });
    let aborted: Promise<never> | undefined;
    if (options.signal) {
      aborted = new Promise<never>((_, reject) => {
        abortHandler = () => {
          controller.abort();
          reject(new Error('generation-aborted'));
        };
        options.signal!.addEventListener('abort', abortHandler, {once:true});
      });
      if (options.signal.aborted) return failure('PROVIDER_ERROR', 499);
    }

    const result = await Promise.race([
      provider.generate({
        source: {kind:request.source.kind, title:request.source.title, text:request.source.text},
        context: {...request.context}
      }, {signal:controller.signal, maxOutputTokens:Math.min(config.maxOutputTokens,budget.maxOutputTokens)}),
      timeout,
      ...(aborted ? [aborted] : [])
    ]);
    if (controller.signal.aborted || options.signal?.aborted) {
      return failure(timedOut ? 'PROVIDER_TIMEOUT' : 'PROVIDER_ERROR', timedOut ? 504 : 499);
    }
    let draft;
    try {
      draft = parseAssessmentDraftV1(result.output);
      if ([draft.title, draft.description, ...draft.questions.flatMap(question => [
        question.q, question.explanation, ...question.options
      ])].some(appearsStudentPersonal)) {
        return failure('PROVIDER_OUTPUT_INVALID', 502);
      }
    } catch {
      return failure('PROVIDER_OUTPUT_INVALID', 502);
    }
    const meta = result.metadata ?? {};
    return {
      status: 200,
      body: {
        draft,
        receipt: {
          requestId,
          provider: provider.descriptor.id,
          model: provider.descriptor.model,
          attemptCount: 1,
          ...(typeof meta.promptTokens === 'number' && Number.isFinite(meta.promptTokens)
            ? {promptTokens:meta.promptTokens} : {}),
          ...(typeof meta.outputTokens === 'number' && Number.isFinite(meta.outputTokens)
            ? {outputTokens:meta.outputTokens} : {}),
          ...(typeof meta.totalTokens === 'number' && Number.isFinite(meta.totalTokens)
            ? {totalTokens:meta.totalTokens} : {}),
          budget: {tier:budget.tier,profile:request.budget.profile,escalated:budget.escalated}
        }
      }
    };
  } catch (error) {
    if (options.signal?.aborted && !timedOut) return failure('PROVIDER_ERROR', 499);
    return providerFailure(error, timedOut);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (options.signal && abortHandler) options.signal.removeEventListener('abort', abortHandler);
    running.delete(fingerprint);
  }
}
