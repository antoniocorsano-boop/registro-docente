import type { PlanningState } from '../planning/types';
import type { UdaRecord } from '../types';
import {
  normalizeSchoolYear,
  resolveClassGradeLevel,
  resolveLibraryPlanningContext,
  type LibraryPlanningContextResolution
} from './planningContextBridge';
import type {
  LibraryRelevanceCandidate,
  LibraryRelevanceSignal
} from './relevanceResolver';
import type { ResolvedLibraryTeachingContext } from './teachingContext';

export interface LibraryRelevancePresentation {
  targetType: 'uda' | 'lesson';
  targetId: string;
  udaId: string;
  title: string;
  subtitle: string;
  reasons: string[];
  matchedTerms: string[];
}

function normalizeSubject(value: string): string {
  return value.trim().toLocaleLowerCase('it');
}

export function resolvePlanningContextForLibraryRelevance(
  teachingContext: ResolvedLibraryTeachingContext | null,
  planning: PlanningState
): LibraryPlanningContextResolution | null {
  if (!teachingContext) return null;

  const gradeLevel = resolveClassGradeLevel(teachingContext.className);
  if (gradeLevel === null) return null;

  const compatibleProfiles = planning.profiles.filter(profile => profile.gradeLevel === gradeLevel);
  if (compatibleProfiles.length === 0) return null;

  const identities = new Map<string, { schoolYear: string; subjectCode: string }>();

  for (const profile of compatibleProfiles) {
    const schoolYear = normalizeSchoolYear(profile.schoolYear);
    const subjectCode = normalizeSubject(profile.subjectCode);
    if (!schoolYear || !subjectCode) return null;

    identities.set(`${schoolYear}\u0000${subjectCode}`, { schoolYear, subjectCode });
  }

  if (identities.size !== 1) return null;
  const identity = identities.values().next().value as { schoolYear: string; subjectCode: string };

  return resolveLibraryPlanningContext({
    teachingContext,
    planning,
    schoolYear: identity.schoolYear,
    subjectCode: identity.subjectCode
  });
}

function reasonForSignal(signal: LibraryRelevanceSignal): string | null {
  switch (signal) {
    case 'CURRENT_LESSON':
      return 'Lezione corrente';
    case 'CURRENT_UDA':
      return 'UDA corrente';
    case 'CURRENT_CLASS':
      return 'Stessa classe';
    case 'PLANNING_GRADE_MATCH':
      return 'Coerente con il livello della programmazione';
    case 'SOURCE_TITLE_MATCH':
    case 'SOURCE_CONTENT_MATCH':
      return null;
  }
}

function candidateReasons(candidate: LibraryRelevanceCandidate): string[] {
  const reasons = candidate.signals
    .map(reasonForSignal)
    .filter((reason): reason is string => reason !== null);

  const hasLexicalSignal = candidate.signals.includes('SOURCE_TITLE_MATCH')
    || candidate.signals.includes('SOURCE_CONTENT_MATCH');

  if (hasLexicalSignal) {
    reasons.push(
      candidate.matchedTerms.length > 0
        ? `Parole in comune: ${candidate.matchedTerms.join(', ')}`
        : 'Parole in comune'
    );
  }

  return [...new Set(reasons)];
}

export function describeLibraryRelevanceCandidate(
  candidate: LibraryRelevanceCandidate,
  udas: UdaRecord[]
): LibraryRelevancePresentation | null {
  const parentUda = udas.find(uda => uda.id === candidate.udaId);
  if (!parentUda) return null;

  if (candidate.targetType === 'uda') {
    if (candidate.targetId !== parentUda.id) return null;

    return {
      targetType: 'uda',
      targetId: candidate.targetId,
      udaId: parentUda.id,
      title: parentUda.title,
      subtitle: `UDA · ${parentUda.className}`,
      reasons: candidateReasons(candidate),
      matchedTerms: [...candidate.matchedTerms]
    };
  }

  const lesson = (parentUda.lessons ?? []).find(candidateLesson => candidateLesson.id === candidate.targetId);
  if (!lesson) return null;

  return {
    targetType: 'lesson',
    targetId: candidate.targetId,
    udaId: parentUda.id,
    title: lesson.topic,
    subtitle: `Lezione · ${parentUda.title} · ${parentUda.className}`,
    reasons: candidateReasons(candidate),
    matchedTerms: [...candidate.matchedTerms]
  };
}
