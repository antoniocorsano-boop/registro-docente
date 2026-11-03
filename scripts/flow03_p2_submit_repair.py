from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

# App: remove the ancestor submit-capture workaround and expose the live navigation getter.
app_path = Path('src/App.tsx')
app = app_path.read_text()

old_handler = """  const handleRecordLessonSubmitCapture = useCallback(() => {
    const session = recordSessionRef.current;
    if (
      !session ||
      session.status !== 'editing' ||
      session.evidenceKind !== 'lesson-log' ||
      session.context.classId !== currentClassIdRef.current
    ) {
      return;
    }

    recordSpecialistNavigationVersionRef.current = navigationVersionRef.current;
  }, []);

  const handleRecordLessonCommitted = useCallback((udaId: string, _navigationVersionFromPrefill: number) => {
    const session = recordSessionRef.current;
    const navigationVersionAtSave = recordSpecialistNavigationVersionRef.current;
    if (
      !session ||
      navigationVersionAtSave === null ||
      session.status !== 'editing' ||
      session.evidenceKind !== 'lesson-log' ||
      session.context.classId !== currentClassIdRef.current ||
      (session.context.udaId && session.context.udaId !== udaId)
    ) {
      return;
    }

    const completed = completeRecordFlow('lesson-log', navigationVersionAtSave, session, session.context.classId);
    if (completed) {
      recordSpecialistNavigationVersionRef.current = null;
    }
  }, [completeRecordFlow]);"""

new_handler = """  const handleRecordLessonCommitted = useCallback((udaId: string, navigationVersionAtSave: number) => {
    const session = recordSessionRef.current;
    if (
      !session ||
      session.status !== 'editing' ||
      session.evidenceKind !== 'lesson-log' ||
      session.context.classId !== currentClassIdRef.current ||
      (session.context.udaId && session.context.udaId !== udaId)
    ) {
      return;
    }

    const completed = completeRecordFlow('lesson-log', navigationVersionAtSave, session, session.context.classId);
    if (completed) {
      recordSpecialistNavigationVersionRef.current = null;
    }
  }, [completeRecordFlow]);"""
app = replace_once(app, old_handler, new_handler, 'App handler')

old_render = """        {activeTab === 'uda-gantt' && (
          <div onSubmitCapture={handleRecordLessonSubmitCapture}>
            <UdaGanttView
            classes={appData.classes}
            udas={udas}
            settings={settings}
            tests={tests}
            onSaveUdas={handleSaveUdas}
            onNavigateTab={handleNavigateTab}
            recordLessonPrefill={recordSession?.status === 'editing' && recordSession.evidenceKind === 'lesson-log'
              && recordSession.context.classId === currentClass?.id
              && recordSpecialistNavigationVersionRef.current !== null
              ? {
                  className: recordSession.context.className,
                  udaId: recordSession.context.udaId,
                  date: today(),
                  topic: recordSession.context.activityLabel,
                  notes: recordSession.stagedNote,
                  navigationVersion: recordSpecialistNavigationVersionRef.current
                }
              : undefined}
              onRecordLessonCommitted={handleRecordLessonCommitted}
              onOpenCopilot={openLibraryCopilot}
            />
          </div>
        )}"""

new_render = """        {activeTab === 'uda-gantt' && (
          <UdaGanttView
            classes={appData.classes}
            udas={udas}
            settings={settings}
            tests={tests}
            onSaveUdas={handleSaveUdas}
            onNavigateTab={handleNavigateTab}
            recordLessonPrefill={recordSession?.status === 'editing' && recordSession.evidenceKind === 'lesson-log'
              && recordSession.context.classId === currentClass?.id
              && recordSpecialistNavigationVersionRef.current !== null
              ? {
                  className: recordSession.context.className,
                  udaId: recordSession.context.udaId,
                  date: today(),
                  topic: recordSession.context.activityLabel,
                  notes: recordSession.stagedNote,
                  navigationVersion: recordSpecialistNavigationVersionRef.current
                }
              : undefined}
            getRecordLessonNavigationVersion={() => navigationVersionRef.current}
            onRecordLessonCommitted={handleRecordLessonCommitted}
            onOpenCopilot={openLibraryCopilot}
          />
        )}"""
app = replace_once(app, old_render, new_render, 'App UDA render')
app_path.write_text(app)

# UDA authoritative form: snapshot navigation exactly when the lesson is submitted.
uda_path = Path('src/components/UdaGanttView.tsx')
uda = uda_path.read_text()

uda = replace_once(
    uda,
    """  recordLessonPrefill?: RecordLessonPrefill;
  onRecordLessonCommitted?: (udaId: string, navigationVersion: number) => void;""",
    """  recordLessonPrefill?: RecordLessonPrefill;
  getRecordLessonNavigationVersion?: () => number;
  onRecordLessonCommitted?: (udaId: string, navigationVersion: number) => void;""",
    'UDA props interface'
)

uda = replace_once(
    uda,
    """  onNavigateTab,
  recordLessonPrefill,
  onRecordLessonCommitted
}) => {""",
    """  onNavigateTab,
  recordLessonPrefill,
  getRecordLessonNavigationVersion,
  onRecordLessonCommitted
}) => {""",
    'UDA props destructuring'
)

uda = replace_once(
    uda,
    """  const handleAddLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUdaForDetail || !newLessonTopic.trim()) return;

    const newLesson: UdaLesson = {""",
    """  const handleAddLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUdaForDetail || !newLessonTopic.trim()) return;

    const navigationVersionAtSave = getRecordLessonNavigationVersion?.();
    const newLesson: UdaLesson = {""",
    'UDA submit snapshot'
)

uda = replace_once(
    uda,
    """      if (
        recordLessonPrefill &&
        recordLessonPrefill.className === updatedUda.className &&
        (!recordLessonPrefill.udaId || recordLessonPrefill.udaId === updatedUda.id)
      ) {
        onRecordLessonCommitted?.(updatedUda.id, recordLessonPrefill.navigationVersion);
      }""",
    """      if (
        recordLessonPrefill &&
        navigationVersionAtSave !== undefined &&
        recordLessonPrefill.className === updatedUda.className &&
        (!recordLessonPrefill.udaId || recordLessonPrefill.udaId === updatedUda.id)
      ) {
        onRecordLessonCommitted?.(updatedUda.id, navigationVersionAtSave);
      }""",
    'UDA completion callback'
)
uda_path.write_text(uda)

# Browser regression: navigate away and back before submitting the prefilled UDA lesson.
browser_path = Path('tests/browser/flow-03-registra.spec.cjs')
browser = browser_path.read_text()
old_browser = """    await page.screenshot({ path: evidencePath('flow-03-mobile-uda-prefill.png'), fullPage: true });

    await topic.fill(LESSON_TOPIC);"""
new_browser = """    await page.screenshot({ path: evidencePath('flow-03-mobile-uda-prefill.png'), fullPage: true });

    // Regression: navigation before submit must not leave the later durable save stuck in editing.
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    let drawer = page.getByRole('complementary');
    await drawer.getByRole('button', { name: 'Impostazioni', exact: true }).click();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    drawer = page.getByRole('complementary');
    await drawer.getByRole('button', { name: 'UDA', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Pianificazione UDA' })).toBeVisible();
    await expect(topic).toBeVisible();
    await expect(topic).toHaveValue(UDA_TITLE);
    await expect(notes).toHaveValue(RAPID_NOTE);

    await topic.fill(LESSON_TOPIC);"""
browser = replace_once(browser, old_browser, new_browser, 'Browser navigation regression')
browser_path.write_text(browser)
