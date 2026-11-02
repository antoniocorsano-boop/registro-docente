import {
  buildCopilotContextProjection,
  type CopilotContextProjectionV1,
  type CopilotLocalSurface
} from '../copilot/contextProjection';
import type { CopilotLaunchContext } from '../library/copilotLaunchContext';
import type { LibraryPlanningContextResolution } from '../library/planningContextBridge';
import type {
  LibraryTeachingContext,
  ResolvedLibraryTeachingContext
} from '../library/teachingContext';

export type ProfessionalPrivacyScopeV1 =
  | 'TEACHER_PROFESSIONAL'
  | 'STUDENT_PERSONAL_PRESENT';

export type ProfessionalTimeKindV1 =
  | 'today'
  | 'upcoming'
  | 'past'
  | 'unspecified';

export interface ProfessionalTimeContextV1 {
  kind: ProfessionalTimeKindV1;
  date?: string;
}

export interface ProfessionalContextV1 {
  schema: 'registro.professional-context/v1';
  surface: CopilotLocalSurface;
  classId?: string;
  className?: string;
  udaId?: string;
  lessonId?: string;
  sourceId?: string;
  planningProfileId?: string;
  arenaContextId?: string;
  assessmentId?: string;
  goal?: string;
  time: ProfessionalTimeContextV1;
  privacyScope: ProfessionalPrivacyScopeV1;
}

export interface ResolveProfessionalContextInput {
  surface: CopilotLocalSurface;
  currentClass?: { id: string; name: string } | null;
  teachingContext?: ResolvedLibraryTeachingContext | null;
  planningContext?: LibraryPlanningContextResolution | null;
  sourceId?: string | null;
  assessmentId?: string | null;
  goal?: string | null;
  time?: ProfessionalTimeContextV1 | null;
  privacyScope?: ProfessionalPrivacyScopeV1;
}

export type ProfessionalContextConflictCode =
  | 'CLASS_MISMATCH'
  | 'PLANNING_CONTEXT_AMBIGUOUS';

export type ProfessionalContextResolutionV1 =
  | { status: 'resolved'; context: ProfessionalContextV1 }
  | {
      status: 'conflict';
      conflicts: readonly ProfessionalContextConflictCode[];
    };

function optionalTrimmed(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function resolveProfessionalContext(
  input: ResolveProfessionalContextInput
): ProfessionalContextResolutionV1 {
  const conflicts: ProfessionalContextConflictCode[] = [];
  const currentClassName = optionalTrimmed(input.currentClass?.name);
  const teachingClassName = optionalTrimmed(input.teachingContext?.className);
  const planningClassName = input.planningContext?.status === 'resolved'
    ? optionalTrimmed(input.planningContext.teachingContext.className)
    : undefined;

  const declaredClassNames = [
    currentClassName,
    teachingClassName,
    planningClassName
  ].filter((value): value is string => Boolean(value));

  if (new Set(declaredClassNames).size > 1) {
    conflicts.push('CLASS_MISMATCH');
  }

  if (input.planningContext?.status === 'ambiguous') {
    conflicts.push('PLANNING_CONTEXT_AMBIGUOUS');
  }

  if (conflicts.length > 0) {
    return { status: 'conflict', conflicts };
  }

  const context: ProfessionalContextV1 = {
    schema: 'registro.professional-context/v1',
    surface: input.surface,
    time: input.time ?? { kind: 'unspecified' },
    privacyScope: input.privacyScope ?? 'TEACHER_PROFESSIONAL'
  };

  const classId = optionalTrimmed(input.currentClass?.id);
  if (classId) context.classId = classId;
  if (currentClassName) {
    context.className = currentClassName;
  } else if (teachingClassName) {
    context.className = teachingClassName;
  }

  const udaId = optionalTrimmed(input.teachingContext?.udaId);
  const lessonId = optionalTrimmed(input.teachingContext?.lessonId);
  if (udaId) context.udaId = udaId;
  if (lessonId) context.lessonId = lessonId;

  if (input.planningContext?.status === 'resolved') {
    const planningProfileId = optionalTrimmed(input.planningContext.profile.id);
    const arenaContextId = optionalTrimmed(input.planningContext.arenaContext?.id);
    if (planningProfileId) context.planningProfileId = planningProfileId;
    if (arenaContextId) context.arenaContextId = arenaContextId;
  }

  const sourceId = optionalTrimmed(input.sourceId);
  const assessmentId = optionalTrimmed(input.assessmentId);
  const goal = optionalTrimmed(input.goal);
  if (sourceId) context.sourceId = sourceId;
  if (assessmentId) context.assessmentId = assessmentId;
  if (goal) context.goal = goal;

  return { status: 'resolved', context };
}

export function toCopilotContextProjection(
  context: ProfessionalContextV1
): CopilotContextProjectionV1 {
  return buildCopilotContextProjection({
    surface: context.surface,
    className: context.className,
    udaId: context.udaId,
    lessonId: context.lessonId,
    sourceId: context.sourceId,
    planningProfileId: context.planningProfileId,
    assessmentId: context.assessmentId
  });
}

export function toLibraryTeachingContext(
  context: ProfessionalContextV1
): LibraryTeachingContext | null {
  if (!context.udaId) return null;
  return {
    udaId: context.udaId,
    ...(context.lessonId ? { lessonId: context.lessonId } : {})
  };
}

export function resolveProfessionalContextFromLaunch(
  ambient: ProfessionalContextV1,
  launch: CopilotLaunchContext | null,
  resolvedTeachingContext: ResolvedLibraryTeachingContext | null = null,
  planningContext: LibraryPlanningContextResolution | null = null
): ProfessionalContextResolutionV1 {
  if (!launch) return { status: 'resolved', context: ambient };

  const launchClassName = optionalTrimmed(launch.className);
  if (
    ambient.className
    && launchClassName
    && ambient.className !== launchClassName
  ) {
    return { status: 'conflict', conflicts: ['CLASS_MISMATCH'] };
  }

  return resolveProfessionalContext({
    surface: launch.surface,
    currentClass: ambient.className
      ? { id: ambient.classId ?? '', name: ambient.className }
      : null,
    teachingContext: resolvedTeachingContext,
    planningContext,
    sourceId: launch.sourceId ?? ambient.sourceId,
    assessmentId: ambient.assessmentId,
    goal: ambient.goal,
    time: ambient.time,
    privacyScope: ambient.privacyScope
  });
}
