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

describe('FLOW-03 App orchestration contract', () => {
  test('owns the recording draft only in React session state plus a synchronized ref', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain("from './recording/recordSession';");
    expect(app).toContain('const [recordSession, setRecordSession] = useState<RecordSessionDraft | null>(null);');
    expect(app).toContain('const recordSessionRef = useRef<RecordSessionDraft | null>(null);');
    expect(app).toContain('const publishRecordSession = useCallback((next: RecordSessionDraft | null) => {');
    expect(app).toContain('recordSessionRef.current = next;');
    expect(app).toContain('setRecordSession(next);');

    const snapshot = sectionBetween(app, 'const getCompleteCommittedSnapshot', 'const prepareEncryptedBackup');
    expect(snapshot).not.toContain('recordSession');
  });

  test('builds Registra only from the explicit current class and safe Conduci context', async () => {
    const app = await source('src/App.tsx');
    const handoff = sectionBetween(app, 'const handleContinueFromConductToRecord', 'const handleStartTodayAction');

    expect(handoff).toContain('(stagedNote?: string)');
    expect(handoff).toContain('buildRecordSession({');
    expect(handoff).toContain('classId: selectedClass.id');
    expect(handoff).toContain('className: selectedClass.name');
    expect(handoff).toContain('conductContext');
    expect(handoff).toContain('stagedNote');
    expect(handoff).toContain("setTodayAction('record')");
    expect(handoff).not.toContain('secureStorage');
  });

  test('routes evidence through existing tabs without writing and keeps the recording session alive', async () => {
    const app = await source('src/App.tsx');
    const route = sectionBetween(app, 'const handleChooseRecordEvidence', 'const handleUpdateRecordStagedNote');

    expect(route).toContain('recordSessionRef.current');
    expect(route).toContain('session.context.classId !== currentClassIdRef.current');
    expect(route).toContain('setRecordEvidenceKind(session, kind)');
    expect(route).toContain('routeForRecordEvidence(kind)');
    expect(route).toContain('setActiveTab(route.tab)');
    expect(route).not.toContain('commitAppDataMutation');
    expect(route).not.toContain('commitUdasMutation');
    expect(route).not.toContain('secureStorage');
  });

  test('completes only a matching editing session for the same explicit class', async () => {
    const app = await source('src/App.tsx');
    const completion = sectionBetween(app, 'const completeRecordFlow', 'const handleChooseRecordEvidence');

    expect(completion).toContain("session.status !== 'editing'");
    expect(completion).toContain('session.evidenceKind !== kind');
    expect(completion).toContain('session.context.classId !== currentClassIdRef.current');
    expect(completion).toContain('markRecordSessionSaved(session)');
    expect(completion).toContain('navigationVersionRef.current === navigationVersionAtSave');
    expect(completion).toContain("setActiveTab('dashboard')");
    expect(completion).toContain("setTodayAction('record')");
  });

  test('observes authoritative evaluation, behaviour and online-import success only after commit', async () => {
    const app = await source('src/App.tsx');

    const evaluations = sectionBetween(app, 'const handleSaveEvaluations', '// Save behavior notes');
    expect(evaluations).toContain("completeRecordFlow('evaluation', navigationVersionAtSave)");
    expect(evaluations.indexOf("completeRecordFlow('evaluation', navigationVersionAtSave)")).toBeGreaterThan(evaluations.indexOf('afterCommit: () =>'));
    expect(evaluations).toContain("if (!recordCompleted && navigationVersionRef.current === navigationVersionAtSave)");

    const behaviours = sectionBetween(app, 'const handleSaveBehaviors', '// Edit batch');
    expect(behaviours).toContain("completeRecordFlow('behaviour', navigationVersionAtSave)");
    expect(behaviours.indexOf("completeRecordFlow('behaviour', navigationVersionAtSave)")).toBeGreaterThan(behaviours.indexOf('afterCommit: () =>'));

    const imports = sectionBetween(app, 'const handleImportSubmissionsToRegister', '// Save UDAs');
    expect(imports).toContain('const navigationVersionAtSave = navigationVersionRef.current;');
    expect(imports).toContain("completeRecordFlow('online-outcomes', navigationVersionAtSave)");
    expect(imports.indexOf("completeRecordFlow('online-outcomes', navigationVersionAtSave)")).toBeGreaterThan(imports.indexOf('afterCommit: () =>'));
  });

  test('clears stale orchestration on explicit flow exit, class replacement, restore and reset', async () => {
    const app = await source('src/App.tsx');

    const cancel = sectionBetween(app, 'const handleCancelTodayAction', '// Handle Class selection');
    expect(cancel).toContain('publishRecordSession(null)');

    const selectClass = sectionBetween(app, 'const handleSelectClass', 'const handleNavigateHome');
    expect(selectClass).toContain('publishRecordSession(');

    const home = sectionBetween(app, 'const handleNavigateHome', '// Add new class');
    expect(home).toContain('publishRecordSession(null)');

    const restore = sectionBetween(app, 'const handleImportEncryptedBackup', '// Factory Reset');
    expect(restore).toContain('publishRecordSession(null)');

    const reset = sectionBetween(app, 'const handleFactoryReset', 'return (');
    expect(reset).toContain('publishRecordSession(null)');
  });

  test('wires the recording session and its session-only actions into Dashboard', async () => {
    const app = await source('src/App.tsx');
    const dashboard = sectionBetween(app, "{activeTab === 'dashboard' && currentClass && (", '{/* TAB 3: Inserisci Valutazioni */}');

    expect(dashboard).toContain('recordSession={recordSession}');
    expect(dashboard).toContain('onChangeRecordStagedNote={handleUpdateRecordStagedNote}');
    expect(dashboard).toContain('onChooseRecordEvidence={handleChooseRecordEvidence}');
    expect(dashboard).toContain('onReviewRecord={handleContinueRecordToReview}');
    expect(dashboard).toContain('onRecordAnother={handleRecordAnother}');
  });
});
