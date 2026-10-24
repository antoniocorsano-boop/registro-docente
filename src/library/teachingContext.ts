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
