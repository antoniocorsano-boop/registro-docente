import type { UdaRecord } from '../types';
import type { LibrarySource, LibraryStateV1 } from '../library/types';
import type { PlanningStateV1 } from '../planning/types';
import { resolveLibraryRelevanceTarget } from '../library/relevanceResolver';
import type { CopilotContextProjectionV1 } from './contextProjection';
import {
  COPILOT_PROACTIVITY_POLICIES,
  normalizeCopilotProactivity,
  type CopilotProactivityProfile
} from './proactivity';

export type CopilotOpportunityKind =
  | 'prepare-current-lesson'
  | 'prepare-current-uda'
  | 'prepare-today-lesson'
  | 'resume-mission';

export type CopilotOpportunityScope = 'contextual' | 'today' | 'later';

export interface CopilotProfessionalContextRefV1 {
  className: string;
  udaId: string;
  lessonId?: string;
  sourceId?: string;
}

export interface CopilotOpportunityEvidenceV1 {
  kind: 'current-context' | 'today' | 'source-relevance' | 'deferred' | 'mission';
  reason: string;
  ref?: string;
}

export interface CopilotMissionPreviewSeedV1 {
  goal: string;
  sourceRefs: string[];
  allowedCapabilities: Array<'prepare'>;
  expectedOutputs: Array<{ kind: 'activity'; label: string }>;
}

export interface CopilotOpportunityRankV1 {
  contextualRelevance: number;
  temporalUrgency: number;
  continuity: number;
  expectedUtility: number;
  teacherPreference: number;
  noisePenalty: number;
  finalScore: number;
}

export interface CopilotOpportunityV1 {
  schemaVersion: 1;
  id: string;
  kind: CopilotOpportunityKind;
  scope: CopilotOpportunityScope;
  title: string;
  whyNow: string;
  evidence: CopilotOpportunityEvidenceV1[];
  contextRef: CopilotProfessionalContextRefV1;
  proposedMission: CopilotMissionPreviewSeedV1;
  rank: CopilotOpportunityRankV1;
  createdAt: string;
  validUntil?: string;
}

export interface CopilotOpportunityDismissalV1 {
  opportunityId: string;
  contextFingerprint: string;
}

export interface CopilotDeferredOpportunityV1 {
  opportunity: CopilotOpportunityV1;
  contextFingerprint: string;
  deferredAt: string;
}

export interface CopilotOpportunityMissionSummaryV1 {
  id: string;
  opportunityId: string;
  status: 'authorized' | 'running' | 'suspended' | 'ready' | 'archived';
  contextRef: CopilotProfessionalContextRefV1;
}

export interface ResolveCopilotOpportunitiesInput {
  profile?: CopilotProactivityProfile | null;
  now: string;
  today: string;
  context: CopilotContextProjectionV1;
  udas: UdaRecord[];
  library: LibraryStateV1;
  planning: PlanningStateV1;
  preferenceFactor?: (kind: CopilotOpportunityKind) => number;
  dismissed?: CopilotOpportunityDismissalV1[];
  deferred?: CopilotDeferredOpportunityV1[];
  missions?: CopilotOpportunityMissionSummaryV1[];
  contextFingerprint?: string;
}

export interface CopilotOpportunityResolution {
  primary: CopilotOpportunityV1[];
  overflow: CopilotOpportunityV1[];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function rank(input: Omit<CopilotOpportunityRankV1, 'finalScore'>): CopilotOpportunityRankV1 {
  const finalScore = clamp(
    0.30 * clamp(input.contextualRelevance)
    + 0.20 * clamp(input.temporalUrgency)
    + 0.20 * clamp(input.continuity)
    + 0.15 * clamp(input.expectedUtility)
    + 0.15 * clamp(input.teacherPreference)
    - 0.20 * clamp(input.noisePenalty)
  );
  return { ...input, finalScore };
}

function targetLabel(uda: UdaRecord, lessonId?: string): string {
  if (!lessonId) return uda.title;
  return (uda.lessons ?? []).find(lesson => lesson.id === lessonId)?.topic ?? uda.title;
}

function eligibleSources(library: LibraryStateV1): LibrarySource[] {
  return library.sources.filter(source => (
    source.status === 'ready' && source.privacy === 'teacher-professional'
  ));
}

function sourceForTarget(
  sources: LibrarySource[],
  udas: UdaRecord[],
  targetType: 'uda' | 'lesson',
  targetId: string
): { source: LibrarySource; score: number } | null {
  const ranked = sources
    .map(source => ({
      source,
      relevance: resolveLibraryRelevanceTarget({ source, udas, targetType, targetId })
    }))
    .filter((item): item is { source: LibrarySource; relevance: NonNullable<ReturnType<typeof resolveLibraryRelevanceTarget>> } => (
      Boolean(item.relevance)
      && item.relevance!.signals.some(signal => signal === 'SOURCE_TITLE_MATCH' || signal === 'SOURCE_CONTENT_MATCH')
    ))
    .sort((left, right) => (
      right.relevance.score - left.relevance.score
      || left.source.id.localeCompare(right.source.id, 'it')
    ));

  const first = ranked[0];
  return first ? { source: first.source, score: first.relevance.score } : null;
}

function missionSeed(uda: UdaRecord, source: LibrarySource, lessonId?: string): CopilotMissionPreviewSeedV1 {
  const label = targetLabel(uda, lessonId);
  return {
    goal: lessonId
      ? `Prepara la lezione “${label}” per ${uda.className}`
      : `Prepara il prossimo lavoro per l’UDA “${uda.title}” di ${uda.className}`,
    sourceRefs: [source.id],
    allowedCapabilities: ['prepare'],
    expectedOutputs: [{ kind: 'activity', label: 'Proposta didattica pronta da controllare' }]
  };
}

function opportunityId(kind: CopilotOpportunityKind, udaId: string, sourceId: string, lessonId?: string): string {
  return `${kind}:${udaId}:${lessonId ?? '-'}:${sourceId}`;
}

function contextFingerprint(input: ResolveCopilotOpportunitiesInput): string {
  if (input.contextFingerprint) return input.contextFingerprint;
  return [
    input.context.surface,
    input.context.className ?? '',
    input.context.udaId ?? '',
    input.context.lessonId ?? '',
    input.context.sourceId ?? ''
  ].join('|');
}

function isDismissed(
  opportunity: CopilotOpportunityV1,
  input: ResolveCopilotOpportunitiesInput
): boolean {
  const fingerprint = contextFingerprint(input);
  return (input.dismissed ?? []).some(item => (
    item.opportunityId === opportunity.id && item.contextFingerprint === fingerprint
  ));
}

function compareOpportunities(left: CopilotOpportunityV1, right: CopilotOpportunityV1): number {
  if (left.rank.finalScore !== right.rank.finalScore) return right.rank.finalScore - left.rank.finalScore;
  const precedence: Record<CopilotOpportunityScope, number> = { contextual: 0, today: 1, later: 2 };
  if (precedence[left.scope] !== precedence[right.scope]) return precedence[left.scope] - precedence[right.scope];
  return left.id.localeCompare(right.id, 'it');
}

function buildPrepareOpportunity(input: {
  kind: Exclude<CopilotOpportunityKind, 'resume-mission'>;
  scope: Exclude<CopilotOpportunityScope, 'later'>;
  uda: UdaRecord;
  lessonId?: string;
  source: LibrarySource;
  sourceScore: number;
  now: string;
  preference: number;
}): CopilotOpportunityV1 {
  const label = targetLabel(input.uda, input.lessonId);
  const current = input.scope === 'contextual';
  const reason = current
    ? input.lessonId
      ? `È il contesto di lavoro corrente e la fonte “${input.source.title}” è pertinente alla lezione.`
      : `È l’UDA corrente e la fonte “${input.source.title}” è pertinente al lavoro in corso.`
    : `La lezione “${label}” è prevista oggi e la fonte “${input.source.title}” è pertinente.`;
  const evidence: CopilotOpportunityEvidenceV1[] = [
    { kind: current ? 'current-context' : 'today', reason, ref: input.lessonId ?? input.uda.id },
    {
      kind: 'source-relevance',
      reason: `Pertinenza locale verificata per “${input.source.title}”.`,
      ref: input.source.id
    }
  ];
  const opportunityRank = rank({
    contextualRelevance: current ? 100 : 60,
    temporalUrgency: input.scope === 'today' ? 100 : 80,
    continuity: current ? 90 : 70,
    expectedUtility: clamp(70 + Math.min(20, input.sourceScore / 5)),
    teacherPreference: clamp(input.preference),
    noisePenalty: 0
  });
  return {
    schemaVersion: 1,
    id: opportunityId(input.kind, input.uda.id, input.source.id, input.lessonId),
    kind: input.kind,
    scope: input.scope,
    title: input.lessonId
      ? `Prepara ${label} — ${input.uda.className}`
      : `Continua ${input.uda.title} — ${input.uda.className}`,
    whyNow: reason,
    evidence,
    contextRef: {
      className: input.uda.className,
      udaId: input.uda.id,
      ...(input.lessonId ? { lessonId: input.lessonId } : {}),
      sourceId: input.source.id
    },
    proposedMission: missionSeed(input.uda, input.source, input.lessonId),
    rank: opportunityRank,
    createdAt: input.now
  };
}

function revalidateDeferredOpportunity(
  deferred: CopilotDeferredOpportunityV1,
  input: ResolveCopilotOpportunitiesInput,
  sources: LibrarySource[],
  preference: (kind: CopilotOpportunityKind) => number
): CopilotOpportunityV1 | null {
  const opportunity = deferred.opportunity;
  const uda = input.udas.find(candidate => (
    candidate.id === opportunity.contextRef.udaId
    && candidate.className === opportunity.contextRef.className
  ));
  if (!uda) return null;

  const lessonId = opportunity.contextRef.lessonId;
  const lesson = lessonId
    ? (uda.lessons ?? []).find(candidate => candidate.id === lessonId)
    : undefined;
  if (lessonId && !lesson) return null;

  const requiredSourceIds = opportunity.proposedMission.sourceRefs;
  if (requiredSourceIds.length === 0) return null;
  if (requiredSourceIds.some(sourceId => !sources.some(source => source.id === sourceId))) return null;

  const evidenceSourceId = opportunity.contextRef.sourceId ?? requiredSourceIds[0];
  const source = sources.find(candidate => candidate.id === evidenceSourceId);
  if (!source) return null;

  const targetType = lessonId ? 'lesson' : 'uda';
  const targetId = lessonId ?? uda.id;
  const relevance = resolveLibraryRelevanceTarget({
    source,
    udas: input.udas,
    targetType,
    targetId
  });
  if (!relevance || !relevance.signals.some(signal => (
    signal === 'SOURCE_TITLE_MATCH' || signal === 'SOURCE_CONTENT_MATCH'
  ))) return null;

  if (opportunity.validUntil) {
    const validUntil = Date.parse(opportunity.validUntil);
    const now = Date.parse(input.now);
    if (Number.isFinite(validUntil) && Number.isFinite(now) && now > validUntil) return null;
  }

  const isCurrentContext = input.context.udaId === uda.id
    && (!lessonId || input.context.lessonId === lessonId);
  const isToday = Boolean(lesson && lesson.date === input.today);
  const reason = isToday
    ? `L’avevi messa da parte e la lezione “${lesson!.topic}” è prevista oggi; la fonte “${source.title}” è ancora pertinente.`
    : isCurrentContext
      ? `L’avevi messa da parte e il relativo contesto è di nuovo attivo; la fonte “${source.title}” è ancora pertinente.`
      : `L’avevi messa da parte; il contesto e la fonte “${source.title}” sono ancora disponibili e pertinenti.`;

  const refreshedEvidence: CopilotOpportunityEvidenceV1[] = [
    {
      kind: 'deferred',
      reason,
      ref: opportunity.id
    },
    {
      kind: 'source-relevance',
      reason: `Pertinenza locale verificata di nuovo per “${source.title}”.`,
      ref: source.id
    }
  ];
  if (isToday && lessonId) {
    refreshedEvidence.push({
      kind: 'today',
      reason: `La lezione “${lesson!.topic}” è prevista oggi.`,
      ref: lessonId
    });
  } else if (isCurrentContext) {
    refreshedEvidence.push({
      kind: 'current-context',
      reason: 'Il contesto professionale collegato è attualmente attivo.',
      ref: lessonId ?? uda.id
    });
  }

  return {
    ...opportunity,
    scope: 'later',
    whyNow: reason,
    evidence: refreshedEvidence,
    rank: rank({
      ...opportunity.rank,
      contextualRelevance: isCurrentContext
        ? Math.min(Math.max(opportunity.rank.contextualRelevance, 60), 80)
        : Math.min(opportunity.rank.contextualRelevance, 60),
      temporalUrgency: isToday
        ? Math.max(opportunity.rank.temporalUrgency, 90)
        : Math.min(opportunity.rank.temporalUrgency, 60),
      expectedUtility: clamp(70 + Math.min(20, relevance.score / 5)),
      teacherPreference: clamp(preference(opportunity.kind)),
      noisePenalty: 0
    }),
    createdAt: input.now
  };
}

export function resolveCopilotOpportunities(input: ResolveCopilotOpportunitiesInput): CopilotOpportunityResolution {
  const profile = normalizeCopilotProactivity(input.profile);
  const policy = COPILOT_PROACTIVITY_POLICIES[profile];
  const sources = eligibleSources(input.library);
  const opportunities: CopilotOpportunityV1[] = [];
  const preference = input.preferenceFactor ?? (() => 50);

  const currentUda = input.context.udaId
    ? input.udas.find(uda => uda.id === input.context.udaId && (!input.context.className || uda.className === input.context.className))
    : undefined;

  if (currentUda && input.context.lessonId) {
    const lesson = (currentUda.lessons ?? []).find(item => item.id === input.context.lessonId);
    if (lesson) {
      const match = sourceForTarget(sources, input.udas, 'lesson', lesson.id);
      if (match) {
        opportunities.push(buildPrepareOpportunity({
          kind: 'prepare-current-lesson',
          scope: 'contextual',
          uda: currentUda,
          lessonId: lesson.id,
          source: match.source,
          sourceScore: match.score,
          now: input.now,
          preference: preference('prepare-current-lesson')
        }));
      }
    }
  } else if (currentUda) {
    const match = sourceForTarget(sources, input.udas, 'uda', currentUda.id);
    if (match) {
      opportunities.push(buildPrepareOpportunity({
        kind: 'prepare-current-uda',
        scope: 'contextual',
        uda: currentUda,
        source: match.source,
        sourceScore: match.score,
        now: input.now,
        preference: preference('prepare-current-uda')
      }));
    }
  }

  for (const uda of input.udas) {
    for (const lesson of uda.lessons ?? []) {
      if (lesson.date !== input.today) continue;
      if (uda.id === input.context.udaId && lesson.id === input.context.lessonId) continue;
      const match = sourceForTarget(sources, input.udas, 'lesson', lesson.id);
      if (!match) continue;
      opportunities.push(buildPrepareOpportunity({
        kind: 'prepare-today-lesson',
        scope: 'today',
        uda,
        lessonId: lesson.id,
        source: match.source,
        sourceScore: match.score,
        now: input.now,
        preference: preference('prepare-today-lesson')
      }));
    }
  }

  for (const deferred of input.deferred ?? []) {
    const opportunity = revalidateDeferredOpportunity(deferred, input, sources, preference);
    if (opportunity) opportunities.push(opportunity);
  }

  const deferredIds = new Set((input.deferred ?? []).map(item => item.opportunity.id));
  const eligible = opportunities
    .filter(opportunity => opportunity.scope === 'later' || !deferredIds.has(opportunity.id))
    .filter(opportunity => !isDismissed(opportunity, input))
    .filter(opportunity => opportunity.rank.finalScore >= policy.threshold)
    .sort(compareOpportunities);

  const primary = eligible.slice(0, policy.primaryLimit);
  const overflow = policy.allowOverflow ? eligible.slice(policy.primaryLimit) : [];
  return { primary, overflow };
}
