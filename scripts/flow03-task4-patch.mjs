import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/App.tsx';
let source = await readFile(path, 'utf8');

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: anchor not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: anchor is not unique`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  'record-session import',
  "import { resolveConductContext } from './conduct/conductSession';\n",
  "import { resolveConductContext } from './conduct/conductSession';\nimport {\n  buildRecordSession,\n  markRecordSessionSaved,\n  routeForRecordEvidence,\n  setRecordEvidenceKind,\n  updateRecordStagedNote,\n  type RecordEvidenceKind,\n  type RecordSessionDraft\n} from './recording/recordSession';\n"
);

replaceOnce(
  'record-session state',
  "  const [activeTab, setActiveTabState] = useState<ActiveTab>('home');\n  const [todayAction, setTodayAction] = useState<TodayAction | null>(null);\n  const navigationVersionRef = useRef(0);\n",
  "  const [activeTab, setActiveTabState] = useState<ActiveTab>('home');\n  const [todayAction, setTodayAction] = useState<TodayAction | null>(null);\n  const [recordSession, setRecordSession] = useState<RecordSessionDraft | null>(null);\n  const recordSessionRef = useRef<RecordSessionDraft | null>(null);\n  const publishRecordSession = useCallback((next: RecordSessionDraft | null) => {\n    recordSessionRef.current = next;\n    setRecordSession(next);\n  }, []);\n  const navigationVersionRef = useRef(0);\n"
);

replaceOnce(
  'popstate clears record session',
  "      setAppData(prev => ({ ...prev, currentClassId: nextCurrentClassId }));\n      setTodayAction(null);\n      setActiveTab(e.state?.tab || (nextCurrentClassId ? 'dashboard' : 'home'));\n",
  "      setAppData(prev => ({ ...prev, currentClassId: nextCurrentClassId }));\n      setTodayAction(null);\n      publishRecordSession(null);\n      setActiveTab(e.state?.tab || (nextCurrentClassId ? 'dashboard' : 'home'));\n"
);

replaceOnce(
  'FLOW-03 App handlers',
  "  const handleContinueFromConductToRecord = useCallback(() => {\n    setTodayAction('record');\n  }, []);\n\n  const handleStartTodayAction = useCallback((action: TodayAction) => {\n    const decision = resolveTodayRoute(action, currentClassIdRef.current);\n    setTodayAction(action);\n    if (decision.status === 'needs-class') {\n      setActiveTab('home');\n      return;\n    }\n    handleNavigateTab(decision.target);\n  }, [handleNavigateTab, setActiveTab]);\n\n  const handleContinueToday = useCallback((tab: ActiveTab) => {\n    setTodayAction(null);\n    handleNavigateTab(tab);\n  }, [handleNavigateTab]);\n\n  const handleCancelTodayAction = useCallback(() => {\n    setTodayAction(null);\n  }, []);\n",
  "  const handleContinueFromConductToRecord = useCallback((stagedNote?: string) => {\n    const selectedClass = appDataRef.current.classes.find(\n      candidate => candidate.id === currentClassIdRef.current\n    );\n    if (!selectedClass) return;\n\n    const session = buildRecordSession({\n      classId: selectedClass.id,\n      className: selectedClass.name,\n      conductContext,\n      stagedNote\n    });\n    publishRecordSession(session);\n    setTodayAction('record');\n  }, [conductContext, publishRecordSession]);\n\n  const completeRecordFlow = useCallback((\n    kind: RecordEvidenceKind,\n    navigationVersionAtSave: number\n  ): boolean => {\n    const session = recordSessionRef.current;\n    if (!session\n      || session.status !== 'editing'\n      || session.evidenceKind !== kind\n      || session.context.classId !== currentClassIdRef.current) {\n      return false;\n    }\n\n    publishRecordSession(markRecordSessionSaved(session));\n    if (navigationVersionRef.current === navigationVersionAtSave) {\n      setActiveTab('dashboard');\n      setTodayAction('record');\n    }\n    return true;\n  }, [publishRecordSession, setActiveTab]);\n\n  const handleChooseRecordEvidence = useCallback((kind: RecordEvidenceKind) => {\n    const session = recordSessionRef.current;\n    if (!session || session.context.classId !== currentClassIdRef.current) return;\n\n    const editingSession = setRecordEvidenceKind(session, kind);\n    publishRecordSession(editingSession);\n    const route = routeForRecordEvidence(kind);\n    setTodayAction('record');\n    setActiveTab(route.tab);\n\n    try {\n      const classId = currentClassIdRef.current;\n      const params = new URLSearchParams();\n      if (classId) params.set('class', classId);\n      params.set('tab', route.tab);\n      history.pushState({ classId, tab: route.tab }, '', `?${params.toString()}`);\n    } catch (e) {}\n  }, [publishRecordSession, setActiveTab]);\n\n  const handleUpdateRecordStagedNote = useCallback((note: string) => {\n    const session = recordSessionRef.current;\n    if (!session || session.context.classId !== currentClassIdRef.current) return;\n    publishRecordSession(updateRecordStagedNote(session, note));\n  }, [publishRecordSession]);\n\n  const handleRecordAnother = useCallback(() => {\n    const session = recordSessionRef.current;\n    if (!session || session.context.classId !== currentClassIdRef.current) return;\n    publishRecordSession({ context: session.context, status: 'choose' });\n    setTodayAction('record');\n    setActiveTab('dashboard');\n  }, [publishRecordSession, setActiveTab]);\n\n  const handleContinueRecordToReview = useCallback(() => {\n    const session = recordSessionRef.current;\n    if (!session || session.context.classId !== currentClassIdRef.current) return;\n    publishRecordSession(null);\n    setTodayAction('review');\n    setActiveTab('dashboard');\n  }, [publishRecordSession, setActiveTab]);\n\n  const handleStartTodayAction = useCallback((action: TodayAction) => {\n    const decision = resolveTodayRoute(action, currentClassIdRef.current);\n    if (action !== 'record') publishRecordSession(null);\n    setTodayAction(action);\n    if (decision.status === 'needs-class') {\n      publishRecordSession(null);\n      setActiveTab('home');\n      return;\n    }\n\n    if (action === 'record') {\n      const selectedClass = appDataRef.current.classes.find(candidate => candidate.id === decision.classId);\n      if (!selectedClass) {\n        publishRecordSession(null);\n        return;\n      }\n      publishRecordSession(buildRecordSession({\n        classId: selectedClass.id,\n        className: selectedClass.name\n      }));\n    }\n    handleNavigateTab(decision.target);\n  }, [handleNavigateTab, publishRecordSession, setActiveTab]);\n\n  const handleContinueToday = useCallback((tab: ActiveTab) => {\n    setTodayAction(null);\n    publishRecordSession(null);\n    handleNavigateTab(tab);\n  }, [handleNavigateTab, publishRecordSession]);\n\n  const handleCancelTodayAction = useCallback(() => {\n    setTodayAction(null);\n    publishRecordSession(null);\n  }, [publishRecordSession]);\n"
);

replaceOnce(
  'class selection session reset',
  "  const handleSelectClass = (classId: string) => {\n    currentClassIdRef.current = classId;\n    setAppData(prev => ({ ...prev, currentClassId: classId }));\n    setActiveTab('dashboard');\n",
  "  const handleSelectClass = (classId: string) => {\n    currentClassIdRef.current = classId;\n    setAppData(prev => ({ ...prev, currentClassId: classId }));\n    const selectedClass = appDataRef.current.classes.find(candidate => candidate.id === classId);\n    publishRecordSession(\n      todayAction === 'record' && selectedClass\n        ? buildRecordSession({ classId: selectedClass.id, className: selectedClass.name })\n        : null\n    );\n    setActiveTab('dashboard');\n"
);

replaceOnce(
  'home clears record session',
  "  const handleNavigateHome = () => {\n    setTodayAction(null);\n    currentClassIdRef.current = null;\n",
  "  const handleNavigateHome = () => {\n    setTodayAction(null);\n    publishRecordSession(null);\n    currentClassIdRef.current = null;\n"
);

replaceOnce(
  'evaluation completion',
  "      afterCommit: () => {\n        setEditingBatchId(null);\n        if (navigationVersionRef.current === navigationVersionAtSave) {\n          setActiveTab('storico');\n        }\n      }\n",
  "      afterCommit: () => {\n        const recordCompleted = completeRecordFlow('evaluation', navigationVersionAtSave);\n        setEditingBatchId(null);\n        if (!recordCompleted && navigationVersionRef.current === navigationVersionAtSave) {\n          setActiveTab('storico');\n        }\n      }\n"
);

replaceOnce(
  'behaviour completion',
  "      afterCommit: () => {\n        if (navigationVersionRef.current === navigationVersionAtSave) {\n          setActiveTab('dashboard');\n        }\n      }\n    }).then(() => undefined);\n  };\n\n  // Edit batch\n",
  "      afterCommit: () => {\n        const recordCompleted = completeRecordFlow('behaviour', navigationVersionAtSave);\n        if (!recordCompleted && navigationVersionRef.current === navigationVersionAtSave) {\n          setActiveTab('dashboard');\n        }\n      }\n    }).then(() => undefined);\n  };\n\n  // Edit batch\n"
);

replaceOnce(
  'online import navigation snapshot',
  "    let importedCount = 0;\n\n    return commitAppDataMutation(current => {\n",
  "    let importedCount = 0;\n    const navigationVersionAtSave = navigationVersionRef.current;\n\n    return commitAppDataMutation(current => {\n"
);

replaceOnce(
  'online import completion',
  "      afterCommit: () => {\n        alert(`Importazione completata con successo! ${importedCount} valutazioni sono state registrate negli elenchi di classe.`);\n      }\n",
  "      afterCommit: () => {\n        alert(`Importazione completata con successo! ${importedCount} valutazioni sono state registrate negli elenchi di classe.`);\n        completeRecordFlow('online-outcomes', navigationVersionAtSave);\n      }\n"
);

replaceOnce(
  'restore clears record session',
  "      currentClassIdRef.current = null;\n      setTodayAction(null);\n      settingsRef.current = restored.settings;\n",
  "      currentClassIdRef.current = null;\n      setTodayAction(null);\n      publishRecordSession(null);\n      settingsRef.current = restored.settings;\n"
);

replaceOnce(
  'factory reset clears record session',
  "      currentClassIdRef.current = null;\n      setTodayAction(null);\n      planningRef.current = resetPlanning;\n",
  "      currentClassIdRef.current = null;\n      setTodayAction(null);\n      publishRecordSession(null);\n      planningRef.current = resetPlanning;\n"
);

replaceOnce(
  'Dashboard FLOW-03 wiring',
  "            onOpenConductCopilot={handleOpenConductCopilot}\n            onGoToRecord={handleContinueFromConductToRecord}\n",
  "            onOpenConductCopilot={handleOpenConductCopilot}\n            onGoToRecord={handleContinueFromConductToRecord}\n            recordSession={recordSession}\n            onChangeRecordStagedNote={handleUpdateRecordStagedNote}\n            onChooseRecordEvidence={handleChooseRecordEvidence}\n            onReviewRecord={handleContinueRecordToReview}\n            onRecordAnother={handleRecordAnother}\n"
);

await writeFile(path, source);
console.log('FLOW-03 Task 4 patch applied fail-closed.');
