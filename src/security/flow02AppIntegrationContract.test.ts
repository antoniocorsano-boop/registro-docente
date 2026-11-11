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

    expect(launch).toContain("export type LibraryLaunchIntent = 'prepare' | 'conduct' | 'review' | 'link' | 'assessment';");
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

  test('keeps conduct metadata outside direct Library action dispatch', async () => {
    const composer = await source('src/components/LibraryCopilotComposer.tsx');
    const directGate = sectionBetween(
      composer,
      'const hasCompleteDirectLaunch = Boolean(',
      'const teachingSuggestion'
    );

    expect(directGate).toContain("directLaunchIntent === 'prepare'");
    expect(directGate).toContain("directLaunchIntent === 'review'");
    expect(directGate).toContain("directLaunchIntent === 'link'");
    expect(directGate).not.toContain("directLaunchIntent === 'conduct'");
  });

  test('suppresses the ambient Copilot trigger while Conduci owns the contextual entry point', async () => {
    const app = await source('src/App.tsx');
    const experience = await source('src/components/CopilotExperience.tsx');
    const deck = await source('src/components/CopilotDeck.tsx');

    expect(app).toContain("showClosedTrigger={todayAction !== 'conduct'");
    expect(experience).toContain('showClosedTrigger?: boolean;');
    expect(experience).toContain('showClosedTrigger = true');
    expect(experience).toContain('showClosedTrigger={showClosedTrigger}');
    expect(deck).toContain('showClosedTrigger?: boolean;');
    expect(deck).toContain('showClosedTrigger = true');
    expect(deck).toContain("showClosedTrigger && surfaceMode === 'closed' && (");
  });

  test('hands the explicit conduct note to the session-only Registra orchestrator without durable writes', async () => {
    const app = await source('src/App.tsx');
    const handler = sectionBetween(
      app,
      'const handleContinueFromConductToRecord = useCallback((stagedNote?: string) => {',
      'const completeRecordFlow'
    );

    expect(handler).toContain('const selectedClass = appDataRef.current.classes.find(');
    expect(handler).toContain('candidate => candidate.id === currentClassIdRef.current');
    expect(handler).toContain('buildRecordSession({');
    expect(handler).toContain('classId: selectedClass.id');
    expect(handler).toContain('className: selectedClass.name');
    expect(handler).toContain('conductContext');
    expect(handler).toContain('stagedNote');
    expect(handler).toContain('publishRecordSession(session)');
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
