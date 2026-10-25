import { describe, expect, test } from 'bun:test';
import type {
  ArenaPlanningContext,
  PlanningStateV1,
  TeachingProfile
} from '../planning/types';
import type { ResolvedLibraryTeachingContext } from './teachingContext';

async function loadBridge() {
  const moduleUrl = new URL('./planningContextBridge.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  const modulePath = './' + 'planningContextBridge';
  return import(modulePath);
}

function profile(overrides: Partial<TeachingProfile> = {}): TeachingProfile {
  return {
    id: 'profile-tech-3',
    schoolYear: '2026/27',
    schoolOrder: 'lower_secondary',
    gradeLevel: 3,
    cohortRef: '2026-2027:secondaria:classe-iii',
    subjectCode: 'tecnologia',
    normativeRegime: 'Regime 2025',
    normativeReference: {
      id: 'norm-tech',
      sourceRef: 'DPR_89_2009_ART5_TABLE_3',
      version: 'DPR-89-2009',
      nationalHoursDefined: true,
      nationalWeeklyHours: 2,
      nationalAnnualHours: 66,
      allocationScope: 'discipline'
    },
    reservePercent: 15,
    assessmentPeriods: [],
    calendar: {
      startDate: '2026-09-14',
      endDate: '2027-06-08',
      closureDates: [],
      weeklySlots: []
    },
    ...overrides
  };
}

function arenaContext(
  planningProfile: TeachingProfile,
  overrides: Partial<ArenaPlanningContext> = {}
): ArenaPlanningContext {
  return {
    id: `arena-${planningProfile.id}`,
    profileId: planningProfile.id,
    contract: 'ARENA_REGISTRO_PLANNING_CONTEXT_V1',
    contractVersion: 1,
    sourceProduct: 'ARENA',
    targetProduct: 'REGISTRO_DOCENTE',
    importMode: 'PREVIEW_ONLY',
    acceptanceRequired: true,
    automaticWriteAllowed: false,
    institutionRef: 'IC Test',
    schoolYear: '2026-2027',
    sourceSchoolYear: '2026-2027',
    schoolOrder: 'secondaria',
    subjectCode: planningProfile.subjectCode,
    gradeLevel: planningProfile.gradeLevel,
    cohortRef: planningProfile.cohortRef,
    cohortRefKind: 'DERIVED_APPLICABILITY_KEY',
    applicabilityStatus: 'APPLICABLE',
    regimeRef: planningProfile.normativeRegime ?? 'Regime 2025',
    authorityState: 'APPROVED',
    vigencyStatus: 'VIGENTE',
    authorityReceiptRef: 'receipt-1',
    masterId: 'master-tech-3',
    masterVersion: '1.0.0',
    structuralFingerprint: {
      scope: 'MASTER',
      algorithm: 'fnv1a',
      version: 1,
      hash: '1234abcd'
    },
    provenance: {
      repository: 'antoniocorsano-boop/CurManLight_arena',
      sourceCommit: 'a'.repeat(40),
      sourceDocumentId: 'curricolo-tech',
      sourceRevisionId: 'rev-1'
    },
    curricoloItems: [{
      id: 'curr-tech-3',
      kind: 'ANNUALITA_DISCIPLINARE',
      schoolStage: 'secondaria',
      gradeLabel: 'classe III',
      sourceSection: 'Tecnologia',
      text: 'Contenuto curricolare di prova.'
    }],
    privacyClass: 'PROFESSIONAL_NON_PERSONAL',
    acceptedAt: '2026-10-20T10:00:00.000Z',
    ...overrides
  };
}

function planning(
  profiles: TeachingProfile[],
  arenaContexts: ArenaPlanningContext[] = []
): PlanningStateV1 {
  return {
    schemaVersion: 1,
    profiles,
    arenaContexts,
    resources: [],
    masterPrograms: [],
    classInstances: []
  };
}

const teachingContext: ResolvedLibraryTeachingContext = {
  udaId: 'uda-energia-3c',
  className: '3ª C',
  period: 'Q1'
};

describe('LIB-03A planning context bridge', () => {
  test('resolves common class labels strictly and rejects malformed or out-of-range labels', async () => {
    const { resolveClassGradeLevel } = await loadBridge();

    expect(resolveClassGradeLevel('3ª C')).toBe(3);
    expect(resolveClassGradeLevel('3A')).toBe(3);
    expect(resolveClassGradeLevel('3 A')).toBe(3);
    expect(resolveClassGradeLevel('3^A')).toBe(3);
    expect(resolveClassGradeLevel('classe 3 C')).toBeNull();
    expect(resolveClassGradeLevel('0A')).toBeNull();
    expect(resolveClassGradeLevel('6A')).toBeNull();
    expect(resolveClassGradeLevel('')).toBeNull();
  });

  test('normalizes equivalent academic-year spellings without accepting malformed ranges', async () => {
    const { normalizeSchoolYear } = await loadBridge();

    expect(normalizeSchoolYear('2026-2027')).toBe('2026-2027');
    expect(normalizeSchoolYear('2026/2027')).toBe('2026-2027');
    expect(normalizeSchoolYear('2026/27')).toBe('2026-2027');
    expect(normalizeSchoolYear('2026-2028')).toBeNull();
    expect(normalizeSchoolYear('26/27')).toBeNull();
    expect(normalizeSchoolYear('')).toBeNull();
  });

  test('fails closed when teaching context or grade identity is unavailable', async () => {
    const { resolveLibraryPlanningContext } = await loadBridge();
    const p = profile();

    expect(resolveLibraryPlanningContext({
      teachingContext: null,
      planning: planning([p]),
      schoolYear: '2026-2027',
      subjectCode: 'tecnologia'
    })).toEqual({ status: 'unavailable', reason: 'TEACHING_CONTEXT_MISSING' });

    expect(resolveLibraryPlanningContext({
      teachingContext: { ...teachingContext, className: 'classe terza C' },
      planning: planning([p]),
      schoolYear: '2026-2027',
      subjectCode: 'tecnologia'
    })).toEqual({ status: 'unavailable', reason: 'GRADE_LEVEL_UNRESOLVED' });
  });

  test('returns not found when no planning profile matches year subject and grade', async () => {
    const { resolveLibraryPlanningContext } = await loadBridge();

    expect(resolveLibraryPlanningContext({
      teachingContext,
      planning: planning([profile({ gradeLevel: 2 })]),
      schoolYear: '2026-2027',
      subjectCode: 'tecnologia'
    })).toEqual({ status: 'unavailable', reason: 'PLANNING_PROFILE_NOT_FOUND' });
  });

  test('resolves one compatible planning profile across normalized year and subject variants', async () => {
    const { resolveLibraryPlanningContext } = await loadBridge();
    const p = profile({ schoolYear: '2026/27', subjectCode: ' Tecnologia ' });

    const result = resolveLibraryPlanningContext({
      teachingContext,
      planning: planning([p]),
      schoolYear: '2026/2027',
      subjectCode: 'TECNOLOGIA'
    });

    expect(result).toEqual({
      status: 'resolved',
      reason: 'RESOLVED',
      teachingContext,
      profile: p,
      arenaContext: null
    });
  });

  test('fails closed when more than one planning profile is compatible', async () => {
    const { resolveLibraryPlanningContext } = await loadBridge();
    const first = profile({ id: 'profile-a', cohortRef: 'cohort-a' });
    const second = profile({ id: 'profile-b', cohortRef: 'cohort-b' });

    expect(resolveLibraryPlanningContext({
      teachingContext,
      planning: planning([first, second]),
      schoolYear: '2026-2027',
      subjectCode: 'tecnologia'
    })).toEqual({ status: 'ambiguous', reason: 'PLANNING_PROFILE_AMBIGUOUS' });
  });

  test('attaches the single authoritative Arena context for the resolved profile', async () => {
    const { resolveLibraryPlanningContext } = await loadBridge();
    const p = profile();
    const arena = arenaContext(p);

    const result = resolveLibraryPlanningContext({
      teachingContext,
      planning: planning([p], [arena]),
      schoolYear: '2026-2027',
      subjectCode: 'tecnologia'
    });

    expect(result).toEqual({
      status: 'resolved',
      reason: 'RESOLVED',
      teachingContext,
      profile: p,
      arenaContext: arena
    });
  });

  test('ignores Arena contexts that are provisional non-vigente non-professional or identity-mismatched', async () => {
    const { resolveLibraryPlanningContext } = await loadBridge();
    const p = profile();
    const contexts = [
      arenaContext(p, { id: 'provisional', authorityState: 'PROVISIONAL_COMPLETE', vigencyStatus: 'NON_VIGENTE', authorityReceiptRef: null }),
      arenaContext(p, { id: 'non-vigente', vigencyStatus: 'NON_VIGENTE', authorityReceiptRef: null }),
      arenaContext(p, { id: 'wrong-grade', gradeLevel: 2 }),
      arenaContext(p, { id: 'wrong-cohort', cohortRef: 'other-cohort' })
    ];

    const result = resolveLibraryPlanningContext({
      teachingContext,
      planning: planning([p], contexts),
      schoolYear: '2026-2027',
      subjectCode: 'tecnologia'
    });

    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') expect(result.arenaContext).toBeNull();
  });

  test('fails closed when multiple authoritative Arena contexts match the resolved profile', async () => {
    const { resolveLibraryPlanningContext } = await loadBridge();
    const p = profile();
    const first = arenaContext(p, { id: 'arena-a', masterVersion: '1.0.0' });
    const second = arenaContext(p, { id: 'arena-b', masterVersion: '1.1.0', acceptedAt: '2026-10-24T10:00:00.000Z' });

    expect(resolveLibraryPlanningContext({
      teachingContext,
      planning: planning([p], [first, second]),
      schoolYear: '2026-2027',
      subjectCode: 'tecnologia'
    })).toEqual({ status: 'ambiguous', reason: 'ARENA_CONTEXT_AMBIGUOUS' });
  });
});
