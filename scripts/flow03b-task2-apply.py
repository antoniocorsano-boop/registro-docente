from pathlib import Path
import json

# DashboardView
path = Path('src/components/DashboardView.tsx')
text = path.read_text(encoding='utf-8')

anchor = """  onOpenConductCopilot?: () => void;\n  onGoToRecord?: (stagedNote?: string) => void;\n"""
replacement = """  onOpenConductCopilot?: () => void;\n  onOpenRecordCopilot?: () => void;\n  onGoToRecord?: (stagedNote?: string) => void;\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Dashboard prop anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """  onTogglePrivacyShield,\n  onOpenConductCopilot,\n  onGoToRecord,\n"""
replacement = """  onTogglePrivacyShield,\n  onOpenConductCopilot,\n  onOpenRecordCopilot,\n  onGoToRecord,\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Dashboard destructure anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """  const students = currentClass.students || [];\n  const grades = currentClass.grades || [];\n\n"""
replacement = """  const students = currentClass.students || [];\n  const grades = currentClass.grades || [];\n  const isActiveRecordFocus = todayAction === 'record' && recordSession?.status === 'editing';\n\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Dashboard focus anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """          onChooseEvidence={(kind) => onChooseRecordEvidence?.(kind)}\n          onReview={() => onReviewRecord?.()}\n"""
replacement = """          onChooseEvidence={(kind) => onChooseRecordEvidence?.(kind)}\n          onOpenCopilot={() => onOpenRecordCopilot?.()}\n          onReview={() => onReviewRecord?.()}\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Dashboard record panel anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

start_anchor = """      {/* Overview & KPIs */}\n      <div className=\"neon-card neon-card-highlight p-5\">\n"""
start_replacement = """      {/* Overview & KPIs */}\n      <details\n        key={isActiveRecordFocus ? 'focused' : 'full'}\n        data-testid=\"flow03b-class-overview\"\n        open={!isActiveRecordFocus}\n        className={isActiveRecordFocus ? 'neon-card overflow-hidden' : ''}\n      >\n        <summary\n          className={isActiveRecordFocus\n            ? 'min-h-[44px] cursor-pointer list-none px-4 py-3 text-sm font-bold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400'\n            : 'sr-only'}\n        >\n          Panoramica Sezione: {currentClass.name}\n        </summary>\n        <div className=\"neon-card neon-card-highlight p-5\">\n"""
if text.count(start_anchor) != 1:
    raise SystemExit(f'Dashboard overview start anchor count={text.count(start_anchor)}')
text = text.replace(start_anchor, start_replacement, 1)

end_anchor = """      </div>\n\n      {/* Recent Evaluations Activity */}\n"""
end_replacement = """        </div>\n      </details>\n\n      {/* Recent Evaluations Activity */}\n"""
if text.count(end_anchor) != 1:
    raise SystemExit(f'Dashboard overview end anchor count={text.count(end_anchor)}')
text = text.replace(end_anchor, end_replacement, 1)
path.write_text(text, encoding='utf-8')

# RecordLessonPanel
path = Path('src/components/RecordLessonPanel.tsx')
text = path.read_text(encoding='utf-8')
anchor = """  onChooseEvidence: (kind: RecordEvidenceKind) => void;\n  onReview: () => void;\n"""
replacement = """  onChooseEvidence: (kind: RecordEvidenceKind) => void;\n  onOpenCopilot: () => void;\n  onReview: () => void;\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'RecordLesson props anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)
anchor = """  onChangeStagedNote,\n  onChooseEvidence,\n  onReview,\n"""
replacement = """  onChangeStagedNote,\n  onChooseEvidence,\n  onOpenCopilot,\n  onReview,\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'RecordLesson destructure anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)
anchor = """        <button\n          type=\"button\"\n          onClick={onDismiss}\n          aria-label=\"Chiudi Registra\"\n          className=\"min-h-[44px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200\"\n        >\n          Chiudi\n        </button>\n"""
replacement = """        <div className=\"flex shrink-0 flex-wrap justify-end gap-2\">\n          <button\n            type=\"button\"\n            onClick={onOpenCopilot}\n            className=\"min-h-[44px] rounded-xl border border-cyan-300 bg-white px-3 text-sm font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-slate-900 dark:text-cyan-200\"\n          >\n            Copilota\n          </button>\n          <button\n            type=\"button\"\n            onClick={onDismiss}\n            aria-label=\"Chiudi Registra\"\n            className=\"min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200\"\n          >\n            Chiudi\n          </button>\n        </div>\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'RecordLesson header button anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)
path.write_text(text, encoding='utf-8')

# RecordMissionBanner
path = Path('src/components/RecordMissionBanner.tsx')
text = path.read_text(encoding='utf-8')
anchor = """  activityLabel?: string;\n  onReturn: () => void;\n"""
replacement = """  activityLabel?: string;\n  onOpenCopilot: () => void;\n  onReturn: () => void;\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Banner props anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)
anchor = """  udaTitle,\n  activityLabel,\n  onReturn\n"""
replacement = """  udaTitle,\n  activityLabel,\n  onOpenCopilot,\n  onReturn\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Banner destructure anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)
anchor = """      <button\n        type=\"button\"\n        onClick={onReturn}\n        className=\"min-h-[44px] shrink-0 rounded-xl border border-cyan-700 bg-slate-950 px-4 py-2 text-sm font-bold text-cyan-200 transition-colors hover:border-cyan-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400\"\n      >\n        Torna a Registra\n      </button>\n"""
replacement = """      <div className=\"flex shrink-0 flex-wrap gap-2 sm:justify-end\">\n        <button\n          type=\"button\"\n          onClick={onOpenCopilot}\n          className=\"min-h-[44px] rounded-xl border border-cyan-700 bg-slate-950 px-4 py-2 text-sm font-bold text-cyan-200 transition-colors hover:border-cyan-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400\"\n        >\n          Copilota\n        </button>\n        <button\n          type=\"button\"\n          onClick={onReturn}\n          className=\"min-h-[44px] rounded-xl border border-cyan-700 bg-slate-950 px-4 py-2 text-sm font-bold text-cyan-200 transition-colors hover:border-cyan-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400\"\n        >\n          Torna a Registra\n        </button>\n      </div>\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Banner action anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)
path.write_text(text, encoding='utf-8')

# App wiring
path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')
anchor = """            onOpenConductCopilot={handleOpenConductCopilot}\n            onGoToRecord={handleContinueFromConductToRecord}\n"""
replacement = """            onOpenConductCopilot={handleOpenConductCopilot}\n            onOpenRecordCopilot={reopenLibraryCopilot}\n            onGoToRecord={handleContinueFromConductToRecord}\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'App Dashboard wiring anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)
anchor = """            activityLabel={activeRecordMission.context.activityLabel}\n            onReturn={handleReturnToRecord}\n"""
replacement = """            activityLabel={activeRecordMission.context.activityLabel}\n            onOpenCopilot={reopenLibraryCopilot}\n            onReturn={handleReturnToRecord}\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'App banner wiring anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)
anchor = "showClosedTrigger={todayAction !== 'conduct'}"
replacement = "showClosedTrigger={todayAction !== 'conduct' && todayAction !== 'record'}"
if text.count(anchor) != 1:
    raise SystemExit(f'App closed trigger anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)
path.write_text(text, encoding='utf-8')

# Invariant registry
registry_path = Path('qualification/invariants.v1.json')
registry = json.loads(registry_path.read_text(encoding='utf-8'))
invariant = next((item for item in registry['invariants'] if item['id'] == 'FLOW-03-I01'), None)
if invariant is None:
    raise SystemExit('FLOW-03-I01 missing')
test_path = 'src/security/flow03bActiveRecordFocusContract.test.ts'
if test_path not in invariant['impactPaths']:
    invariant['impactPaths'].append(test_path)
if test_path not in invariant['tests']:
    invariant['tests'].append(test_path)
registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
