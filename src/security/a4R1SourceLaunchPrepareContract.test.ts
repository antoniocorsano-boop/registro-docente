import { describe, expect, test } from 'bun:test';

const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);

async function readComposer(): Promise<string> {
  return Bun.file(COMPOSER).text();
}

describe('A4-R1 source-launched PREPARE contract', () => {
  test('keeps PREPARE inside the teacher-first governed handoff when source/context are already bound', async () => {
    const composer = await readComposer();
    const start = composer.indexOf('const chooseTeacherFirstGoal');
    const end = composer.indexOf('const handleTeacherFirstProceed', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const chooseGoal = composer.slice(start, end);
    expect(chooseGoal).toContain("goal === 'prepare'");
    expect(chooseGoal).toMatch(/hasBoundLaunchContext[^\n]*goal === 'prepare'/);
    expect(chooseGoal).toContain('setTeacherFirstResolution({ ...framed, goalKind: goal })');
  });

  test('teacher-first PREPARE opens the existing governed proposal disclosure without remote execution', async () => {
    const composer = await readComposer();
    const start = composer.indexOf('const handleTeacherFirstProceed');
    const end = composer.indexOf('const handleResolve', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const proceed = composer.slice(start, end);
    expect(proceed).toContain("teacherFirstResolution.goalKind === 'prepare'");
    expect(proceed).toContain('setIsPrepareOpen(true)');
    expect(proceed).not.toContain('requestLibraryTeachingProposal');
  });
});
