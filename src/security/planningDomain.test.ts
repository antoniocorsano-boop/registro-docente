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
});
