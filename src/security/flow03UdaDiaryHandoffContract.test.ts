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

describe('FLOW-03 UDA diary handoff contract', () => {
  test('defines a session-only lesson prefill and completion callback on the authoritative UDA surface', async () => {
    const gantt = await source('src/components/UdaGanttView.tsx');

    expect(gantt).toContain('export interface RecordLessonPrefill {');
    expect(gantt).toContain('className: string;');
    expect(gantt).toContain('udaId?: string;');
    expect(gantt).toContain('date: string;');
    expect(gantt).toContain('topic?: string;');
    expect(gantt).toContain('notes?: string;');
    expect(gantt).toContain('navigationVersion: number;');
    expect(gantt).toContain('recordLessonPrefill?: RecordLessonPrefill;');
    expect(gantt).toContain('onRecordLessonCommitted?: (udaId: string, navigationVersion: number) => void;');
  });

  test('applies the prefill once, filters to the explicit class and auto-opens only a matching UDA', async () => {
    const gantt = await source('src/components/UdaGanttView.tsx');

    expect(gantt).toContain('const recordLessonPrefillSignatureRef = useRef<string | null>(null);');
    expect(gantt).toContain('if (!recordLessonPrefill) return;');
    expect(gantt).toContain('if (recordLessonPrefillSignatureRef.current === signature) return;');
    expect(gantt).toContain('setSelectedMasterClass(recordLessonPrefill.className);');
    expect(gantt).toContain('setClassFilter(recordLessonPrefill.className);');
    expect(gantt).toContain('setSummaryClassFilter(recordLessonPrefill.className);');
    expect(gantt).toContain("const safeTarget = recordLessonPrefill.udaId\n      ? udas.find(uda => uda.id === recordLessonPrefill.udaId && uda.className === recordLessonPrefill.className)\n      : undefined;");
    expect(gantt).toContain('if (!safeTarget) {');
    expect(gantt).toContain('setSelectedUdaForDetail(null);');
    expect(gantt).toContain('setSelectedUdaForDetail(safeTarget);');
  });

  test('prefills the existing lesson form without writing on mount and keeps fields teacher-editable', async () => {
    const gantt = await source('src/components/UdaGanttView.tsx');

    expect(gantt).toContain('setNewLessonDate(recordLessonPrefill.date);');
    expect(gantt).toContain("setNewLessonTopic(recordLessonPrefill.topic?.trim() || '');");
    expect(gantt).toContain("setNewLessonNotes(recordLessonPrefill.notes?.trim() || '');");
    expect(gantt).toContain('value={newLessonDate}');
    expect(gantt).toContain('onChange={e => setNewLessonDate(e.target.value)}');
    expect(gantt).toContain('value={newLessonTopic}');
    expect(gantt).toContain('onChange={e => setNewLessonTopic(e.target.value)}');
    expect(gantt).toContain('value={newLessonNotes}');
    expect(gantt).toContain('onChange={e => setNewLessonNotes(e.target.value)}');

    const prefillEffect = sectionBetween(gantt, 'const recordLessonPrefillSignatureRef', '}, [recordLessonPrefill, udas]);');
    expect(prefillEffect).not.toContain('onSaveUdas(');
    expect(prefillEffect).not.toContain('commitUdaViewMutation(');
  });

  test('opens the existing planning workspace for FLOW-03 and forwards the governed handoff', async () => {
    const workspace = await source('src/components/UdaWorkspaceView.tsx');

    expect(workspace).toContain("import type { RecordLessonPrefill } from './UdaGanttView.tsx';");
    expect(workspace).toContain('recordLessonPrefill?: RecordLessonPrefill;');
    expect(workspace).toContain('onRecordLessonCommitted?: (udaId: string, navigationVersion: number) => void;');
    expect(workspace).toContain("if (!recordLessonPrefill) return;");
    expect(workspace).toContain("setActiveView('planning');");
    expect(workspace).toContain('setClassFilter(recordLessonPrefill.className);');

    const planning = sectionBetween(workspace, "{activeView === 'planning' && (", "{activeView === 'analysis' && (");
    expect(planning).toContain('recordLessonPrefill={recordLessonPrefill}');
    expect(planning).toContain('onRecordLessonCommitted={onRecordLessonCommitted}');
  });

  test('signals FLOW-03 completion only from the existing successful lesson commit callback', async () => {
    const gantt = await source('src/components/UdaGanttView.tsx');
    const addLesson = sectionBetween(gantt, '// Add lesson to current UDA', '// Remove lesson from UDA');

    expect(addLesson).toContain('void commitUdaViewMutation(nextUdas, () => {');
    expect(addLesson).toContain('onRecordLessonCommitted?.(updatedUda.id, recordLessonPrefill.navigationVersion);');
    expect(addLesson.indexOf('onRecordLessonCommitted?.(')).toBeGreaterThan(addLesson.indexOf("showStatus('Attività registrata nel diario')"));
    expect(addLesson).toContain("setNewLessonTopic('');");
    expect(addLesson).toContain("setNewLessonNotes('');");
  });

  test('captures the current navigation version at UDA lesson submit before persistence and uses that snapshot for completion', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain('const handleRecordLessonSubmitCapture = useCallback(() => {');
    const capture = sectionBetween(app, 'const handleRecordLessonSubmitCapture = useCallback(() => {', 'const handleRecordLessonCommitted = useCallback');
    expect(capture).toContain("session.evidenceKind !== 'lesson-log'");
    expect(capture).toContain('session.context.classId !== currentClassIdRef.current');
    expect(capture).toContain('recordSpecialistNavigationVersionRef.current = navigationVersionRef.current;');

    const committed = sectionBetween(app, 'const handleRecordLessonCommitted = useCallback', 'const handleUpdateRecordStagedNote = useCallback');
    expect(committed).toContain('const navigationVersionAtSave = recordSpecialistNavigationVersionRef.current;');
    expect(committed).toContain('navigationVersionAtSave === null');
    expect(committed).toContain("completeRecordFlow('lesson-log', navigationVersionAtSave, session, session.context.classId);");

    const render = sectionBetween(app, "{activeTab === 'uda-gantt' && (", '{/* TAB 12: Impostazioni & Tema */}');
    expect(render).toContain('<div onSubmitCapture={handleRecordLessonSubmitCapture}>');
    expect(render).toContain('onRecordLessonCommitted={handleRecordLessonCommitted}');
  });

  test('App supplies UDA prefill only for a matching lesson-log session and validates the committed target', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain('const recordSpecialistNavigationVersionRef = useRef<number | null>(null);');
    expect(app).toContain('recordSpecialistNavigationVersionRef.current = navigationVersionRef.current;');
    expect(app).toContain('const handleRecordLessonCommitted = useCallback');
    expect(app).toContain("session.evidenceKind !== 'lesson-log'");
    expect(app).toContain('session.context.udaId && session.context.udaId !== udaId');

    const render = sectionBetween(app, "{activeTab === 'uda-gantt' && (", '{/* TAB 12: Impostazioni & Tema */}');
    expect(render).toContain("recordLessonPrefill={recordSession?.status === 'editing' && recordSession.evidenceKind === 'lesson-log'");
    expect(render).toContain('recordSession.context.classId === currentClass?.id');
    expect(render).toContain('className: recordSession.context.className');
    expect(render).toContain('udaId: recordSession.context.udaId');
    expect(render).toContain('date: today()');
    expect(render).toContain('topic: recordSession.context.activityLabel');
    expect(render).toContain('notes: recordSession.stagedNote');
    expect(render).toContain('navigationVersion: recordSpecialistNavigationVersionRef.current');
    expect(render).toContain('onRecordLessonCommitted={handleRecordLessonCommitted}');
  });
});
