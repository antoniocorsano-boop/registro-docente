from pathlib import Path

# Dashboard: active Registra includes choose + editing, excludes saved, and must match current class.
path = Path('src/components/DashboardView.tsx')
text = path.read_text(encoding='utf-8')
old = "  const isActiveRecordFocus = todayAction === 'record' && recordSession?.status === 'editing';"
new = "  const isActiveRecordFocus = todayAction === 'record' && recordSession !== null && recordSession.status !== 'saved' && recordSession.context.classId === currentClass.id;"
if text.count(old) != 1:
    raise SystemExit(f'Dashboard active-focus anchor count={text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# Record panel: inline Copilota is available throughout the unsaved Registra mission.
path = Path('src/components/RecordLessonPanel.tsx')
text = path.read_text(encoding='utf-8')
old = "          {session.status === 'editing' && ("
new = "          {session.status !== 'saved' && ("
if text.count(old) != 1:
    raise SystemExit(f'RecordLessonPanel active-focus anchor count={text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# App: derive one fail-closed same-class active-session signal for the ambient Copilota trigger.
path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')
current_class_anchor = """  const currentClass = appData.classes.find(c => c.id === appData.currentClassId);\n  const conductContext = currentClass\n"""
current_class_replacement = """  const currentClass = appData.classes.find(c => c.id === appData.currentClassId);\n  const isActiveRecordFocus = todayAction === 'record' && recordSession !== null && recordSession.status !== 'saved' && recordSession.context.classId === currentClass?.id;\n  const conductContext = currentClass\n"""
if text.count(current_class_anchor) != 1:
    raise SystemExit(f'App current-class anchor count={text.count(current_class_anchor)}')
text = text.replace(current_class_anchor, current_class_replacement, 1)

trigger_old = "showClosedTrigger={todayAction !== 'conduct' && !(todayAction === 'record' && recordSession?.status === 'editing')}"
trigger_new = "showClosedTrigger={todayAction !== 'conduct' && !isActiveRecordFocus}"
if text.count(trigger_old) != 1:
    raise SystemExit(f'App trigger anchor count={text.count(trigger_old)}')
text = text.replace(trigger_old, trigger_new, 1)
path.write_text(text, encoding='utf-8')
