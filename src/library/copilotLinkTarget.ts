import type { ResolvedLibraryTeachingContext } from './teachingContext';
import type { LibrarySourceLink } from './types';

export function resolveCopilotLinkTarget(
  teachingContext: ResolvedLibraryTeachingContext | null
): LibrarySourceLink | null {
  if (!teachingContext) return null;
  if (teachingContext.lessonId) {
    return { targetType: 'lesson', targetId: teachingContext.lessonId };
  }
  return { targetType: 'uda', targetId: teachingContext.udaId };
}
