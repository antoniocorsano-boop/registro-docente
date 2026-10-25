import { evaluateDataFlow } from '../security/dataClassification';
import {
  parseTeachingProposalContent,
  type LibraryProposalRequestV1,
  type TeachingProposalV1
} from '../library/teachingProposal';
import type {
  TeachingProposalProvider,
  TeachingProposalProviderInput
} from './teachingProposalProvider';

export interface LibraryProposalHandlerResult {
  status: number;
  body: Record<string, unknown>;
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
const MAX_INLINE_BYTES = 8 * 1024 * 1024;

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

function isSafeBase64(value: unknown): value is string {
  if (!isNonEmptyString(value) || !/^[A-Za-z0-9+/=\r\n]+$/.test(value)) return false;
  const compact = value.replace(/\s+/g, '');
  const estimatedBytes = Math.floor((compact.length * 3) / 4);
  return estimatedBytes <= MAX_INLINE_BYTES;
}

function validateSource(value: unknown): LibraryProposalRequestV1['source'] | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ['id', 'kind', 'title', 'text', 'mimeType', 'dataBase64'])) return null;
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.kind) || !SOURCE_KINDS.has(value.kind)) return null;
  if (!isNonEmptyString(value.title)) return null;

  const text = value.text;
  const mimeType = value.mimeType;
  const dataBase64 = value.dataBase64;
  if (text !== undefined && !isNonEmptyString(text)) return null;
  if (mimeType !== undefined && !isNonEmptyString(mimeType)) return null;
  if (dataBase64 !== undefined && !isSafeBase64(dataBase64)) return null;

  if (value.kind === 'web' || value.kind === 'text' || value.kind === 'note' || value.kind === 'concept' || value.kind === 'internal') {
    if (!isNonEmptyString(text) || mimeType !== undefined || dataBase64 !== undefined) return null;
  } else if (value.kind === 'image') {
    if (!isNonEmptyString(mimeType) || !mimeType.toLowerCase().startsWith('image/') || !isSafeBase64(dataBase64) || text !== undefined) {
      return null;
    }
  } else if (value.kind === 'file') {
    if (!isNonEmptyString(mimeType)) return null;
    const normalizedMime = mimeType.toLowerCase();
    if (normalizedMime === 'application/pdf') {
      if (!isSafeBase64(dataBase64) || text !== undefined) return null;
    } else if (normalizedMime.startsWith('text/')) {
      if (!isNonEmptyString(text) && !isSafeBase64(dataBase64)) return null;
    } else {
      return null;
    }
  }

  return {
    id: value.id.trim(),
    kind: value.kind as LibraryProposalRequestV1['source']['kind'],
    title: value.title.trim(),
    ...(isNonEmptyString(text) ? { text: text.trim() } : {}),
    ...(isNonEmptyString(mimeType) ? { mimeType: mimeType.toLowerCase() } : {}),
    ...(isSafeBase64(dataBase64) ? { dataBase64: dataBase64.replace(/\s+/g, '') } : {})
  };
}

function validateContext(value: unknown): LibraryProposalRequestV1['context'] | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, [
    'udaId',
    'udaTitle',
    'className',
    'period',
    'lessonId',
    'lessonTopic',
    'activityType'
  ])) return null;
  for (const key of ['udaId', 'udaTitle', 'className', 'period'] as const) {
    if (!isNonEmptyString(value[key])) return null;
  }
  if (value.lessonId !== undefined && !isNonEmptyString(value.lessonId)) return null;
  if (value.lessonTopic !== undefined && !isNonEmptyString(value.lessonTopic)) return null;
  if (value.activityType !== undefined && (
    !isNonEmptyString(value.activityType) || !ACTIVITY_TYPES.has(value.activityType)
  )) return null;

  return {
    udaId: value.udaId.trim(),
    udaTitle: value.udaTitle.trim(),
    className: value.className.trim(),
    period: value.period.trim(),
    ...(isNonEmptyString(value.lessonId) ? { lessonId: value.lessonId.trim() } : {}),
    ...(isNonEmptyString(value.lessonTopic) ? { lessonTopic: value.lessonTopic.trim() } : {}),
    ...(isNonEmptyString(value.activityType)
      ? { activityType: value.activityType as LibraryProposalRequestV1['context']['activityType'] }
      : {})
  };
}

function validateRequest(value: unknown): LibraryProposalRequestV1 | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, [
    'schemaVersion',
    'action',
    'classification',
    'explicitTeacherOptIn',
    'source',
    'context'
  ])) return null;
  if (value.schemaVersion !== 1 || value.action !== 'prepare-activity') return null;
  if (value.classification !== 'TEACHER_PROFESSIONAL' || value.explicitTeacherOptIn !== true) return null;

  const source = validateSource(value.source);
  const context = validateContext(value.context);
  if (!source || !context) return null;

  return {
    schemaVersion: 1,
    action: 'prepare-activity',
    classification: 'TEACHER_PROFESSIONAL',
    explicitTeacherOptIn: true,
    source,
    context
  };
}

function policyAllowsRemote(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.classification === 'TEACHER_PROFESSIONAL' &&
    evaluateDataFlow(
      'TEACHER_PROFESSIONAL',
      'REMOTE_PROVIDER',
      value.explicitTeacherOptIn === true
    ) === 'ALLOW';
}

export async function handleLibraryProposalRequest(
  body: unknown,
  provider: TeachingProposalProvider,
  now: () => string = () => new Date().toISOString()
): Promise<LibraryProposalHandlerResult> {
  if (!policyAllowsRemote(body)) {
    return {
      status: 403,
      body: { error: 'Flusso verso provider remoto non consentito dalla policy SEC.' }
    };
  }

  const request = validateRequest(body);
  if (!request) {
    return {
      status: 400,
      body: { error: 'Richiesta di proposta didattica non valida.' }
    };
  }

  const providerInput: TeachingProposalProviderInput = {
    source: request.source,
    context: request.context
  };

  let rawProposal: unknown;
  try {
    rawProposal = await provider.generate(providerInput);
  } catch (error) {
    return {
      status: 502,
      body: {
        error: error instanceof Error
          ? error.message
          : 'Provider di proposta didattica non disponibile.'
      }
    };
  }

  let content;
  try {
    content = parseTeachingProposalContent(rawProposal);
  } catch {
    return {
      status: 502,
      body: { error: 'Il provider ha restituito una proposta didattica non valida.' }
    };
  }

  const proposal: TeachingProposalV1 = {
    schemaVersion: 1,
    kind: 'activity',
    ...content,
    sourceId: request.source.id,
    context: {
      udaId: request.context.udaId,
      ...(request.context.lessonId ? { lessonId: request.context.lessonId } : {})
    },
    provenance: {
      mode: 'remote',
      provider: provider.id,
      model: provider.model,
      generatedAt: now()
    }
  };

  return {
    status: 200,
    body: { proposal }
  };
}
