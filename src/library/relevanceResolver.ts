import type { UdaRecord } from '../types';
import { resolveClassGradeLevel, type LibraryPlanningContextResolution } from './planningContextBridge';
import type { ResolvedLibraryTeachingContext } from './teachingContext';
import type { LibrarySource } from './types';

export type LibraryRelevanceSignal =
  | 'CURRENT_LESSON'
  | 'CURRENT_UDA'
  | 'CURRENT_CLASS'
  | 'PLANNING_GRADE_MATCH'
  | 'SOURCE_TITLE_MATCH'
  | 'SOURCE_CONTENT_MATCH';

export interface LibraryRelevanceCandidate {
  targetType: 'uda' | 'lesson';
  targetId: string;
  udaId: string;
  score: number;
  signals: LibraryRelevanceSignal[];
  matchedTerms: string[];
}

export interface ResolveLibraryRelevanceInput {
  source: LibrarySource;
  udas: UdaRecord[];
  teachingContext?: ResolvedLibraryTeachingContext | null;
  planningContext?: LibraryPlanningContextResolution | null;
}

export type LibraryRelevanceResolution =
  | {
      status: 'ranked';
      candidates: LibraryRelevanceCandidate[];
    }
  | {
      status: 'unavailable';
      reason: 'SOURCE_AND_CONTEXT_UNAVAILABLE' | 'NO_RELEVANT_CANDIDATE';
      candidates: [];
    };

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

function intersect(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter(token => right.has(token)).sort((a, b) => a.localeCompare(b, 'it'));
}

function mergeTerms(...groups: string[][]): string[] {
  return [...new Set(groups.flat())].sort((a, b) => a.localeCompare(b, 'it'));
}

function lexicalScore(
  sourceTitle: Set<string>,
  sourceContent: Set<string>,
  primary: Set<string>,
  support: Set<string>
): Pick<LibraryRelevanceCandidate, 'score' | 'signals' | 'matchedTerms'> {
  const titlePrimary = intersect(sourceTitle, primary);
  const titleSupport = intersect(sourceTitle, support);
  const contentPrimary = intersect(sourceContent, primary);
  const contentSupport = intersect(sourceContent, support);

  const score =
    titlePrimary.length * 20 +
    titleSupport.length * 8 +
    contentPrimary.length * 6 +
    contentSupport.length * 2;

  const signals: LibraryRelevanceSignal[] = [];
  if (titlePrimary.length > 0 || titleSupport.length > 0) {
    signals.push('SOURCE_TITLE_MATCH');
  }
  if (contentPrimary.length > 0 || contentSupport.length > 0) {
    signals.push('SOURCE_CONTENT_MATCH');
  }

  return {
    score,
    signals,
    matchedTerms: mergeTerms(titlePrimary, titleSupport, contentPrimary, contentSupport)
  };
}

function sourceContentTokens(source: LibrarySource): Set<string> {
  return tokenize([
    source.extractedText,
    source.payload.text,
    source.notes
  ].filter((value): value is string => typeof value === 'string').join(' '));
}

function udaSupportTokens(candidate: UdaRecord): Set<string> {
  return tokenize([
    candidate.description,
    candidate.competencies,
    candidate.authenticTask
  ].filter((value): value is string => typeof value === 'string').join(' '));
}

function lessonSupportTokens(candidate: UdaRecord, notes: string | undefined): Set<string> {
  return tokenize([
    notes,
    candidate.title,
    candidate.description,
    candidate.competencies,
    candidate.authenticTask
  ].filter((value): value is string => typeof value === 'string').join(' '));
}

function isAlreadyLinked(
  source: LibrarySource,
  targetType: 'uda' | 'lesson',
  targetId: string
): boolean {
  return source.links.some(link => link.targetType === targetType && link.targetId === targetId);
}

function planningGradeMatches(
  className: string,
  planningContext: LibraryPlanningContextResolution | null | undefined
): boolean {
  return planningContext?.status === 'resolved'
    && resolveClassGradeLevel(className) === planningContext.profile.gradeLevel;
}

function contextualScore(
  candidate: UdaRecord,
  targetType: 'uda' | 'lesson',
  targetId: string,
  teachingContext: ResolvedLibraryTeachingContext | null | undefined,
  planningContext: LibraryPlanningContextResolution | null | undefined
): Pick<LibraryRelevanceCandidate, 'score' | 'signals'> {
  let score = 0;
  const signals: LibraryRelevanceSignal[] = [];

  const isCurrentUda = teachingContext?.udaId === candidate.id;
  const isCurrentLesson = targetType === 'lesson'
    && isCurrentUda
    && teachingContext?.lessonId === targetId;

  if (isCurrentLesson) {
    score += 100;
    signals.push('CURRENT_LESSON');
  }
  if (isCurrentUda) {
    score += 80;
    signals.push('CURRENT_UDA');
  }
  if (teachingContext?.className === candidate.className) {
    score += 30;
    signals.push('CURRENT_CLASS');
  }
  if (planningGradeMatches(candidate.className, planningContext)) {
    score += 15;
    signals.push('PLANNING_GRADE_MATCH');
  }

  return { score, signals };
}

function compareCandidates(
  left: LibraryRelevanceCandidate,
  right: LibraryRelevanceCandidate
): number {
  if (left.score !== right.score) return right.score - left.score;
  if (left.targetType !== right.targetType) return left.targetType === 'uda' ? -1 : 1;
  return left.targetId.localeCompare(right.targetId, 'it');
}

export function resolveLibraryRelevance({
  source,
  udas,
  teachingContext,
  planningContext
}: ResolveLibraryRelevanceInput): LibraryRelevanceResolution {
  const sourceTitle = tokenize(source.title);
  const sourceContent = sourceContentTokens(source);

  if (sourceTitle.size === 0 && sourceContent.size === 0 && !teachingContext) {
    return {
      status: 'unavailable',
      reason: 'SOURCE_AND_CONTEXT_UNAVAILABLE',
      candidates: []
    };
  }

  const candidates: LibraryRelevanceCandidate[] = [];

  for (const candidate of udas) {
    if (!isAlreadyLinked(source, 'uda', candidate.id)) {
      const lexical = lexicalScore(
        sourceTitle,
        sourceContent,
        tokenize(candidate.title),
        udaSupportTokens(candidate)
      );
      const contextual = contextualScore(
        candidate,
        'uda',
        candidate.id,
        teachingContext,
        planningContext
      );
      const score = lexical.score + contextual.score;

      if (score > 0) {
        candidates.push({
          targetType: 'uda',
          targetId: candidate.id,
          udaId: candidate.id,
          score,
          signals: [...contextual.signals, ...lexical.signals],
          matchedTerms: lexical.matchedTerms
        });
      }
    }

    for (const lesson of candidate.lessons ?? []) {
      if (isAlreadyLinked(source, 'lesson', lesson.id)) continue;

      const lexical = lexicalScore(
        sourceTitle,
        sourceContent,
        tokenize(lesson.topic),
        lessonSupportTokens(candidate, lesson.notes)
      );
      const contextual = contextualScore(
        candidate,
        'lesson',
        lesson.id,
        teachingContext,
        planningContext
      );
      const score = lexical.score + contextual.score;

      if (score > 0) {
        candidates.push({
          targetType: 'lesson',
          targetId: lesson.id,
          udaId: candidate.id,
          score,
          signals: [...contextual.signals, ...lexical.signals],
          matchedTerms: lexical.matchedTerms
        });
      }
    }
  }

  candidates.sort(compareCandidates);

  if (candidates.length === 0) {
    return {
      status: 'unavailable',
      reason: 'NO_RELEVANT_CANDIDATE',
      candidates: []
    };
  }

  return { status: 'ranked', candidates };
}
