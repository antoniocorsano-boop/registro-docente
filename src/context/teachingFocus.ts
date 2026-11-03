import type { ActiveTab } from '../types';
import type { LibraryTeachingContext, ResolvedLibraryTeachingContext } from '../library/teachingContext';
import type { TeachingUdaCandidate } from '../teaching/teachingUdaCatalog';

export type TeachingFocusReason =
  | 'FOCUS_MISSING'
  | 'CLASS_CONTEXT_MISSING'
  | 'UDA_NOT_FOUND'
  | 'CLASS_MISMATCH'
  | 'LESSON_NOT_FOUND'
  | 'PROJECTED_UDA_LESSON_UNSUPPORTED'
  | 'RESOLVED';

export type TeachingFocusResolution =
  | { status: 'resolved'; reason: 'RESOLVED'; context: ResolvedLibraryTeachingContext }
  | { status: 'unavailable'; reason: Exclude<TeachingFocusReason, 'RESOLVED'> };

export interface ResolveTeachingFocusInput {
  focus: LibraryTeachingContext | null;
  currentClassId: string | null;
  catalog: readonly TeachingUdaCandidate[];
}

export function resolveTeachingFocusForClass({
  focus, currentClassId, catalog
}: ResolveTeachingFocusInput): TeachingFocusResolution {
  if (!focus?.udaId?.trim()) {
    return { status: 'unavailable', reason: 'FOCUS_MISSING' };
  }
  if (!currentClassId?.trim()) {
    return { status: 'unavailable', reason: 'CLASS_CONTEXT_MISSING' };
  }

  const matches = catalog.filter(candidate => candidate.id === focus.udaId);
  if (matches.length !== 1) {
    return { status: 'unavailable', reason: 'UDA_NOT_FOUND' };
  }
  const uda = matches[0]!;
  if (uda.classId !== currentClassId) {
    return { status: 'unavailable', reason: 'CLASS_MISMATCH' };
  }

  const lessonId = focus.lessonId?.trim();
  if (lessonId && !uda.writableByRegistro) {
    return { status: 'unavailable', reason: 'PROJECTED_UDA_LESSON_UNSUPPORTED' };
  }
  const matchingLessons = lessonId
    ? uda.lessons.filter(lesson => lesson.id === lessonId)
    : [];
  if (lessonId && matchingLessons.length !== 1) {
    return { status: 'unavailable', reason: 'LESSON_NOT_FOUND' };
  }
  const lesson = matchingLessons[0];

  return {
    status: 'resolved',
    reason: 'RESOLVED',
    context: {
      udaId: uda.id,
      className: uda.classLabel,
      period: uda.period,
      ...(lesson ? { lessonId: lesson.id } : {}),
      ...(lesson?.activityType ? { activityType: lesson.activityType } : {}),
      udaOrigin: uda.origin,
      writableByRegistro: uda.writableByRegistro
    }
  };
}

export function keepTeachingFocusForClass(
  focus: LibraryTeachingContext | null,
  currentClassId: string | null,
  catalog: readonly TeachingUdaCandidate[]
): LibraryTeachingContext | null {
  const resolution = resolveTeachingFocusForClass({ focus, currentClassId, catalog });
  if (resolution.status !== 'resolved') return null;
  return {
    udaId: resolution.context.udaId,
    ...(resolution.context.lessonId ? { lessonId: resolution.context.lessonId } : {})
  };
}

export function transitionTeachingFocusForTab(
  focus: LibraryTeachingContext | null,
  currentClassId: string | null,
  tab: ActiveTab,
  catalog: readonly TeachingUdaCandidate[]
): LibraryTeachingContext | null {
  if (tab !== 'programmazione' && tab !== 'uda-gantt') return null;
  return keepTeachingFocusForClass(focus, currentClassId, catalog);
}
