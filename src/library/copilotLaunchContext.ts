import type { UdaRecord } from '../types';
import {
  resolveLibraryTeachingContext,
  type ResolvedLibraryTeachingContext
} from './teachingContext';

export type CopilotLaunchSurface =
  | 'global'
  | 'home'
  | 'class-dashboard'
  | 'library'
  | 'uda'
  | 'lesson';

export interface CopilotLaunchContext {
  surface: CopilotLaunchSurface;
  className?: string;
  udaId?: string;
  lessonId?: string;
  sourceId?: string;
}

export interface LibraryCopilotLaunchRequest {
  nonce: number;
  context: CopilotLaunchContext;
}

export function resolveLaunchTeachingContext(
  launch: LibraryCopilotLaunchRequest | null,
  udas: UdaRecord[]
): ResolvedLibraryTeachingContext | null {
  if (!launch?.context.udaId) return null;

  const resolved = resolveLibraryTeachingContext(udas, {
    udaId: launch.context.udaId,
    ...(launch.context.lessonId ? { lessonId: launch.context.lessonId } : {})
  });

  if (!resolved) return null;
  if (launch.context.className && launch.context.className !== resolved.className) return null;

  return resolved;
}
