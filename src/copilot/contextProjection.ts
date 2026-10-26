import type { AgentRoutingSurface } from '../library/agentIntent';

export type CopilotLocalSurface =
  | 'global'
  | 'home'
  | 'class-dashboard'
  | 'library'
  | 'uda'
  | 'lesson'
  | 'planning'
  | 'online-tests'
  | 'evaluations'
  | 'other-teacher-surface';

export interface CopilotContextProjectionV1 {
  schema: 'registro.copilot-context/v1';
  surface: CopilotLocalSurface;
  className?: string;
  udaId?: string;
  lessonId?: string;
  sourceId?: string;
  planningProfileId?: string;
  assessmentId?: string;
}

export interface BuildCopilotContextProjectionInput {
  surface: CopilotLocalSurface;
  className?: string | null;
  udaId?: string | null;
  lessonId?: string | null;
  sourceId?: string | null;
  planningProfileId?: string | null;
  assessmentId?: string | null;
}

export interface ResolveCopilotProjectionSurfaceInput {
  ambientSurface?: CopilotLocalSurface | null;
  launchSurface?: CopilotLocalSurface | null;
  hasExplicitTeachingTarget: boolean;
}

export interface CopilotRemoteRoutingProjectionV1 {
  surface: AgentRoutingSurface;
  hasCurrentClass: boolean;
  hasCurrentUda: boolean;
  hasSelectedSource: boolean;
}

function optionalTrimmed(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function resolveCopilotProjectionSurface(
  input: ResolveCopilotProjectionSurfaceInput
): CopilotLocalSurface {
  if (
    input.hasExplicitTeachingTarget
    && (input.launchSurface === 'uda' || input.launchSurface === 'lesson')
  ) {
    return input.launchSurface;
  }

  return input.ambientSurface ?? input.launchSurface ?? 'library';
}

export function buildCopilotContextProjection(
  input: BuildCopilotContextProjectionInput
): CopilotContextProjectionV1 {
  const context: CopilotContextProjectionV1 = {
    schema: 'registro.copilot-context/v1',
    surface: input.surface
  };

  const className = optionalTrimmed(input.className);
  const udaId = optionalTrimmed(input.udaId);
  const lessonId = optionalTrimmed(input.lessonId);
  const sourceId = optionalTrimmed(input.sourceId);
  const planningProfileId = optionalTrimmed(input.planningProfileId);
  const assessmentId = optionalTrimmed(input.assessmentId);

  if (className) context.className = className;
  if (udaId) context.udaId = udaId;
  if (lessonId) context.lessonId = lessonId;
  if (sourceId) context.sourceId = sourceId;
  if (planningProfileId) context.planningProfileId = planningProfileId;
  if (assessmentId) context.assessmentId = assessmentId;

  return context;
}

function toRemoteSurface(surface: CopilotLocalSurface): AgentRoutingSurface {
  if (
    surface === 'home'
    || surface === 'class-dashboard'
    || surface === 'library'
    || surface === 'uda'
    || surface === 'lesson'
    || surface === 'planning'
  ) return surface;

  return 'other-teacher-surface';
}

export function toRemoteRoutingProjection(
  context: CopilotContextProjectionV1
): CopilotRemoteRoutingProjectionV1 {
  return {
    surface: toRemoteSurface(context.surface),
    hasCurrentClass: Boolean(context.className),
    hasCurrentUda: Boolean(context.udaId),
    hasSelectedSource: Boolean(context.sourceId)
  };
}
