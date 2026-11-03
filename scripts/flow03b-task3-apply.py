from pathlib import Path
import json

# Pure session-only review routing
routing = Path('src/recording/reviewRouting.ts')
if routing.exists():
    raise SystemExit('reviewRouting.ts already exists')
routing.write_text("""import type { TodayContinuationOption } from '../today/todayRouter';
import type { RecordEvidenceKind } from './recordSession';

const GENERIC_REVIEW_OPTIONS: readonly TodayContinuationOption[] = [
  { tab: 'tabellone', label: 'Tabellone' },
  { tab: 'analytics', label: 'Analisi' },
  { tab: 'storico', label: 'Storico' },
  { tab: 'report', label: 'Scheda alunno' }
];

const REVIEW_OPTIONS_BY_EVIDENCE: Record<RecordEvidenceKind, readonly TodayContinuationOption[]> = {
  evaluation: GENERIC_REVIEW_OPTIONS,
  'online-outcomes': [
    { tab: 'tabellone', label: 'Tabellone' },
    { tab: 'storico', label: 'Storico' },
    { tab: 'analytics', label: 'Analisi' },
    { tab: 'report', label: 'Scheda alunno' }
  ],
  behaviour: [
    { tab: 'report', label: 'Scheda alunno' },
    { tab: 'comportamenti', label: 'Comportamento' },
    { tab: 'analytics', label: 'Analisi' },
    { tab: 'tabellone', label: 'Tabellone' }
  ],
  'lesson-log': [
    { tab: 'uda-gantt', label: 'UDA e diario' },
    { tab: 'tabellone', label: 'Tabellone' },
    { tab: 'analytics', label: 'Analisi' },
    { tab: 'storico', label: 'Storico' }
  ]
};

export function getRecordReviewOptions(
  evidenceKind?: RecordEvidenceKind | null
): readonly TodayContinuationOption[] {
  return evidenceKind ? REVIEW_OPTIONS_BY_EVIDENCE[evidenceKind] : GENERIC_REVIEW_OPTIONS;
}
""", encoding='utf-8')

# App session-only handoff
path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')

anchor = """  const [activeTab, setActiveTabState] = useState<ActiveTab>('home');\n  const [todayAction, setTodayAction] = useState<TodayAction | null>(null);\n  const [recordSession, setRecordSession] = useState<RecordSessionDraft | null>(null);\n"""
replacement = """  const [activeTab, setActiveTabState] = useState<ActiveTab>('home');\n  const [todayAction, setTodayAction] = useState<TodayAction | null>(null);\n  const [reviewEvidenceKind, setReviewEvidenceKind] = useState<RecordEvidenceKind | null>(null);\n  const [recordSession, setRecordSession] = useState<RecordSessionDraft | null>(null);\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'App state anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """  const handleContinueRecordToReview = useCallback(() => {\n    const session = recordSessionRef.current;\n    if (!session || session.context.classId !== currentClassIdRef.current) return;\n    publishRecordSession(null);\n    setTodayAction('review');\n    setActiveTab('dashboard');\n  }, [publishRecordSession, setActiveTab]);\n"""
replacement = """  const handleContinueRecordToReview = useCallback(() => {\n    const session = recordSessionRef.current;\n    if (!session || session.context.classId !== currentClassIdRef.current) return;\n    setReviewEvidenceKind(session.evidenceKind ?? null);\n    publishRecordSession(null);\n    setTodayAction('review');\n    setActiveTab('dashboard');\n  }, [publishRecordSession, setActiveTab]);\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'App review handoff anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """  const handleStartTodayAction = useCallback((action: TodayAction) => {\n    const decision = resolveTodayRoute(action, currentClassIdRef.current);\n"""
replacement = """  const handleStartTodayAction = useCallback((action: TodayAction) => {\n    setReviewEvidenceKind(null);\n    const decision = resolveTodayRoute(action, currentClassIdRef.current);\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'App start Today anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """  const handleContinueToday = useCallback((tab: ActiveTab) => {\n    setTodayAction(null);\n    publishRecordSession(null);\n    handleNavigateTab(tab);\n"""
replacement = """  const handleContinueToday = useCallback((tab: ActiveTab) => {\n    setTodayAction(null);\n    setReviewEvidenceKind(null);\n    publishRecordSession(null);\n    handleNavigateTab(tab);\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'App continue Today anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """  const handleCancelTodayAction = useCallback(() => {\n    setTodayAction(null);\n    publishRecordSession(null);\n"""
replacement = """  const handleCancelTodayAction = useCallback(() => {\n    setTodayAction(null);\n    setReviewEvidenceKind(null);\n    publishRecordSession(null);\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'App cancel Today anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """            todayAction={todayAction}\n            onContinueToday={handleContinueToday}\n"""
replacement = """            todayAction={todayAction}\n            reviewEvidenceKind={reviewEvidenceKind}\n            onContinueToday={handleContinueToday}\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'App Dashboard review prop anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)
path.write_text(text, encoding='utf-8')

# Dashboard contextual order + rationale
path = Path('src/components/DashboardView.tsx')
text = path.read_text(encoding='utf-8')

anchor = """import type { RecordEvidenceKind, RecordSessionDraft } from '../recording/recordSession';\nimport { getTodayContinuationOptions, type TodayAction, type TodayContinuationAction } from '../today/todayRouter';\n"""
replacement = """import type { RecordEvidenceKind, RecordSessionDraft } from '../recording/recordSession';\nimport { getRecordReviewOptions } from '../recording/reviewRouting';\nimport { type TodayAction, type TodayContinuationAction } from '../today/todayRouter';\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Dashboard import anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """  todayAction?: TodayAction | null;\n  onContinueToday?: (tab: ActiveTab) => void;\n"""
replacement = """  todayAction?: TodayAction | null;\n  reviewEvidenceKind?: RecordEvidenceKind | null;\n  onContinueToday?: (tab: ActiveTab) => void;\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Dashboard review prop anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """  onEditBatch,\n  todayAction = null,\n  onContinueToday,\n"""
replacement = """  onEditBatch,\n  todayAction = null,\n  reviewEvidenceKind = null,\n  onContinueToday,\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Dashboard review destructure anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """  const recentActivities = Object.values(groupsMap)\n    .sort((a, b) => b.date.localeCompare(a.date))\n    .slice(0, 5);\n\n"""
replacement = """  const recentActivities = Object.values(groupsMap)\n    .sort((a, b) => b.date.localeCompare(a.date))\n    .slice(0, 5);\n  const recordReviewOptions = getRecordReviewOptions(reviewEvidenceKind);\n\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Dashboard options anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """                <p className=\"text-xs text-slate-400 mt-1\">\n                  Scegli una superficie già esistente per la classe {currentClass.name}.\n                </p>\n"""
replacement = """                <p className=\"text-xs text-slate-400 mt-1\">\n                  Scegli una superficie già esistente per la classe {currentClass.name}.\n                </p>\n                {reviewEvidenceKind && recordReviewOptions[0] && (\n                  <p className=\"mt-1 text-xs font-semibold text-cyan-300\">\n                    Prima destinazione consigliata: {recordReviewOptions[0].label}.\n                  </p>\n                )}\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Dashboard review copy anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)

anchor = """              {getTodayContinuationOptions(todayAction).map(option => (\n"""
replacement = """              {getRecordReviewOptions(reviewEvidenceKind).map(option => (\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'Dashboard review map anchor count={text.count(anchor)}')
text = text.replace(anchor, replacement, 1)
path.write_text(text, encoding='utf-8')

# Invariant registry
registry_path = Path('qualification/invariants.v1.json')
registry = json.loads(registry_path.read_text(encoding='utf-8'))
invariant = next((item for item in registry['invariants'] if item['id'] == 'FLOW-03-I01'), None)
if invariant is None:
    raise SystemExit('FLOW-03-I01 missing')
for impact in [
    'src/recording/reviewRouting.ts',
    'src/security/flow03bContextualReviewContract.test.ts'
]:
    if impact not in invariant['impactPaths']:
        invariant['impactPaths'].append(impact)
test_path = 'src/security/flow03bContextualReviewContract.test.ts'
if test_path not in invariant['tests']:
    invariant['tests'].append(test_path)
registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
