import type { UdaActivityType, UdaRecord } from '../types';

export interface LibraryTeachingContext {
  udaId: string;
  lessonId?: string;
}

export interface ResolvedLibraryTeachingContext {
  udaId: string;
  className: string;
  period: UdaRecord['period'];
  lessonId?: string;
  activityType?: UdaActivityType;
}

export type TeachingContextSuggestionReason =
  | 'explicit-origin'
  | 'current-class-today-lesson'
  | 'current-class-active-uda'
  | 'session-last-choice';

export interface TeachingContextSuggestion {
  context: LibraryTeachingContext;
  reason: TeachingContextSuggestionReason;
}

export interface SuggestLibraryTeachingContextInput {
  udas: UdaRecord[];
  currentClassName?: string | null;
  explicitContext?: LibraryTeachingContext | null;
  lastExplicitChoice?: LibraryTeachingContext | null;
  today: string;
}

export function resolveLibraryTeachingContext(
  udas: UdaRecord[],
  context: LibraryTeachingContext | null
): ResolvedLibraryTeachingContext | null {
  if (!context?.udaId) return null;

  const uda = udas.find(candidate => candidate.id === context.udaId);
  if (!uda) return null;

  if (!context.lessonId) {
    return {
      udaId: uda.id,
      className: uda.className,
      period: uda.period
    };
  }

  const lesson = (uda.lessons ?? []).find(candidate => candidate.id === context.lessonId);
  if (!lesson) return null;

  return {
    udaId: uda.id,
    className: uda.className,
    period: uda.period,
    lessonId: lesson.id,
    ...(lesson.activityType ? { activityType: lesson.activityType } : {})
  };
}

function normalizedContext(
  resolved: ResolvedLibraryTeachingContext
): LibraryTeachingContext {
  return {
    udaId: resolved.udaId,
    ...(resolved.lessonId ? { lessonId: resolved.lessonId } : {})
  };
}

function schoolMonthIndex(today: string): number | null {
  const match = /^\d{4}-(\d{2})-\d{2}$/.exec(today);
  if (!match) return null;
  const month = Number(match[1]);
  if (month >= 9 && month <= 12) return month - 9;
  if (month >= 1 && month <= 6) return month + 3;
  return null;
}

export function suggestLibraryTeachingContext({
  udas,
  currentClassName = null,
  explicitContext = null,
  lastExplicitChoice = null,
  today
}: SuggestLibraryTeachingContextInput): TeachingContextSuggestion | null {
  if (explicitContext) {
    const resolvedExplicit = resolveLibraryTeachingContext(udas, explicitContext);
    if (resolvedExplicit) {
      return {
        context: normalizedContext(resolvedExplicit),
        reason: 'explicit-origin'
      };
    }
  }

  if (currentClassName) {
    const classUdas = udas.filter(uda => uda.className === currentClassName);
    const todayLessons = classUdas.flatMap(uda =>
      (uda.lessons ?? [])
        .filter(lesson => lesson.date === today)
        .map(lesson => ({ uda, lesson }))
    );

    if (todayLessons.length === 1) {
      const [{ uda, lesson }] = todayLessons;
      return {
        context: { udaId: uda.id, lessonId: lesson.id },
        reason: 'current-class-today-lesson'
      };
    }

    const monthIndex = schoolMonthIndex(today);
    if (monthIndex !== null) {
      const activeUdas = classUdas.filter(uda =>
        monthIndex >= uda.startMonth && monthIndex < uda.startMonth + uda.durationMonths
      );
      if (activeUdas.length === 1) {
        return {
          context: { udaId: activeUdas[0].id },
          reason: 'current-class-active-uda'
        };
      }
    }
  }

  if (lastExplicitChoice) {
    const resolvedLastChoice = resolveLibraryTeachingContext(udas, lastExplicitChoice);
    if (resolvedLastChoice && (!currentClassName || resolvedLastChoice.className === currentClassName)) {
      return {
        context: normalizedContext(resolvedLastChoice),
        reason: 'session-last-choice'
      };
    }
  }

  return null;
}
