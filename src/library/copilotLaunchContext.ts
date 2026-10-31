import type { UdaRecord } from '../types';
import type { TeachingUdaCandidate } from '../teaching/teachingUdaCatalog';
import type { CopilotLocalSurface } from '../copilot/contextProjection';
import {
  resolveLibraryTeachingContext,
  resolveLibraryTeachingContextFromCatalog,
  type ResolvedLibraryTeachingContext
} from './teachingContext';

export type CopilotLaunchSurface = CopilotLocalSurface;
export type LibraryLaunchIntent = 'prepare' | 'review' | 'link';

export interface CopilotLaunchContext {
  surface: CopilotLaunchSurface;
  className?: string;
  udaId?: string;
  lessonId?: string;
  sourceId?: string;
  teachingContextMode?: 'explicit' | 'proposed';
  intent?: LibraryLaunchIntent;
}

export interface CopilotMissionLaunchV1 {
  missionId: string;
  objective: string;
}

export interface LibraryCopilotLaunchRequest {
  nonce: number;
  context: CopilotLaunchContext;
  mission?: CopilotMissionLaunchV1;
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

export function resolveLaunchTeachingContextFromCatalog(
  launch: LibraryCopilotLaunchRequest | null,
  catalog: readonly TeachingUdaCandidate[]
): ResolvedLibraryTeachingContext | null {
  if (!launch?.context.udaId) return null;

  const resolved = resolveLibraryTeachingContextFromCatalog(catalog, {
    udaId: launch.context.udaId,
    ...(launch.context.lessonId ? { lessonId: launch.context.lessonId } : {})
  });

  if (!resolved) return null;
  if (launch.context.className && launch.context.className !== resolved.className) return null;

  return resolved;
}