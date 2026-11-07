import { describe, expect, test } from 'bun:test';

describe('INT-01 App runtime boundary', () => {
  test('shares a session-only focus and a class-first frame with CTX-01', async () => {
    const app = await Bun.file('src/App.tsx').text();
    expect(app).toContain('useState<LibraryTeachingContext | null>(null)');
    expect(app).toContain('resolvePlanningFrame(');
    expect(app).toContain('resolveTeachingFocusForClass(');
    expect(app).toContain('buildTeachingUdaCatalog(');
    expect(app).toContain('transitionTeachingFocusForTab(');
    expect(app).toContain('planningFrame:');
    expect(app).toContain('teachingContext:');
  });

  test('does not persist focus in canonical or backup schemas', async () => {
    const sources = await Promise.all([
      'src/types.ts', 'src/planning/types.ts', 'src/security/secureAppStorage.ts',
      'src/security/backupPayload.ts', 'src/library/types.ts',
      'src/memory/types.ts', 'src/copilot/state.ts'
    ].map(path => Bun.file(path).text()));
    for (const src of sources) {
      expect(src).not.toMatch(/(?:teachingFocus|didacticContinuity)\s*:/);
    }
  });
});
