import type {
  ArenaPlanningContext,
  PlanningState,
  TeachingProfile
} from './types';

export type PlanningFrameReason =
  | 'CLASS_CONTEXT_MISSING'
  | 'GRADE_LEVEL_UNRESOLVED'
  | 'PLANNING_PROFILE_NOT_FOUND'
  | 'PLANNING_PROFILE_AMBIGUOUS'
  | 'ARENA_CONTEXT_AMBIGUOUS'
  | 'RESOLVED';

export interface ResolvePlanningFrameInput {
  className: string | null | undefined;
  planning: PlanningState;
  schoolYear: string;
  subjectCode: string;
}

export type PlanningFrameResolution =
  | {
      status: 'resolved';
      reason: 'RESOLVED';
      className: string;
      profile: TeachingProfile;
      arenaContext: ArenaPlanningContext | null;
    }
  | {
      status: 'unavailable';
      reason: 'CLASS_CONTEXT_MISSING' | 'GRADE_LEVEL_UNRESOLVED' | 'PLANNING_PROFILE_NOT_FOUND';
    }
  | {
      status: 'ambiguous';
      reason: 'PLANNING_PROFILE_AMBIGUOUS' | 'ARENA_CONTEXT_AMBIGUOUS';
    };

export function resolveClassGradeLevel(className: string): number | null {
  const normalized = className.trim();
  const match = /^([1-5])(?:\s*(?:[ªº^])?\s*[A-Za-zÀ-ÖØ-öø-ÿ])?$/.exec(normalized);
  return match ? Number(match[1]) : null;
}

export function normalizeSchoolYear(value: string): string | null {
  const match = /^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) return null;

  const start = Number(match[1]);
  let end = Number(match[2]);
  if (match[2].length === 2) {
    end = Math.floor(start / 100) * 100 + end;
    if (end <= start) end += 100;
  }
  if (end !== start + 1) return null;
  return String(start).padStart(4, '0') + '-' + String(end).padStart(4, '0');
}

function normalizeSubject(value: string): string {
  return value.trim().toLocaleLowerCase('it');
}

function matchesProfile(
  profile: TeachingProfile,
  schoolYear: string,
  subjectCode: string,
  gradeLevel: number
): boolean {
  const expectedYear = normalizeSchoolYear(schoolYear);
  const profileYear = normalizeSchoolYear(profile.schoolYear);
  if (!expectedYear || !profileYear || profileYear !== expectedYear) return false;
  return normalizeSubject(profile.subjectCode) === normalizeSubject(subjectCode)
    && profile.gradeLevel === gradeLevel;
}

function matchesAuthoritativeArenaContext(
  context: ArenaPlanningContext,
  profile: TeachingProfile
): boolean {
  const contextYear = normalizeSchoolYear(context.schoolYear);
  const profileYear = normalizeSchoolYear(profile.schoolYear);
  const expectedSchoolOrder = profile.schoolOrder === 'primary' ? 'primaria' : 'secondaria';
  const normativeRegime = profile.normativeRegime?.trim();

  return (
    context.profileId === profile.id &&
    contextYear !== null &&
    profileYear !== null &&
    contextYear === profileYear &&
    context.schoolOrder === expectedSchoolOrder &&
    normalizeSubject(context.subjectCode) === normalizeSubject(profile.subjectCode) &&
    context.gradeLevel === profile.gradeLevel &&
    context.cohortRef === profile.cohortRef &&
    normativeRegime !== undefined &&
    normativeRegime.length > 0 &&
    context.regimeRef === profile.normativeRegime &&
    context.privacyClass === 'PROFESSIONAL_NON_PERSONAL' &&
    context.authorityState === 'APPROVED' &&
    context.vigencyStatus === 'VIGENTE'
  );
}

export function resolvePlanningFrame({
  className, planning, schoolYear, subjectCode
}: ResolvePlanningFrameInput): PlanningFrameResolution {
  const currentClass = typeof className === 'string' ? className.trim() : '';
  if (!currentClass) return { status: 'unavailable', reason: 'CLASS_CONTEXT_MISSING' };

  const gradeLevel = resolveClassGradeLevel(currentClass);
  if (gradeLevel === null) {
    return { status: 'unavailable', reason: 'GRADE_LEVEL_UNRESOLVED' };
  }

  const matchingProfiles = planning.profiles.filter(profile =>
    matchesProfile(profile, schoolYear, subjectCode, gradeLevel)
  );
  if (matchingProfiles.length === 0) {
    return { status: 'unavailable', reason: 'PLANNING_PROFILE_NOT_FOUND' };
  }
  if (matchingProfiles.length > 1) {
    return { status: 'ambiguous', reason: 'PLANNING_PROFILE_AMBIGUOUS' };
  }

  const profile = matchingProfiles[0]!;
  const matchingArenaContexts = planning.arenaContexts.filter(context =>
    matchesAuthoritativeArenaContext(context, profile)
  );
  if (matchingArenaContexts.length > 1) {
    return { status: 'ambiguous', reason: 'ARENA_CONTEXT_AMBIGUOUS' };
  }
  return {
    status: 'resolved',
    reason: 'RESOLVED',
    className: currentClass,
    profile,
    arenaContext: matchingArenaContexts[0] ?? null
  };
}
