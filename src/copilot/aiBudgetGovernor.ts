export type AiBudgetProfile = 'economy' | 'balanced' | 'quality';
export type AiRemoteTier = 'remote-low' | 'remote-expanded';
export type AiBudgetEscalationReason = 'BINARY_SOURCE' | 'LARGE_SOURCE' | 'RICH_CONTEXT';

export interface AiBudgetAuthorizationV1 {
  schemaVersion: 1;
  scope: 'operation' | 'activity';
  issuedAt: string;
  expiresAt: string;
  activityKey: string;
}

export interface PrepareBudgetInput {
  profile: AiBudgetProfile;
  textBytes: number;
  inlineBytes: number;
  memoryItems: number;
  activityKey: string;
  authorization?: AiBudgetAuthorizationV1;
  now: string;
}

export type PrepareBudgetDecision =
  | { kind: 'allow'; tier: AiRemoteTier; maxOutputTokens: 1024 | 2048; escalated: boolean }
  | { kind: 'escalation-required'; reason: AiBudgetEscalationReason; explanation: string };

const PROFILE_LIMITS: Record<AiBudgetProfile, { textBytes: number; memoryItems: number }> = {
  economy: { textBytes: 16 * 1024, memoryItems: 1 },
  balanced: { textBytes: 64 * 1024, memoryItems: 3 },
  quality: { textBytes: 128 * 1024, memoryItems: 5 }
};

const OPERATION_AUTHORIZATION_TTL_MS = 5 * 60 * 1000;
const ACTIVITY_AUTHORIZATION_TTL_MS = 30 * 60 * 1000;

export function normalizeAiBudgetProfile(value: unknown): AiBudgetProfile {
  return value === 'economy' || value === 'quality' || value === 'balanced' ? value : 'balanced';
}

function requireIdentity(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} non valido.`);
  return normalized;
}

export function buildAiBudgetActivityKey(udaId: string, lessonId?: string): string {
  const normalizedUdaId = requireIdentity(udaId, 'UDA');
  const normalizedLessonId = lessonId?.trim();
  return normalizedLessonId
    ? `uda:${encodeURIComponent(normalizedUdaId)}|lesson:${encodeURIComponent(normalizedLessonId)}`
    : `uda:${encodeURIComponent(normalizedUdaId)}`;
}

function parseTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function createAiBudgetAuthorization(input: {
  scope: AiBudgetAuthorizationV1['scope'];
  activityKey: string;
  issuedAt: string;
}): AiBudgetAuthorizationV1 {
  const issuedAtMs = parseTimestamp(input.issuedAt);
  if (issuedAtMs === null) throw new Error('Istante di autorizzazione non valido.');
  const activityKey = requireIdentity(input.activityKey, 'Attività');
  const ttlMs = input.scope === 'activity' ? ACTIVITY_AUTHORIZATION_TTL_MS : OPERATION_AUTHORIZATION_TTL_MS;

  return {
    schemaVersion: 1,
    scope: input.scope,
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt: new Date(issuedAtMs + ttlMs).toISOString(),
    activityKey
  };
}

export function isAiBudgetAuthorizationValid(input: {
  authorization: AiBudgetAuthorizationV1 | undefined;
  activityKey: string;
  now: string;
}): boolean {
  const { authorization } = input;
  if (!authorization || authorization.schemaVersion !== 1) return false;
  if (authorization.scope !== 'operation' && authorization.scope !== 'activity') return false;
  if (authorization.activityKey !== input.activityKey) return false;

  const issuedAtMs = parseTimestamp(authorization.issuedAt);
  const expiresAtMs = parseTimestamp(authorization.expiresAt);
  const nowMs = parseTimestamp(input.now);
  if (issuedAtMs === null || expiresAtMs === null || nowMs === null) return false;
  if (expiresAtMs <= issuedAtMs || nowMs < issuedAtMs || nowMs > expiresAtMs) return false;

  const maxTtl = authorization.scope === 'activity'
    ? ACTIVITY_AUTHORIZATION_TTL_MS
    : OPERATION_AUTHORIZATION_TTL_MS;
  return expiresAtMs - issuedAtMs <= maxTtl;
}

export function aiBudgetEscalationMessage(reason: AiBudgetEscalationReason): string {
  switch (reason) {
    case 'BINARY_SOURCE':
      return 'Per analizzare questo file o immagine serve una richiesta più impegnativa.';
    case 'LARGE_SOURCE':
      return 'Il materiale è ampio e richiede più capacità per essere analizzato senza tagliarlo.';
    case 'RICH_CONTEXT':
      return 'Questa attività combina più contesto professionale utile e richiede un’elaborazione più ampia.';
  }
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
}

export function resolvePrepareBudget(input: PrepareBudgetInput): PrepareBudgetDecision {
  const profile = normalizeAiBudgetProfile(input.profile);
  const limits = PROFILE_LIMITS[profile];
  const textBytes = finiteNonNegative(input.textBytes);
  const inlineBytes = finiteNonNegative(input.inlineBytes);
  const memoryItems = finiteNonNegative(input.memoryItems);

  let reason: AiBudgetEscalationReason | null = null;
  if (inlineBytes > 0) reason = 'BINARY_SOURCE';
  else if (textBytes > limits.textBytes) reason = 'LARGE_SOURCE';
  else if (memoryItems > limits.memoryItems) reason = 'RICH_CONTEXT';

  if (!reason) {
    return { kind: 'allow', tier: 'remote-low', maxOutputTokens: 1024, escalated: false };
  }

  if (isAiBudgetAuthorizationValid({
    authorization: input.authorization,
    activityKey: input.activityKey,
    now: input.now
  })) {
    return { kind: 'allow', tier: 'remote-expanded', maxOutputTokens: 2048, escalated: true };
  }

  return {
    kind: 'escalation-required',
    reason,
    explanation: aiBudgetEscalationMessage(reason)
  };
}
