import { describe, expect, test } from 'bun:test';

async function loadPlanningModule() {
  const typesUrl = new URL('../planning/types.ts', import.meta.url);
  const emptyStateUrl = new URL('../planning/emptyPlanningState.ts', import.meta.url);

  expect(await Bun.file(typesUrl).exists()).toBe(true);
  expect(await Bun.file(emptyStateUrl).exists()).toBe(true);

  const modulePath = '../planning/' + 'emptyPlanningState';
  return import(modulePath);
}

async function loadNormativeModule() {
  const moduleUrl = new URL('../planning/normative/italianFirstCycle.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);

  const modulePath = '../planning/normative/' + 'italianFirstCycle';
  return import(modulePath);
}

async function loadPlanningRules() {
  const validationUrl = new URL('../planning/validation.ts', import.meta.url);
  const capacityUrl = new URL('../planning/capacity.ts', import.meta.url);
  expect(await Bun.file(validationUrl).exists()).toBe(true);
  expect(await Bun.file(capacityUrl).exists()).toBe(true);

  const validationPath = '../planning/' + 'validation';
  const capacityPath = '../planning/' + 'capacity';
  return {
    ...(await import(validationPath)),
    ...(await import(capacityPath))
  };
}

function validSecondaryProfile() {
  return {
    id: 'profile-tech-1',
    schoolYear: '2026-2027',
    schoolOrder: 'lower_secondary' as const,
    gradeLevel: 1,
    cohortRef: 'cohort-2026',
    subjectCode: 'tecnologia',
    normativeReference: {
      id: 'norm-tech',
      sourceRef: 'DPR_89_2009_ART5_TABLE_3',
      version: 'DPR-89-2009',
      nationalHoursDefined: true,
      nationalWeeklyHours: 2,
      nationalAnnualHours: 66,
      allocationScope: 'discipline' as const
    },
    reservePercent: 15,
    assessmentPeriods: [
      { id: 'trimestre-1', label: 'Primo periodo', startDate: '2026-09-14', endDate: '2027-01-31', ordinal: 1 },
      { id: 'trimestre-2', label: 'Secondo periodo', startDate: '2027-02-01', endDate: '2027-06-08', ordinal: 2 }
    ],
    calendar: {
      startDate: '2026-09-14',
      endDate: '2027-06-08',
      closureDates: [],
      weeklySlots: [{ id: 'lunedi', weekday: 1 as const, hours: 2 }]
    }
  };
}

describe('EDU-PLAN-01A planning domain', () => {
  test('creates the canonical empty planning state v1', async () => {
    const { createEmptyPlanningState } = await loadPlanningModule();

    expect(createEmptyPlanningState()).toEqual({
      schemaVersion: 1,
      profiles: [],
      arenaContexts: [],
      resources: [],
      masterPrograms: [],
      classInstances: []
    });
  });

  test('does not encode Q1/Q2 as planning-period runtime defaults', async () => {
    const { createEmptyPlanningState } = await loadPlanningModule();
    const state = createEmptyPlanningState();

    expect(JSON.stringify(state)).not.toContain('Q1');
    expect(JSON.stringify(state)).not.toContain('Q2');
  });

  test('returns discipline-specific lower-secondary hours with provenance', async () => {
    const { getFirstCycleNormativeReference } = await loadNormativeModule();

    expect(getFirstCycleNormativeReference({
      schoolOrder: 'lower_secondary',
      subjectCode: 'tecnologia',
      schoolYear: '2026-2027'
    })).toMatchObject({
      nationalHoursDefined: true,
      nationalWeeklyHours: 2,
      nationalAnnualHours: 66,
      allocationScope: 'discipline',
      sourceRef: 'DPR_89_2009_ART5_TABLE_3',
      version: 'DPR-89-2009'
    });

    expect(getFirstCycleNormativeReference({
      schoolOrder: 'lower_secondary',
      subjectCode: 'inglese',
      schoolYear: '2026-2027'
    })).toMatchObject({
      nationalHoursDefined: true,
      nationalWeeklyHours: 3,
      nationalAnnualHours: 99,
      allocationScope: 'discipline'
    });
  });

  test('keeps nationally grouped lower-secondary hours explicit instead of inventing a discipline split', async () => {
    const { getFirstCycleNormativeReference } = await loadNormativeModule();

    expect(getFirstCycleNormativeReference({
      schoolOrder: 'lower_secondary',
      subjectCode: 'italiano',
      schoolYear: '2026-2027'
    })).toMatchObject({
      nationalHoursDefined: true,
      nationalWeeklyHours: 9,
      nationalAnnualHours: 297,
      allocationScope: 'group',
      allocationGroupCode: 'italiano-storia-geografia'
    });
  });

  test('does not invent national discipline hours for primary school', async () => {
    const { getFirstCycleNormativeReference } = await loadNormativeModule();

    const reference = getFirstCycleNormativeReference({
      schoolOrder: 'primary',
      subjectCode: 'tecnologia',
      schoolYear: '2026-2027'
    });

    expect(reference.nationalHoursDefined).toBe(false);
    expect(reference.nationalWeeklyHours).toBeUndefined();
    expect(reference.nationalAnnualHours).toBeUndefined();
    expect(reference.sourceRef).toBeTruthy();
    expect(reference.version).toBeTruthy();
  });

  test('rejects overlapping or reversed assessment periods and invalid reserve percentages', async () => {
    const { validateTeachingProfile } = await loadPlanningRules();
    const profile = validSecondaryProfile();

    const invalid = {
      ...profile,
      reservePercent: 51,
      assessmentPeriods: [
        { ...profile.assessmentPeriods[0], endDate: '2027-02-02' },
        { ...profile.assessmentPeriods[1], startDate: '2027-02-01', endDate: '2027-01-30' }
      ]
    };

    expect(validateTeachingProfile(invalid)).toEqual(expect.arrayContaining([
      'RESERVE_PERCENT_OUT_OF_RANGE',
      'ASSESSMENT_PERIOD_RANGE_INVALID',
      'ASSESSMENT_PERIOD_OVERLAP'
    ]));
  });

  test('requires a local allocation when national primary discipline hours are undefined', async () => {
    const { validateTeachingProfile } = await loadPlanningRules();
    const profile = validSecondaryProfile();

    const primary = {
      ...profile,
      schoolOrder: 'primary' as const,
      normativeReference: {
        id: 'norm-primary-tech',
        sourceRef: 'DPR_89_2009_ART4',
        version: 'DPR-89-2009',
        nationalHoursDefined: false,
        allocationScope: 'institution' as const
      },
      localAllocation: undefined
    };

    expect(validateTeachingProfile(primary)).toContain('LOCAL_ALLOCATION_REQUIRED');
  });

  test('calculates effective class capacity from real weekly slots and closures with a 15 percent reserve', async () => {
    const { calculateEffectiveCapacity } = await loadPlanningRules();
    const profile = validSecondaryProfile();

    const shortWindow = {
      ...profile,
      calendar: {
        startDate: '2026-09-14',
        endDate: '2026-09-21',
        closureDates: ['2026-09-16'],
        weeklySlots: [
          { id: 'lunedi', weekday: 1 as const, hours: 2 },
          { id: 'mercoledi', weekday: 3 as const, hours: 1 }
        ]
      },
      assessmentPeriods: [
        { id: 'periodo-unico-test', label: 'Periodo test', startDate: '2026-09-14', endDate: '2026-09-21', ordinal: 1 }
      ]
    };

    expect(calculateEffectiveCapacity(shortWindow)).toEqual({
      effectiveHours: 4,
      reservePercent: 15,
      reserveHours: 0.6,
      programmableHours: 3.4
    });
  });
});
