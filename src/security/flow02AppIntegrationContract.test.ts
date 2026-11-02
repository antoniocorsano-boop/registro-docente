import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

function sectionBetween(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe('FLOW-02 App integration contract', () => {
  test('derives conduct context from explicit class, current UDA state and local date only', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain("import { resolveConductContext } from './conduct/conductSession';");
    expect(app).toContain('const conductContext = currentClass');
    expect(app).toContain('resolveConductContext({');
    expect(app).toContain('className: currentClass.name');
    expect(app).toContain('udas');
    expect(app).toContain('todayIsoDate: today()');
  });

  test('opens Copilota with professional conduct identifiers only', async () => {
    const app = await source('src/App.tsx');
    const launch = await source('src/library/copilotLaunchContext.ts');

    expect(launch).toContain("export type LibraryLaunchIntent = 'prepare' | 'conduct' | 'review' | 'link';");
    expect(app).toContain('const handleOpenConductCopilot = useCallback(() => {');

    const handler = sectionBetween(
      app,
      'const handleOpenConductCopilot = useCallback(() => {',
      'const handleContinueFromConductToRecord'
    );

    expect(handler).toContain('if (!conductContext) return;');
    expect(handler).toContain("surface: 'class-dashboard'");
    expect(handler).toContain('className: conductContext.className');
    expect(handler).toContain("intent: 'conduct'");
    expect(handler).toContain("conductContext.status === 'resolved'");
    expect(handler).toContain('udaId: conductContext.udaId');
    expect(handler).toContain('lessonId: conductContext.lessonId');
    expect(handler).toContain('openLibraryCopilot(launchContext)');

    for (const forbidden of [
      'students',
      'grades',
      'behaviors',
      'rapidNote',
      'commitAppDataMutation',
      'commitUdasMutation',
      'commitProfessionalMemoryMutation',
      'secureStorage'
    ]) {
      expect(handler).not.toContain(forbidden);
    }
  });

  test('hands off to Registra by changing only session intent', async () => {
    const app = await source('src/App.tsx');
    const handler = sectionBetween(
      app,
      'const handleContinueFromConductToRecord = useCallback(() => {',
      'const handleStartTodayAction'
    );

    expect(handler).toContain("setTodayAction('record')");
    expect(handler).not.toContain('currentClassIdRef.current =');
    expect(handler).not.toContain('setAppData(');
    expect(handler).not.toContain('commitAppDataMutation');
    expect(handler).not.toContain('commitUdasMutation');
    expect(handler).not.toContain('secureStorage');
  });

  test('does not create a durable conduct-session contract', async () => {
    const app = await source('src/App.tsx');
    const conduct = await source('src/conduct/conductSession.ts');

    expect(app).not.toContain('ConductSessionState');
    expect(app).not.toContain('conductSessionState');
    expect(conduct).not.toContain('secureStorage');
    expect(conduct).not.toContain('AppData');
    expect(conduct).not.toContain('ProfessionalMemoryState');
    expect(conduct).not.toContain('CopilotState');
  });
});
