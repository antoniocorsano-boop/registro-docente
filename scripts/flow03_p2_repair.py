from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()

old = """  const handleRecordLessonCommitted = useCallback((udaId: string, navigationVersionAtSave: number) => {
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

new = """  const handleRecordLessonSubmitCapture = useCallback(() => {
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

if text.count(old) != 1:
    raise SystemExit(f'expected exactly one record completion block, found {text.count(old)}')
text = text.replace(old, new)

old_open = """        {activeTab === 'uda-gantt' && (
          <UdaGanttView"""
new_open = """        {activeTab === 'uda-gantt' && (
          <div onSubmitCapture={handleRecordLessonSubmitCapture}>
            <UdaGanttView"""
if text.count(old_open) != 1:
    raise SystemExit(f'expected exactly one UDA render opening, found {text.count(old_open)}')
text = text.replace(old_open, new_open)

old_close = """            onRecordLessonCommitted={handleRecordLessonCommitted}
            onOpenCopilot={openLibraryCopilot}
          />
        )}

        {/* TAB 12: Impostazioni & Tema */}"""
new_close = """              onRecordLessonCommitted={handleRecordLessonCommitted}
              onOpenCopilot={openLibraryCopilot}
            />
          </div>
        )}

        {/* TAB 12: Impostazioni & Tema */}"""
if text.count(old_close) != 1:
    raise SystemExit(f'expected exactly one UDA render closing, found {text.count(old_close)}')
text = text.replace(old_close, new_close)

path.write_text(text)
