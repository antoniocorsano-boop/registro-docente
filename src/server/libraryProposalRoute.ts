import { evaluateDataFlow } from '../security/dataClassification.ts';
import { isLocallyReadableTextMime } from '../library/intake.ts';
import {
  measureLibraryProposalBudget,
  parseTeachingProposalContent,
  type LibraryProposalErrorCode,
  type LibraryProposalRequestV1,
  type TeachingProposalRuntimeReceiptWire,
  type TeachingProposalV1
} from '../library/teachingProposal.ts';
import {
  buildAiBudgetActivityKey,
  resolvePrepareBudget,
  type AiBudgetAuthorizationV1,
  type AiBudgetEscalationReason,
  type AiBudgetProfile
} from '../copilot/aiBudgetGovernor.ts';
import {
  TeachingProposalProviderError,
  type TeachingProposalProvider,
  type TeachingProposalProviderInput
} from './teachingProposalProvider.ts';
import {
  TeachingProposalRuntimeError,
  type TeachingProposalRuntime
} from './teachingProposalRuntime.ts';

export interface LibraryProposalHandlerResult {
  status: number;
  body: Record<string, unknown>;
}

export interface LibraryProposalHandlerOptions {
  now?: () => string;
  signal?: AbortSignal;
  requestId?: string;
}

const SOURCE_KINDS = new Set([
  'image',
  'file',
  'web',
  'text',
  'note',
  'concept',
  'internal'
]);
const ACTIVITY_TYPES = new Set([
  'teoria',
  'laboratorio',
  'compito_realta',
  'digitale',
  'civica'
]);
const PROFESSIONAL_MEMORY_CATEGORIES = new Set([
  'format-preference',
  'didactic-pattern',
  'material-reuse',
  'planning-continuity',
  'workflow-preference'
]);
const AI_BUDGET_PROFILES = new Set<AiBudgetProfile>(['economy', 'balanced', 'quality']);
const AI_BUDGET_AUTHORIZATION_SCOPES = new Set(['operation', 'activity']);
const MAX_PROFESSIONAL_MEMORY_ITEMS = 5;
const MAX_PROFESSIONAL_MEMORY_SUMMARY_CHARS = 800;
const LEGACY_MAX_INLINE_BYTES = 8 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every(key => allowed.has(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function base64DecodedBytes(value: string): number {
  const compact = value.replace(/\s+/g, '');
  const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((compact.length * 3) / 4) - padding);
}

function isBase64Syntax(value: unknown): value is string {
  return isNonEmptyString(value) && /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

type SourceValidation =
  | { ok: true; value: LibraryProposalRequestV1['source'] }
  | { ok: false; reason: 'invalid' | 'too-large' };

function validateSource(
  value: unknown,
  limits: { maxTextBytes: number; maxInlineBytes: number }
): SourceValidation {
  if (!isRecord(value)) return { ok: false, reason: 'invalid' };
  if (!hasOnlyKeys(value, ['id', 'kind', 'title', 'text', 'mimeType', 'dataBase64'])) {
    return { ok: false, reason: 'invalid' };
  }
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.kind) || !SOURCE_KINDS.has(value.kind)) {
    return { ok: false, reason: 'invalid' };
  }
  if (!isNonEmptyString(value.title)) return { ok: false, reason: 'invalid' };

  const text = value.text;
  const mimeType = value.mimeType;
  const dataBase64 = value.dataBase64;
  const textBytes = isNonEmptyString(text) ? utf8Bytes(text) : 0;
  if (text !== undefined && !isNonEmptyString(text)) return { ok: false, reason: 'invalid' };
  if (textBytes > limits.maxTextBytes) return { ok: false, reason: 'too-large' };
  if (mimeType !== undefined && !isNonEmptyString(mimeType)) return { ok: false, reason: 'invalid' };
  if (dataBase64 !== undefined && !isBase64Syntax(dataBase64)) return { ok: false, reason: 'invalid' };
  if (isBase64Syntax(dataBase64) && base64DecodedBytes(dataBase64) > limits.maxInlineBytes) {
    return { ok: false, reason: 'too-large' };
  }

  if (value.kind === 'web' || value.kind === 'text' || value.kind === 'note' || value.kind === 'concept' || value.kind === 'internal') {
    if (!isNonEmptyString(text) || mimeType !== undefined || dataBase64 !== undefined) return { ok: false, reason: 'invalid' };
  } else if (value.kind === 'image') {
    if (!isNonEmptyString(mimeType) || !mimeType.toLowerCase().startsWith('image/') || !isBase64Syntax(dataBase64) || text !== undefined) {
      return { ok: false, reason: 'invalid' };
    }
  } else if (value.kind === 'file') {
    if (!isNonEmptyString(mimeType)) return { ok: false, reason: 'invalid' };
    const normalizedMime = mimeType.toLowerCase();
    if (normalizedMime === 'application/pdf') {
      if (!isBase64Syntax(dataBase64) || text !== undefined) return { ok: false, reason: 'invalid' };
    } else if (isLocallyReadableTextMime(normalizedMime)) {
      if (normalizedMime.startsWith('text/')) {
        if (!isNonEmptyString(text) && !isBase64Syntax(dataBase64)) return { ok: false, reason: 'invalid' };
        const inlineTextBytes = isBase64Syntax(dataBase64) ? base64DecodedBytes(dataBase64) : 0;
        if (textBytes + inlineTextBytes > limits.maxTextBytes) return { ok: false, reason: 'too-large' };
      } else if (!isNonEmptyString(text) || dataBase64 !== undefined) {
        return { ok: false, reason: 'invalid' };
      }
    } else {
      return { ok: false, reason: 'invalid' };
    }
  }

  return {
    ok: true,
    value: {
      id: value.id.trim(),
      kind: value.kind as LibraryProposalRequestV1['source']['kind'],
      title: value.title.trim(),
      ...(isNonEmptyString(text) ? { text: text.trim() } : {}),
      ...(isNonEmptyString(mimeType) ? { mimeType: mimeType.toLowerCase() } : {}),
      ...(isBase64Syntax(dataBase64) ? { dataBase64: dataBase64.replace(/\s+/g, '') } : {})
    }
  };
}

function validateContext(value: unknown): LibraryProposalRequestV1['context'] | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ['udaId', 'udaTitle', 'className', 'period', 'lessonId', 'lessonTopic', 'activityType'])) return null;

  const { udaId, udaTitle, className, period, lessonId, lessonTopic, activityType } = value;
  if (!isNonEmptyString(udaId) || !isNonEmptyString(udaTitle) || !isNonEmptyString(className) || !isNonEmptyString(period)) return null;
  if (lessonId !== undefined && !isNonEmptyString(lessonId)) return null;
  if (lessonTopic !== undefined && !isNonEmptyString(lessonTopic)) return null;
  if (activityType !== undefined && (!isNonEmptyString(activityType) || !ACTIVITY_TYPES.has(activityType))) return null;

  return {
    udaId: udaId.trim(),
    udaTitle: udaTitle.trim(),
    className: className.trim(),
    period: period.trim(),
    ...(isNonEmptyString(lessonId) ? { lessonId: lessonId.trim() } : {}),
    ...(isNonEmptyString(lessonTopic) ? { lessonTopic: lessonTopic.trim() } : {}),
    ...(isNonEmptyString(activityType) ? { activityType: activityType as LibraryProposalRequestV1['context']['activityType'] } : {})
  };
}

type MemoryValidation =
  | { ok: true; value?: NonNullable<LibraryProposalRequestV1['professionalMemory']> }
  | { ok: false };

function validateProfessionalMemory(value: unknown): MemoryValidation {
  if (value === undefined) return { ok: true };
  if (!isRecord(value) || !hasOnlyKeys(value, ['schema', 'items'])) return { ok: false };
  if (value.schema !== 'registro.professional-memory-remote/v1' || !Array.isArray(value.items)) return { ok: false };
  if (value.items.length > MAX_PROFESSIONAL_MEMORY_ITEMS) return { ok: false };

  const items: NonNullable<LibraryProposalRequestV1['professionalMemory']>['items'] = [];
  for (const item of value.items) {
    if (!isRecord(item) || !hasOnlyKeys(item, ['category', 'summary'])) return { ok: false };
    if (!isNonEmptyString(item.category) || !PROFESSIONAL_MEMORY_CATEGORIES.has(item.category)) return { ok: false };
    if (!isNonEmptyString(item.summary) || item.summary.trim().length > MAX_PROFESSIONAL_MEMORY_SUMMARY_CHARS) return { ok: false };
    items.push({
      category: item.category as NonNullable<LibraryProposalRequestV1['professionalMemory']>['items'][number]['category'],
      summary: item.summary.trim()
    });
  }

  return {
    ok: true,
    value: {
      schema: 'registro.professional-memory-remote/v1',
      items
    }
  };
}

function validIsoTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function validateBudgetAuthorization(value: unknown): AiBudgetAuthorizationV1 | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['schemaVersion', 'scope', 'issuedAt', 'expiresAt', 'activityKey'])) return null;
  if (value.schemaVersion !== 1 || !isNonEmptyString(value.scope) || !AI_BUDGET_AUTHORIZATION_SCOPES.has(value.scope)) return null;
  if (!validIsoTimestamp(value.issuedAt) || !validIsoTimestamp(value.expiresAt) || !isNonEmptyString(value.activityKey)) return null;
  return {
    schemaVersion: 1,
    scope: value.scope as AiBudgetAuthorizationV1['scope'],
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
    activityKey: value.activityKey.trim()
  };
}

function validateBudget(
  value: unknown,
  context: LibraryProposalRequestV1['context']
): LibraryProposalRequestV1['budget'] | null {
  const expectedActivityKey = buildAiBudgetActivityKey(context.udaId, context.lessonId);
  if (!isRecord(value) || !hasOnlyKeys(value, ['schemaVersion', 'profile', 'activityKey', 'authorization'])) return null;
  if (value.schemaVersion !== 1 || !isNonEmptyString(value.profile) || !AI_BUDGET_PROFILES.has(value.profile as AiBudgetProfile)) return null;
  if (!isNonEmptyString(value.activityKey) || value.activityKey.trim() !== expectedActivityKey) return null;
  const authorization = value.authorization === undefined ? undefined : validateBudgetAuthorization(value.authorization);
  if (value.authorization !== undefined && !authorization) return null;
  return {
    schemaVersion: 1,
    profile: value.profile as AiBudgetProfile,
    activityKey: expectedActivityKey,
    ...(authorization ? { authorization } : {})
  };
}

type RequestValidation =
  | { ok: true; value: LibraryProposalRequestV1 }
  | { ok: false; reason: 'invalid' | 'too-large' };

function validateRequest(
  value: unknown,
  limits: { maxTextBytes: number; maxInlineBytes: number }
): RequestValidation {
  if (!isRecord(value)) return { ok: false, reason: 'invalid' };
  if (!hasOnlyKeys(value, [
    'schemaVersion', 'action', 'classification', 'explicitTeacherOptIn', 'source', 'context', 'budget', 'professionalMemory'
  ])) return { ok: false, reason: 'invalid' };
  if (value.schemaVersion !== 1 || value.action !== 'prepare-activity') return { ok: false, reason: 'invalid' };
  if (value.classification !== 'TEACHER_PROFESSIONAL' || value.explicitTeacherOptIn !== true) return { ok: false, reason: 'invalid' };

  const source = validateSource(value.source, limits);
  if (!source.ok) return source;
  const context = validateContext(value.context);
  if (!context) return { ok: false, reason: 'invalid' };
  const budget = validateBudget(value.budget, context);
  if (!budget) return { ok: false, reason: 'invalid' };
  const professionalMemory = validateProfessionalMemory(value.professionalMemory);
  if (!professionalMemory.ok) return { ok: false, reason: 'invalid' };

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      action: 'prepare-activity',
      classification: 'TEACHER_PROFESSIONAL',
      explicitTeacherOptIn: true,
      source: source.value,
      context,
      budget,
      ...(professionalMemory.value ? { professionalMemory: professionalMemory.value } : {})
    }
  };
}

function policyAllowsRemote(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.classification === 'TEACHER_PROFESSIONAL' &&
    evaluateDataFlow('TEACHER_PROFESSIONAL', 'REMOTE_PROVIDER', value.explicitTeacherOptIn === true) === 'ALLOW';
}

function isGovernedRuntime(value: TeachingProposalProvider | TeachingProposalRuntime): value is TeachingProposalRuntime {
  return 'config' in value && isRecord(value.config) && typeof value.generate === 'function';
}

function stableError(
  code: LibraryProposalErrorCode,
  status: number,
  message: string,
  retriable: boolean,
  requestId?: string,
  reason?: AiBudgetEscalationReason
): LibraryProposalHandlerResult {
  return {
    status,
    body: {
      error: {
        code,
        message,
        retriable,
        ...(requestId ? { requestId } : {}),
        ...(reason ? { reason } : {})
      }
    }
  };
}

function mapRuntimeError(error: unknown, requestId?: string): LibraryProposalHandlerResult {
  if (error instanceof TeachingProposalRuntimeError) {
    if (error.code === 'timeout') return stableError('PROVIDER_TIMEOUT', 504, 'Il servizio remoto non ha risposto entro il tempo previsto.', true, requestId);
    return stableError('PROVIDER_ERROR', 502, 'La richiesta al servizio remoto è stata interrotta.', false, requestId);
  }
  if (error instanceof TeachingProposalProviderError) {
    switch (error.code) {
      case 'not-configured': return stableError('PROVIDER_NOT_CONFIGURED', 503, 'Il servizio remoto non è configurato.', false, requestId);
      case 'rate-limited': return stableError('PROVIDER_RATE_LIMITED', 429, 'Il servizio remoto ha raggiunto temporaneamente il proprio limite.', true, requestId);
      case 'timeout': return stableError('PROVIDER_TIMEOUT', 504, 'Il servizio remoto non ha risposto entro il tempo previsto.', true, requestId);
      case 'blocked': return stableError('PROVIDER_BLOCKED', 422, 'Il servizio remoto non può produrre una proposta per questa richiesta.', false, requestId);
      case 'unavailable': return stableError('PROVIDER_UNAVAILABLE', 503, 'Il servizio remoto è temporaneamente non disponibile.', true, requestId);
      case 'output-invalid': return stableError('PROVIDER_OUTPUT_INVALID', 502, 'Il servizio remoto ha restituito una proposta non valida.', false, requestId);
      default: return stableError('PROVIDER_ERROR', 502, 'Il servizio remoto non ha completato la richiesta.', false, requestId);
    }
  }
  return stableError('PROVIDER_ERROR', 502, 'Il servizio remoto non ha completato la richiesta.', false, requestId);
}

function legacyLimits() {
  return { maxTextBytes: Number.POSITIVE_INFINITY, maxInlineBytes: LEGACY_MAX_INLINE_BYTES };
}

async function handleLegacyProvider(body: unknown, provider: TeachingProposalProvider, now: () => string): Promise<LibraryProposalHandlerResult> {
  if (!policyAllowsRemote(body)) {
    return { status: 403, body: { error: 'Flusso verso provider remoto non consentito dalla policy SEC.' } };
  }
  const validated = validateRequest(body, legacyLimits());
  if (!validated.ok) return { status: 400, body: { error: 'Richiesta di proposta didattica non valida.' } };

  const request = validated.value;
  const providerInput: TeachingProposalProviderInput = {
    source: request.source,
    context: request.context,
    ...(request.professionalMemory ? { professionalMemory: request.professionalMemory } : {})
  };

  let rawProposal: unknown;
  try {
    rawProposal = await provider.generate(providerInput);
  } catch (error) {
    return { status: 502, body: { error: error instanceof Error ? error.message : 'Provider di proposta didattica non disponibile.' } };
  }

  let content;
  try {
    content = parseTeachingProposalContent(rawProposal);
  } catch {
    return { status: 502, body: { error: 'Il provider ha restituito una proposta didattica non valida.' } };
  }

  const proposal: TeachingProposalV1 = {
    schemaVersion: 1,
    kind: 'activity',
    ...content,
    sourceId: request.source.id,
    context: { udaId: request.context.udaId, ...(request.context.lessonId ? { lessonId: request.context.lessonId } : {}) },
    provenance: { mode: 'remote', provider: provider.id, model: provider.model, generatedAt: now() }
  };
  return { status: 200, body: { proposal } };
}

export async function handleLibraryProposalRequest(
  body: unknown,
  executor: TeachingProposalProvider | TeachingProposalRuntime,
  nowOrOptions: (() => string) | LibraryProposalHandlerOptions = () => new Date().toISOString()
): Promise<LibraryProposalHandlerResult> {
  if (!isGovernedRuntime(executor)) {
    const now = typeof nowOrOptions === 'function' ? nowOrOptions : nowOrOptions.now ?? (() => new Date().toISOString());
    return handleLegacyProvider(body, executor, now);
  }

  const options = typeof nowOrOptions === 'function' ? { now: nowOrOptions } : nowOrOptions;
  const now = options.now ?? (() => new Date().toISOString());
  if (!policyAllowsRemote(body)) {
    return stableError('REMOTE_POLICY_DENIED', 403, 'La policy non consente l’invio di questa fonte al servizio remoto.', false);
  }

  const validated = validateRequest(body, executor.config);
  if (!validated.ok) {
    if (validated.reason === 'too-large') return stableError('SOURCE_TOO_LARGE', 413, 'La fonte supera il limite previsto per questa richiesta.', false);
    return stableError('REQUEST_INVALID', 400, 'La richiesta di proposta didattica non è valida.', false);
  }

  const request = validated.value;
  const budgetMetrics = measureLibraryProposalBudget(request);
  const evaluatedAt = now();
  const budgetDecision = resolvePrepareBudget({
    profile: request.budget.profile,
    ...budgetMetrics,
    activityKey: request.budget.activityKey,
    ...(request.budget.authorization ? { authorization: request.budget.authorization } : {}),
    now: evaluatedAt
  });
  if (budgetDecision.kind === 'escalation-required') {
    return stableError(
      'AI_BUDGET_ESCALATION_REQUIRED',
      409,
      budgetDecision.explanation,
      false,
      options.requestId,
      budgetDecision.reason
    );
  }

  const budgetReceipt = {
    tier: budgetDecision.tier,
    profile: request.budget.profile,
    escalated: budgetDecision.escalated
  } as const;
  const providerInput: TeachingProposalProviderInput = {
    source: request.source,
    context: request.context,
    ...(request.professionalMemory ? { professionalMemory: request.professionalMemory } : {})
  };

  let runtimeResult: { output: unknown; receipt: TeachingProposalRuntimeReceiptWire };
  try {
    runtimeResult = await executor.generate(providerInput, {
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.requestId ? { requestId: options.requestId } : {}),
      maxOutputTokens: budgetDecision.maxOutputTokens,
      budget: budgetReceipt
    });
  } catch (error) {
    return mapRuntimeError(error, options.requestId);
  }

  const receipt: TeachingProposalRuntimeReceiptWire = {
    ...runtimeResult.receipt,
    budget: budgetReceipt
  };
  let content;
  try {
    content = parseTeachingProposalContent(runtimeResult.output);
  } catch {
    return stableError('PROVIDER_OUTPUT_INVALID', 502, 'Il servizio remoto ha restituito una proposta non valida.', false, receipt.requestId);
  }

  const proposal: TeachingProposalV1 = {
    schemaVersion: 1,
    kind: 'activity',
    ...content,
    sourceId: request.source.id,
    context: { udaId: request.context.udaId, ...(request.context.lessonId ? { lessonId: request.context.lessonId } : {}) },
    provenance: {
      mode: 'remote',
      provider: receipt.provider,
      model: receipt.model,
      generatedAt: evaluatedAt
    }
  };

  return { status: 200, body: { proposal, receipt } };
}
