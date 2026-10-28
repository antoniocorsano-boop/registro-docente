import type { AiBudgetProfile } from './aiBudgetGovernor';
import type { CopilotContextProjectionV1 } from './contextProjection';
import type {
  CopilotOpportunityV1,
  CopilotProfessionalContextRefV1
} from './opportunityResolver';
import type { CopilotProactivityProfile } from './proactivity';
import type { LibrarySource } from '../library/types';
import type { UdaRecord } from '../types';
import type { TeachingProposalRuntimeReceiptWire, TeachingProposalV1 } from '../library/teachingProposal';

export interface CopilotMissionPreviewV1 {
  schemaVersion: 1;
  goal: string;
  context: string[];
  uses: string[];
  produces: string[];
  willNotDo: string[];
}

export interface MissionContextFingerprintInput {
  context: CopilotContextProjectionV1;
  uda: UdaRecord;
  sources: LibrarySource[];
  planningProfileId?: string | null;
  missionSettings: {
    aiBudgetProfile?: AiBudgetProfile | null;
    copilotProactivity?: CopilotProactivityProfile | null;
  };
}

export interface MissionSemanticExpiryV1 {
  kind: 'context' | 'date';
  expiresAt?: string;
}

export type CopilotMissionStatus =
  | 'authorized'
  | 'running'
  | 'suspended'
  | 'ready'
  | 'archived';

export interface CopilotMissionV1 {
  schemaVersion: 1;
  id: string;
  opportunityId: string;
  kind: CopilotOpportunityV1['kind'];
  goal: string;
  contextRef: CopilotProfessionalContextRefV1;
  sourceRefs: string[];
  allowedCapabilities: string[];
  expectedOutputs: CopilotOpportunityV1['proposedMission']['expectedOutputs'];
  authority: {
    persistentProfessionalWrite: false;
    externalAction: false;
    scopeExpansion: false;
  };
  budgetProfile: AiBudgetProfile;
  createdAt: string;
  contextFingerprint: string;
  semanticExpiry: MissionSemanticExpiryV1;
  result?: {
    proposal: TeachingProposalV1;
    receipt: TeachingProposalRuntimeReceiptWire;
  };
  status: CopilotMissionStatus;
}

export interface CopilotMissionExecutionGrantV1 {
  schemaVersion: 1;
  token: string;
  missionId: string;
  contextFingerprint: string;
  issuedAt: string;
  expiresAt: string;
}

export interface AuthorizeCopilotMissionInput {
  id: string;
  opportunity: CopilotOpportunityV1;
  fingerprintInput: MissionContextFingerprintInput;
  budgetProfile: AiBudgetProfile;
  now: string;
}

export interface CopilotMissionStepV1 {
  capability: string;
  className: string;
  udaId: string;
  lessonId?: string;
  sourceIds: string[];
}

export type MissionResumeDecision = 'resume' | 'repreview' | 'archive';

const EXECUTION_GRANT_TTL_MS = 15 * 60 * 1000;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort((left, right) => left.localeCompare(right, 'en'))) {
    const entry = record[key];
    if (entry !== undefined) result[key] = canonicalize(entry);
  }
  return result;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(value);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

function selectedLesson(uda: UdaRecord, lessonId: string | undefined): unknown {
  if (!lessonId) return null;
  const lesson = (uda.lessons ?? []).find(candidate => candidate.id === lessonId);
  return lesson
    ? {
        id: lesson.id,
        date: lesson.date,
        topic: lesson.topic,
        hours: lesson.hours,
        notes: lesson.notes,
        activityType: lesson.activityType
      }
    : null;
}

function sourceFingerprintProjection(source: LibrarySource): Record<string, unknown> {
  return {
    id: source.id,
    kind: source.kind,
    title: source.title,
    capturedAt: source.capturedAt,
    status: source.status,
    privacy: source.privacy,
    origin: source.origin,
    sourceUrl: source.sourceUrl,
    extractedText: source.extractedText,
    notes: source.notes,
    payload: {
      mimeType: source.payload.mimeType,
      text: source.payload.text,
      dataUrl: source.payload.dataUrl
    },
    links: source.links.map(link => ({ targetType: link.targetType, targetId: link.targetId }))
  };
}

export function buildMissionContextFingerprint(input: MissionContextFingerprintInput): string {
  const projection = canonicalize({
    context: {
      schema: input.context.schema,
      surface: input.context.surface,
      className: input.context.className,
      udaId: input.context.udaId,
      lessonId: input.context.lessonId,
      sourceId: input.context.sourceId,
      planningProfileId: input.context.planningProfileId,
      assessmentId: input.context.assessmentId
    },
    uda: {
      id: input.uda.id,
      title: input.uda.title,
      className: input.uda.className,
      hours: input.uda.hours,
      period: input.uda.period,
      startMonth: input.uda.startMonth,
      durationMonths: input.uda.durationMonths,
      description: input.uda.description,
      competencies: input.uda.competencies,
      civicEducation: input.uda.civicEducation,
      authenticTask: input.uda.authenticTask,
      dependencies: input.uda.dependencies,
      lesson: selectedLesson(input.uda, input.context.lessonId)
    },
    sources: [...input.sources]
      .sort((left, right) => left.id.localeCompare(right.id, 'it'))
      .map(sourceFingerprintProjection),
    planningProfileId: input.planningProfileId ?? input.context.planningProfileId ?? null,
    missionSettings: input.missionSettings
  });

  return `aic07:${fnv1a64(JSON.stringify(projection))}`;
}

export function buildCopilotMissionPreview(
  opportunity: CopilotOpportunityV1,
  input: MissionContextFingerprintInput
): CopilotMissionPreviewV1 {
  const lesson = selectedLesson(input.uda, opportunity.contextRef.lessonId) as { topic?: string } | null;
  const selectedSources = input.sources.filter(source => opportunity.proposedMission.sourceRefs.includes(source.id));
  const context = [
    opportunity.contextRef.className,
    `UDA ${input.uda.title}`,
    ...(lesson?.topic ? [`Lezione ${lesson.topic}`] : [])
  ];
  const uses = [
    'Contesto didattico corrente',
    ...selectedSources.map(source => `Fonte “${source.title}”`),
    ...(input.planningProfileId || input.context.planningProfileId ? ['Programmazione accettata'] : [])
  ];

  return {
    schemaVersion: 1,
    goal: opportunity.proposedMission.goal,
    context,
    uses,
    produces: opportunity.proposedMission.expectedOutputs.map(output => output.label),
    willNotDo: [
      'Non registrerà né modificherà dati professionali senza conferma.',
      'Non allargherà l’incarico ad altre classi, UDA, fonti o obiettivi.'
    ]
  };
}

function createEphemeralToken(missionId: string, issuedAt: string): string {
  const entropy = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Math.random()}-${Date.now()}`;
  return `${missionId}:${fnv1a64(`${issuedAt}:${entropy}`)}`;
}

export function authorizeCopilotMission(
  preview: CopilotMissionPreviewV1,
  input: AuthorizeCopilotMissionInput
): { mission: CopilotMissionV1; grant: CopilotMissionExecutionGrantV1 } {
  const issuedAtMs = Date.parse(input.now);
  if (!Number.isFinite(issuedAtMs)) throw new Error('Data di autorizzazione missione non valida.');

  const contextFingerprint = buildMissionContextFingerprint(input.fingerprintInput);
  const mission: CopilotMissionV1 = {
    schemaVersion: 1,
    id: input.id,
    opportunityId: input.opportunity.id,
    kind: input.opportunity.kind,
    goal: preview.goal,
    contextRef: { ...input.opportunity.contextRef },
    sourceRefs: [...input.opportunity.proposedMission.sourceRefs],
    allowedCapabilities: [...input.opportunity.proposedMission.allowedCapabilities],
    expectedOutputs: input.opportunity.proposedMission.expectedOutputs.map(output => ({ ...output })),
    authority: {
      persistentProfessionalWrite: false,
      externalAction: false,
      scopeExpansion: false
    },
    budgetProfile: input.budgetProfile,
    createdAt: input.now,
    contextFingerprint,
    semanticExpiry: { kind: 'context' },
    status: 'authorized'
  };

  const grant: CopilotMissionExecutionGrantV1 = {
    schemaVersion: 1,
    token: createEphemeralToken(mission.id, input.now),
    missionId: mission.id,
    contextFingerprint,
    issuedAt: input.now,
    expiresAt: new Date(issuedAtMs + EXECUTION_GRANT_TTL_MS).toISOString()
  };

  return { mission, grant };
}

export function authorizeCopilotMissionResume(
  mission: CopilotMissionV1,
  currentContextFingerprint: string,
  now: string
): CopilotMissionExecutionGrantV1 {
  if (resolveMissionResume(mission, currentContextFingerprint, now) !== 'resume') {
    throw new Error('La missione richiede una nuova anteprima prima di essere ripresa.');
  }
  const issuedAtMs = Date.parse(now);
  if (!Number.isFinite(issuedAtMs)) throw new Error('Data di ripresa missione non valida.');
  return {
    schemaVersion: 1,
    token: createEphemeralToken(mission.id, now),
    missionId: mission.id,
    contextFingerprint: currentContextFingerprint,
    issuedAt: now,
    expiresAt: new Date(issuedAtMs + EXECUTION_GRANT_TTL_MS).toISOString()
  };
}

export function isMissionExecutionGrantValid(
  grant: CopilotMissionExecutionGrantV1,
  mission: CopilotMissionV1,
  currentContextFingerprint: string,
  now: string
): boolean {
  const nowMs = Date.parse(now);
  const issuedAtMs = Date.parse(grant.issuedAt);
  const expiresAtMs = Date.parse(grant.expiresAt);
  if (![nowMs, issuedAtMs, expiresAtMs].every(Number.isFinite)) return false;
  return grant.missionId === mission.id
    && grant.contextFingerprint === mission.contextFingerprint
    && grant.contextFingerprint === currentContextFingerprint
    && nowMs >= issuedAtMs
    && nowMs <= expiresAtMs;
}

export function resolveMissionResume(
  mission: CopilotMissionV1,
  currentContextFingerprint: string,
  now: string
): MissionResumeDecision {
  if (mission.status === 'archived') return 'archive';
  if (mission.semanticExpiry.kind === 'date' && mission.semanticExpiry.expiresAt) {
    const expiresAt = Date.parse(mission.semanticExpiry.expiresAt);
    const nowMs = Date.parse(now);
    if (Number.isFinite(expiresAt) && Number.isFinite(nowMs) && nowMs > expiresAt) return 'archive';
  }
  return currentContextFingerprint === mission.contextFingerprint ? 'resume' : 'repreview';
}

export function canAcceptMissionProposalResult(
  mission: CopilotMissionV1,
  proposal: TeachingProposalV1
): boolean {
  if (mission.status !== 'authorized' && mission.status !== 'running') return false;
  if (!mission.sourceRefs.includes(proposal.sourceId)) return false;
  if (mission.contextRef.sourceId && proposal.sourceId !== mission.contextRef.sourceId) return false;
  if (proposal.context.udaId !== mission.contextRef.udaId) return false;
  if ((proposal.context.lessonId ?? '') !== (mission.contextRef.lessonId ?? '')) return false;
  return true;
}

export function assertMissionStepWithinScope(
  mission: CopilotMissionV1,
  step: CopilotMissionStepV1
): void {
  if (!mission.allowedCapabilities.includes(step.capability)) {
    throw new Error('Capacità fuori dal perimetro della missione.');
  }
  if (step.className !== mission.contextRef.className || step.udaId !== mission.contextRef.udaId) {
    throw new Error('Contesto professionale fuori dal perimetro della missione.');
  }
  if (mission.contextRef.lessonId && step.lessonId !== mission.contextRef.lessonId) {
    throw new Error('Lezione fuori dal perimetro della missione.');
  }
  if (step.sourceIds.some(sourceId => !mission.sourceRefs.includes(sourceId))) {
    throw new Error('Fonte fuori dal perimetro della missione.');
  }
}
