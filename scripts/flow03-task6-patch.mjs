import fs from 'node:fs';

function replaceOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  return text.replace(before, after);
}

const ganttPath = 'src/components/UdaGanttView.tsx';
let gantt = fs.readFileSync(ganttPath, 'utf8');

gantt = replaceOnce(
  gantt,
  `interface UdaGanttViewProps {\n  classes: ClassData[];\n  udas: UdaRecord[];\n  settings?: AppSettings;\n  tests?: Record<string, OnlineTest>;\n  onSaveUdas: (udas: UdaRecord[]) => Promise<void>;\n  onNavigateTab?: (tab: any) => void;\n}`,
  `export interface RecordLessonPrefill {\n  className: string;\n  udaId?: string;\n  date: string;\n  topic?: string;\n  notes?: string;\n  navigationVersion: number;\n}\n\ninterface UdaGanttViewProps {\n  classes: ClassData[];\n  udas: UdaRecord[];\n  settings?: AppSettings;\n  tests?: Record<string, OnlineTest>;\n  onSaveUdas: (udas: UdaRecord[]) => Promise<void>;\n  onNavigateTab?: (tab: any) => void;\n  recordLessonPrefill?: RecordLessonPrefill;\n  onRecordLessonCommitted?: (udaId: string, navigationVersion: number) => void;\n}`,
  'gantt props'
);

gantt = replaceOnce(
  gantt,
  `  tests = {},\n  onSaveUdas,\n  onNavigateTab\n}) => {`,
  `  tests = {},\n  onSaveUdas,\n  onNavigateTab,\n  recordLessonPrefill,\n  onRecordLessonCommitted\n}) => {`,
  'gantt destructure'
);

gantt = replaceOnce(
  gantt,
  `  const [newLessonNotes, setNewLessonNotes] = useState('');\n  const [newLessonType, setNewLessonType] = useState<UdaActivityType>('teoria');\n\n  // Months full Italian naming`,
  `  const [newLessonNotes, setNewLessonNotes] = useState('');\n  const [newLessonType, setNewLessonType] = useState<UdaActivityType>('teoria');\n  const recordLessonPrefillSignatureRef = useRef<string | null>(null);\n\n  useEffect(() => {\n    if (!recordLessonPrefill) return;\n\n    const signature = JSON.stringify([\n      recordLessonPrefill.className,\n      recordLessonPrefill.udaId ?? null,\n      recordLessonPrefill.date,\n      recordLessonPrefill.topic ?? null,\n      recordLessonPrefill.notes ?? null,\n      recordLessonPrefill.navigationVersion\n    ]);\n    if (recordLessonPrefillSignatureRef.current === signature) return;\n    recordLessonPrefillSignatureRef.current = signature;\n\n    setSelectedMasterClass(recordLessonPrefill.className);\n    setClassFilter(recordLessonPrefill.className);\n    setGapClassFilter(recordLessonPrefill.className);\n    setSummaryClassFilter(recordLessonPrefill.className);\n\n    const safeTarget = recordLessonPrefill.udaId\n      ? udas.find(uda => uda.id === recordLessonPrefill.udaId && uda.className === recordLessonPrefill.className)\n      : undefined;\n\n    if (!safeTarget) {\n      setSelectedUdaForDetail(null);\n      return;\n    }\n\n    setSelectedUdaForDetail(safeTarget);\n    setNewLessonDate(recordLessonPrefill.date);\n    setNewLessonTopic(recordLessonPrefill.topic?.trim() || '');\n    setNewLessonNotes(recordLessonPrefill.notes?.trim() || '');\n  }, [recordLessonPrefill, udas]);\n\n  // Months full Italian naming`,
  'gantt prefill effect'
);

gantt = replaceOnce(
  gantt,
  `      setNewLessonTopic('');\n      setNewLessonNotes('');\n      showStatus('Attività registrata nel diario');\n    });`,
  `      setNewLessonTopic('');\n      setNewLessonNotes('');\n      showStatus('Attività registrata nel diario');\n      if (\n        recordLessonPrefill &&\n        recordLessonPrefill.className === updatedUda.className &&\n        (!recordLessonPrefill.udaId || recordLessonPrefill.udaId === updatedUda.id)\n      ) {\n        onRecordLessonCommitted?.(updatedUda.id, recordLessonPrefill.navigationVersion);\n      }\n    });`,
  'gantt completion callback'
);

fs.writeFileSync(ganttPath, gantt);

const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');

app = replaceOnce(
  app,
  `  const navigationVersionRef = useRef(0);`,
  `  const navigationVersionRef = useRef(0);\n  const recordSpecialistNavigationVersionRef = useRef<number | null>(null);`,
  'app specialist navigation ref'
);

app = replaceOnce(
  app,
  `    setTodayAction('record');\n    setActiveTab(route.tab);\n\n    try {`,
  `    setTodayAction('record');\n    setActiveTab(route.tab);\n    recordSpecialistNavigationVersionRef.current = navigationVersionRef.current;\n\n    try {`,
  'app capture specialist navigation version'
);

app = replaceOnce(
  app,
  `  const handleUpdateRecordStagedNote = useCallback((note: string) => {`,
  `  const handleRecordLessonCommitted = useCallback((udaId: string, navigationVersionAtSave: number) => {\n    const session = recordSessionRef.current;\n    if (\n      !session ||\n      session.status !== 'editing' ||\n      session.evidenceKind !== 'lesson-log' ||\n      session.context.classId !== currentClassIdRef.current ||\n      (session.context.udaId && session.context.udaId !== udaId)\n    ) {\n      return;\n    }\n\n    const completed = completeRecordFlow('lesson-log', navigationVersionAtSave);\n    if (completed) {\n      recordSpecialistNavigationVersionRef.current = null;\n    }\n  }, [completeRecordFlow]);\n\n  const handleUpdateRecordStagedNote = useCallback((note: string) => {`,
  'app lesson commit handler'
);

app = replaceOnce(
  app,
  `            onSaveUdas={handleSaveUdas}\n            onNavigateTab={handleNavigateTab}\n            onOpenCopilot={openLibraryCopilot}`,
  `            onSaveUdas={handleSaveUdas}\n            onNavigateTab={handleNavigateTab}\n            recordLessonPrefill={recordSession?.status === 'editing' && recordSession.evidenceKind === 'lesson-log'\n              && recordSession.context.classId === currentClass?.id\n              && recordSpecialistNavigationVersionRef.current !== null\n              ? {\n                  className: recordSession.context.className,\n                  udaId: recordSession.context.udaId,\n                  date: today(),\n                  topic: recordSession.context.activityLabel,\n                  notes: recordSession.stagedNote,\n                  navigationVersion: recordSpecialistNavigationVersionRef.current\n                }\n              : undefined}\n            onRecordLessonCommitted={handleRecordLessonCommitted}\n            onOpenCopilot={openLibraryCopilot}`,
  'app UDA render handoff'
);

fs.writeFileSync(appPath, app);
