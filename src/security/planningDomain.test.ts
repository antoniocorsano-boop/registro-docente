import { describe, expect, test } from 'bun:test';

async function loadPlanningModule() {
  const typesUrl = new URL('../planning/types.ts', import.meta.url);
  const emptyStateUrl = new URL('../planning/emptyPlanningState.ts', import.meta.url);

  expect(await Bun.file(typesUrl).exists()).toBe(true);
  expect(await Bun.file(emptyStateUrl).exists()).toBe(true);

  const modulePath = '../planning/' + 'emptyPlanningState';
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
});
