from pathlib import Path

# App: ambient Copilota is suppressed only while Registra is actively editing.
path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')
old = "showClosedTrigger={todayAction !== 'conduct' && todayAction !== 'record'}"
new = "showClosedTrigger={todayAction !== 'conduct' && !(todayAction === 'record' && recordSession?.status === 'editing')}"
if text.count(old) != 1:
    raise SystemExit(f'App trigger anchor count={text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# RecordLessonPanel: inline Copilota belongs only to the active editing state.
path = Path('src/components/RecordLessonPanel.tsx')
text = path.read_text(encoding='utf-8')
old = '''          <button
            type="button"
            onClick={onOpenCopilot}
            className="min-h-[44px] rounded-xl border border-cyan-300 bg-white px-3 text-sm font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-slate-900 dark:text-cyan-200"
          >
            Copilota
          </button>
'''
new = '''          {session.status === 'editing' && (
            <button
              type="button"
              onClick={onOpenCopilot}
              className="min-h-[44px] rounded-xl border border-cyan-300 bg-white px-3 text-sm font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-slate-900 dark:text-cyan-200"
            >
              Copilota
            </button>
          )}
'''
if text.count(old) != 1:
    raise SystemExit(f'RecordLesson Copilot anchor count={text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
