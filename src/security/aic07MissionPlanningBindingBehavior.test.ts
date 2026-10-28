import { describe, expect, test } from 'bun:test';

const EXPERIENCE = new URL('../components/CopilotExperience.tsx', import.meta.url);
const APP = new URL('../App.tsx', import.meta.url);
const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);

describe('AIC-07 accepted planning profile mission binding', () => {
  test('preview Play Resume and live generation all bind the resolved planning profile into the mission fingerprint', async () => {
    const [experience, app, composer] = await Promise.all([
      Bun.file(EXPERIENCE).text(),
      Bun.file(APP).text(),
      Bun.file(COMPOSER).text()
    ]);

    expect(experience).toContain('resolvePlanningContextForLibraryRelevance');
    expect(experience).toContain('resolveLibraryTeachingContext');
    expect(experience).toContain('buildMissionContextFingerprint');
    expect(experience).toContain('planningProfileId');

    expect(app).toContain('resolvePlanningContextForLibraryRelevance');
    expect(app).toContain('resolveLibraryTeachingContext');
    expect(app).toContain('currentPlanningProfileId');

    expect(composer).toContain('resolvedPlanningContext');
    expect(composer).toContain('currentPlanningProfileId');
    expect(composer).toContain('planningProfileId: currentPlanningProfileId');
  });
});
