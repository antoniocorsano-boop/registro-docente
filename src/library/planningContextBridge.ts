import type { PlanningState, TeachingProfile, ArenaPlanningContext } from '../planning/types';
import { resolvePlanningFrame } from '../planning/planningFrameResolver';
import type { ResolvedLibraryTeachingContext } from './teachingContext';

export {
  normalizeSchoolYear,
  resolveClassGradeLevel
} from '../planning/planningFrameResolver';

export type LibraryPlanningContextReason =
  | 'TEACHING_CONTEXT_MISSING'
  | 'GRADE_LEVEL_UNRESOLVED'
  | 'PLANNING_PROFILE_NOT_FOUND'
  | 'PLANNING_PROFILE_AMBIGUOUS'
  | 'ARENA_CONTEXT_AMBIGUOUS'
  | 'RESOLVED';

export interface ResolveLibraryPlanningContextInput {
  teachingContext: ResolvedLibraryTeachingContext | null;
  planning: PlanningState;
  schoolYear: string;
  subjectCode: string;
}

export type LibraryPlanningContextResolution =
  | {
      status: 'resolved';
      reason: 'RESOLVED';
      teachingContext: ResolvedLibraryTeachingContext;
      profile: TeachingProfile;
      arenaContext: ArenaPlanningContext | null;
    }
  | {
      status: 'unavailable';
      reason: 'TEACHING_CONTEXT_MISSING' | 'GRADE_LEVEL_UNRESOLVED' | 'PLANNING_PROFILE_NOT_FOUND';
    }
  | {
      status: 'ambiguous';
      reason: 'PLANNING_PROFILE_AMBIGUOUS' | 'ARENA_CONTEXT_AMBIGUOUS';
    };

export function resolveLibraryPlanningContext({
  teachingContext, planning, schoolYear, subjectCode
}: ResolveLibraryPlanningContextInput): LibraryPlanningContextResolution {
  if (!teachingContext) {
    return { status: 'unavailable', reason: 'TEACHING_CONTEXT_MISSING' };
  }

  const frame = resolvePlanningFrame({
    className: teachingContext.className,
    planning,
    schoolYear,
    subjectCode
  });
  if (frame.status === 'unavailable') {
    return {
      status: 'unavailable',
      reason: frame.reason === 'CLASS_CONTEXT_MISSING'
        ? 'GRADE_LEVEL_UNRESOLVED'
        : frame.reason
    };
  }
  if (frame.status === 'ambiguous') {
    return { status: 'ambiguous', reason: frame.reason };
  }
  return {
    status: 'resolved',
    reason: 'RESOLVED',
    teachingContext,
    profile: frame.profile,
    arenaContext: frame.arenaContext
  };
}
