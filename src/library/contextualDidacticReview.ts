import type { UdaRecord } from '../types';
import type { LibraryPlanningContextResolution } from './planningContextBridge';
import {
  resolveLibraryRelevance,
  resolveLibraryRelevanceTarget,
  type LibraryRelevanceCandidate,
  type LibraryRelevanceSignal
} from './relevanceResolver';
import { describeLibraryRelevanceCandidate } from './relevancePresentation';
import type { ResolvedLibraryTeachingContext } from './teachingContext';
import type { LibrarySource } from './types';

export type ContextualReviewRelevanceLevel = 'strong' | 'plausible' | 'weak';
export type ContextualReviewConfidenceLevel = 'high' | 'medium' | 'low';

export interface ContextualReviewPlanningMatch {
  itemId: string;
  kind: string;
  sourceSection: string;
  matchedTerms: string[];
}

export interface ContextualReviewReuseSuggestion {
  targetType: 'uda' | 'lesson';
  targetId: string;
  udaId: string;
  title: string;
  subtitle: string;
  reasons: string[];
}

export interface ContextualDidacticReviewV2 {
  schema: 'registro.contextual-didactic-review/v2';
  sourceId: string;
  context: {
    className: string;
    udaId: string;
    lessonId?: string;
    planningProfileId?: string;
    arenaContextId?: string;
  };
  relevance: {
    level: ContextualReviewRelevanceLevel;
    statement: string;
  };
  rationale: string[];
  alignment: {
    status: 'supported' | 'partial' | 'unverified';
    planningMatches: ContextualReviewPlanningMatch[];
  };
  gaps: string[];
  reuseSuggestions: ContextualReviewReuseSuggestion[];
  confidence: {
    level: ContextualReviewConfidenceLevel;
    reasons: string[];
  };
  limitations: string[];
}

export type ContextualDidacticReviewResolution =
  | { status: 'reviewed'; review: ContextualDidacticReviewV2 }
  | {
      status: 'unavailable';
      reason: 'SOURCE_NOT_PROFESSIONAL' | 'SOURCE_NOT_USABLE' | 'TEACHING_CONTEXT_MISSING';
      limitations: string[];
    };

export interface ResolveContextualDidacticReviewInput {
  source: LibrarySource;
  udas: UdaRecord[];
  teachingContext: ResolvedLibraryTeachingContext | null;
  planningContext: LibraryPlanningContextResolution | null;
}

const ITALIAN_STOP_WORDS = new Set([
  'che', 'con', 'del', 'della', 'delle', 'dei', 'degli', 'dal', 'dalla', 'dalle',
  'per', 'una', 'uno', 'nel', 'nella', 'nelle', 'nei', 'negli', 'sul', 'sulla',
  'sulle', 'sui', 'sugli', 'tra', 'fra', 'come', 'sono', 'anche', 'alla', 'alle'
]);

function tokenize(value: string | undefined): Set<string> {
  if (!value) return new Set();

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalized) return new Set();

  return new Set(
    normalized
      .split(/\s+/)
      .filter(token => token.length >= 3 && !ITALIAN_STOP_WORDS.has(token))
  );
}

function mergeTerms(...values: Array<string | undefined>): Set<string> {
  const merged = new Set<string>();
  for (const value of values) {
    for (const token of tokenize(value)) merged.add(token);
  }
  return merged;
}

function intersect(left: Set<string>, right: Set<string>): string[] {
  return [...left]
    .filter(term => right.has(term))
    .sort((a, b) => a.localeCompare(b, 'it'));
}

function hasReadableSourceContent(source: LibrarySource): boolean {
  return [source.extractedText, source.payload.text, source.notes]
    .some(value => typeof value === 'string' && value.trim().length > 0);
}

function hasLexicalEvidence(candidate: LibraryRelevanceCandidate): boolean {
  return candidate.signals.some((signal: LibraryRelevanceSignal) =>
    signal === 'SOURCE_TITLE_MATCH' || signal === 'SOURCE_CONTENT_MATCH'
  );
}

function authoritativeArenaContext(planningContext: LibraryPlanningContextResolution | null) {
  if (planningContext?.status !== 'resolved') return null;
  const arena = planningContext.arenaContext;
  if (!arena) return null;
  if (
    arena.authorityState !== 'APPROVED'
    || arena.vigencyStatus !== 'VIGENTE'
    || arena.privacyClass !== 'PROFESSIONAL_NON_PERSONAL'
  ) {
    return null;
  }
  return arena;
}

function curriculumMatches(
  source: LibrarySource,
  planningContext: LibraryPlanningContextResolution | null
): ContextualReviewPlanningMatch[] {
  const arena = authoritativeArenaContext(planningContext);
  if (!arena) return [];

  const sourceTerms = mergeTerms(
    source.title,
    source.extractedText,
    source.payload.text,
    source.notes
  );
  if (sourceTerms.size === 0) return [];

  return arena.curricoloItems
    .map(item => ({
      itemId: item.id,
      kind: item.kind,
      sourceSection: item.sourceSection,
      matchedTerms: intersect(sourceTerms, tokenize(item.text))
    }))
    .filter(match => match.matchedTerms.length > 0)
    .sort((left, right) => {
      if (left.matchedTerms.length !== right.matchedTerms.length) {
        return right.matchedTerms.length - left.matchedTerms.length;
      }
      return left.itemId.localeCompare(right.itemId, 'it');
    })
    .slice(0, 3);
}

function currentTarget(teachingContext: ResolvedLibraryTeachingContext): {
  targetType: 'uda' | 'lesson';
  targetId: string;
} {
  return teachingContext.lessonId
    ? { targetType: 'lesson', targetId: teachingContext.lessonId }
    : { targetType: 'uda', targetId: teachingContext.udaId };
}

function relevanceLevel(
  evidence: LibraryRelevanceCandidate,
  planningMatches: ContextualReviewPlanningMatch[]
): ContextualReviewRelevanceLevel {
  const lexical = hasLexicalEvidence(evidence);
  const currentLesson = evidence.signals.includes('CURRENT_LESSON');
  const curriculum = planningMatches.length > 0;

  if (lexical && (currentLesson || curriculum)) return 'strong';
  if (lexical || curriculum) return 'plausible';
  return 'weak';
}

function relevanceStatement(level: ContextualReviewRelevanceLevel): string {
  switch (level) {
    case 'strong':
      return 'La fonte mostra elementi concreti e direttamente pertinenti al contesto didattico corrente.';
    case 'plausible':
      return 'La fonte presenta elementi utili per il contesto corrente, ma l’allineamento non è completo.';
    case 'weak':
      return 'La fonte è nel contesto corrente, ma le evidenze disponibili non dimostrano una pertinenza sostanziale.';
  }
}

function buildRationale(
  evidence: LibraryRelevanceCandidate,
  planningMatches: ContextualReviewPlanningMatch[]
): string[] {
  const reasons: string[] = [];

  if (hasLexicalEvidence(evidence)) {
    reasons.push(
      evidence.matchedTerms.length > 0
        ? `La fonte condivide termini con il contesto corrente: ${evidence.matchedTerms.join(', ')}.`
        : 'La fonte condivide termini con il contesto didattico corrente.'
    );
  }
  if (evidence.signals.includes('CURRENT_LESSON')) {
    reasons.push('L’analisi è riferita alla lezione corrente selezionata dal docente.');
  } else if (evidence.signals.includes('CURRENT_UDA')) {
    reasons.push('L’analisi è riferita all’UDA corrente selezionata dal docente.');
  }
  if (planningMatches.length > 0) {
    reasons.push('Sono presenti corrispondenze testuali con elementi curricolari autorevoli della programmazione accettata.');
  }
  if (reasons.length === 0) {
    reasons.push('Il contesto è noto, ma non emergono termini condivisi sufficienti per motivare una pertinenza sostanziale.');
  }

  return reasons;
}

function alignmentStatus(
  _planningContext: LibraryPlanningContextResolution | null,
  matches: ContextualReviewPlanningMatch[]
): 'supported' | 'partial' | 'unverified' {
  if (matches.length > 0) return 'supported';
  return 'unverified';
}

function buildGaps(
  source: LibrarySource,
  evidence: LibraryRelevanceCandidate,
  planningContext: LibraryPlanningContextResolution | null,
  matches: ContextualReviewPlanningMatch[],
  target: { targetType: 'uda' | 'lesson'; targetId: string }
): string[] {
  const gaps: string[] = [];

  if (!hasReadableSourceContent(source)) {
    gaps.push('Manca contenuto testuale leggibile della fonte; l’analisi usa il titolo disponibile.');
  }

  if (!planningContext || planningContext.status !== 'resolved') {
    gaps.push('L’allineamento alla programmazione non è verificabile perché il contesto di programmazione è assente o ambiguo.');
  } else if (!authoritativeArenaContext(planningContext)) {
    gaps.push('Il profilo di programmazione è disponibile, ma manca un contesto Arena autorevole e vigente per verificare un allineamento curricolare specifico.');
  } else if (matches.length === 0) {
    gaps.push('Nessun elemento curricolare autorevole condivide termini sufficienti per dimostrare un allineamento specifico.');
  }

  if (!hasLexicalEvidence(evidence)) {
    gaps.push('La fonte non mostra evidenza lessicale diretta rispetto all’UDA o alla lezione corrente.');
  }

  if (source.links.some(link => link.targetType === target.targetType && link.targetId === target.targetId)) {
    gaps.push('La fonte è già collegata al target didattico corrente.');
  }

  return gaps;
}

function reuseSuggestions(
  source: LibrarySource,
  udas: UdaRecord[],
  teachingContext: ResolvedLibraryTeachingContext,
  planningContext: LibraryPlanningContextResolution | null,
  target: { targetType: 'uda' | 'lesson'; targetId: string }
): ContextualReviewReuseSuggestion[] {
  const resolution = resolveLibraryRelevance({
    source,
    udas,
    teachingContext,
    planningContext
  });
  if (resolution.status !== 'ranked') return [];

  return resolution.candidates
    .filter(candidate => !(candidate.targetType === target.targetType && candidate.targetId === target.targetId))
    .map(candidate => describeLibraryRelevanceCandidate(candidate, udas))
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .slice(0, 3)
    .map(candidate => ({
      targetType: candidate.targetType,
      targetId: candidate.targetId,
      udaId: candidate.udaId,
      title: candidate.title,
      subtitle: candidate.subtitle,
      reasons: [...candidate.reasons]
    }));
}

function confidence(
  source: LibrarySource,
  evidence: LibraryRelevanceCandidate,
  planningContext: LibraryPlanningContextResolution | null,
  matches: ContextualReviewPlanningMatch[]
): ContextualDidacticReviewV2['confidence'] {
  const readable = hasReadableSourceContent(source);
  const lexical = hasLexicalEvidence(evidence);
  const arena = authoritativeArenaContext(planningContext);
  const curriculum = matches.length > 0;

  if (readable && lexical && arena && curriculum) {
    return {
      level: 'high',
      reasons: [
        'È disponibile contenuto leggibile della fonte.',
        'La pertinenza corrente è sostenuta da termini condivisi.',
        'Esiste un contesto curricolare autorevole con una corrispondenza specifica.'
      ]
    };
  }

  if (!readable || !planningContext || planningContext.status !== 'resolved' || (!lexical && !curriculum)) {
    const reasons: string[] = [];
    if (!readable) reasons.push('La fonte è disponibile solo tramite titolo o metadati leggibili.');
    if (!planningContext || planningContext.status !== 'resolved') reasons.push('La programmazione non è risolta in modo univoco.');
    if (!lexical && !curriculum) reasons.push('La conclusione dipende soprattutto dalla presenza nel contesto corrente.');
    return { level: 'low', reasons };
  }

  const evidenceFamilies = [readable, lexical, curriculum].filter(Boolean).length;
  return evidenceFamilies >= 2
    ? {
        level: 'medium',
        reasons: [
          readable ? 'È disponibile contenuto leggibile della fonte.' : '',
          lexical ? 'La fonte condivide termini con il contesto corrente.' : '',
          curriculum ? 'È presente una corrispondenza curricolare specifica.' : 'Il profilo di programmazione è risolto, ma senza una corrispondenza curricolare specifica.'
        ].filter(Boolean)
      }
    : {
        level: 'low',
        reasons: ['Le famiglie di evidenza disponibili non sono sufficienti per un’affidabilità media.']
      };
}

const METHOD_LIMITATIONS = [
  'L’analisi è locale e deterministica: supporta il giudizio professionale del docente e non lo sostituisce.',
  'L’allineamento curricolare è indicato solo quando esistono termini condivisi espliciti; non certifica conformità normativa.'
];

function unavailable(
  reason: 'SOURCE_NOT_PROFESSIONAL' | 'SOURCE_NOT_USABLE' | 'TEACHING_CONTEXT_MISSING',
  limitation: string
): ContextualDidacticReviewResolution {
  return {
    status: 'unavailable',
    reason,
    limitations: [limitation, ...METHOD_LIMITATIONS]
  };
}

export function resolveContextualDidacticReview({
  source,
  udas,
  teachingContext,
  planningContext
}: ResolveContextualDidacticReviewInput): ContextualDidacticReviewResolution {
  if (source.privacy !== 'teacher-professional') {
    return unavailable(
      'SOURCE_NOT_PROFESSIONAL',
      'La fonte deve essere classificata come professionale del docente prima di poter essere analizzata nel dettaglio.'
    );
  }

  if (source.status !== 'captured' && source.status !== 'ready') {
    return unavailable(
      'SOURCE_NOT_USABLE',
      'La fonte non è in uno stato utilizzabile per la revisione contestuale.'
    );
  }

  if (!teachingContext) {
    return unavailable(
      'TEACHING_CONTEXT_MISSING',
      'Serve un contesto didattico valido con UDA e, se disponibile, lezione corrente.'
    );
  }

  const target = currentTarget(teachingContext);
  const evidence = resolveLibraryRelevanceTarget({
    source,
    udas,
    teachingContext,
    planningContext,
    targetType: target.targetType,
    targetId: target.targetId
  });

  if (!evidence) {
    return unavailable(
      'TEACHING_CONTEXT_MISSING',
      'Il contesto didattico selezionato non corrisponde più a un’UDA o a una lezione disponibile.'
    );
  }

  const matches = curriculumMatches(source, planningContext);
  const level = relevanceLevel(evidence, matches);
  const alignment = alignmentStatus(planningContext, matches);
  const planning = planningContext?.status === 'resolved' ? planningContext : null;

  return {
    status: 'reviewed',
    review: {
      schema: 'registro.contextual-didactic-review/v2',
      sourceId: source.id,
      context: {
        className: teachingContext.className,
        udaId: teachingContext.udaId,
        ...(teachingContext.lessonId ? { lessonId: teachingContext.lessonId } : {}),
        ...(planning ? { planningProfileId: planning.profile.id } : {}),
        ...(planning?.arenaContext ? { arenaContextId: planning.arenaContext.id } : {})
      },
      relevance: {
        level,
        statement: relevanceStatement(level)
      },
      rationale: buildRationale(evidence, matches),
      alignment: {
        status: alignment,
        planningMatches: matches
      },
      gaps: buildGaps(source, evidence, planningContext, matches, target),
      reuseSuggestions: reuseSuggestions(source, udas, teachingContext, planningContext, target),
      confidence: confidence(source, evidence, planningContext, matches),
      limitations: [...METHOD_LIMITATIONS]
    }
  };
}
