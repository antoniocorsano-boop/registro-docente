import fs from 'node:fs';

// Fail-closed Task 6 product patch.
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
  `                    </div>\n                  </div>\n                </form>\n\n                {/* Lessons list */}`,
  `                    </div>\n                  </div>\n\n                  <textarea\n                    rows={2}\n                    value={newLessonNotes}\n                    onChange={e => setNewLessonNotes(e.target.value)}\n                    placeholder="Note professionali opzionali sulla lezione..."\n                    className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-white resize-y"\n                  />\n                </form>\n\n                {/* Lessons list */}`,
  'gantt editable lesson notes'
);

gantt = replaceOnce(
  gantt,
  `      setNewLessonTopic('');\n      setNewLessonNotes('');\n      showStatus('Attività registrata nel diario');\n    });`,
  `      setNewLessonTopic('');\n      setNewLessonNotes('');\n      showStatus('Attività registrata nel diario');\n      if (\n        recordLessonPrefill &&\n        recordLessonPrefill.className === updatedUda.className &&\n        (!recordLessonPrefill.udaId || recordLessonPrefill.udaId === updatedUda.id)\n      ) {\n        onRecordLessonCommitted?.(updatedUda.id, recordLessonPrefill.navigationVersion);\n      }\n    });`,
  'gantt completion callback'
);

fs.writeFileSync(ganttPath, gantt);

const workspacePath = 'src/components/UdaWorkspaceView.tsx';
let workspace = fs.readFileSync(workspacePath, 'utf8');

workspace = replaceOnce(
  workspace,
  `import React, { useMemo, useState } from 'react';`,
  `import React, { useEffect, useMemo, useState } from 'react';`,
  'workspace useEffect import'
);

workspace = replaceOnce(
  workspace,
  `import { UdaGanttView as LegacyUdaGanttView } from './UdaGanttView.tsx';`,
  `import { UdaGanttView as LegacyUdaGanttView } from './UdaGanttView.tsx';\nimport type { RecordLessonPrefill } from './UdaGanttView.tsx';`,
  'workspace prefill type import'
);

workspace = replaceOnce(
  workspace,
  `  onSaveUdas: (udas: UdaRecord[]) => Promise<void>;\n  onNavigateTab?: (tab: any) => void;\n  onOpenCopilot?: (context: CopilotLaunchContext) => void;`,
  `  onSaveUdas: (udas: UdaRecord[]) => Promise<void>;\n  onNavigateTab?: (tab: any) => void;\n  recordLessonPrefill?: RecordLessonPrefill;\n  onRecordLessonCommitted?: (udaId: string, navigationVersion: number) => void;\n  onOpenCopilot?: (context: CopilotLaunchContext) => void;`,
  'workspace props'
);

workspace = replaceOnce(
  workspace,
  `  onSaveUdas,\n  onNavigateTab,\n  onOpenCopilot\n}) => {`,
  `  onSaveUdas,\n  onNavigateTab,\n  recordLessonPrefill,\n  onRecordLessonCommitted,\n  onOpenCopilot\n}) => {`,
  'workspace destructure'
);

workspace = replaceOnce(
  workspace,
  `  const [statusMessage, setStatusMessage] = useState<string | null>(null);\n  const [saveError, setSaveError] = useState<string | null>(null);\n\n  const filteredUdas = useMemo(`,
  `  const [statusMessage, setStatusMessage] = useState<string | null>(null);\n  const [saveError, setSaveError] = useState<string | null>(null);\n\n  useEffect(() => {\n    if (!recordLessonPrefill) return;\n    setActiveView('planning');\n    setClassFilter(recordLessonPrefill.className);\n  }, [recordLessonPrefill]);\n\n  const filteredUdas = useMemo(`,
  'workspace FLOW-03 planning handoff'
);

workspace = replaceOnce(
  workspace,
  `          <p className="mt-1 text-sm text-slate-400">Cronoprogramma, propedeuticità e gestione dettagliata delle UDA.</p>\n          </div>\n          <LegacyUdaGanttView classes={classes} udas={udas} settings={settings} tests={tests} onSaveUdas={onSaveUdas} onNavigateTab={onNavigateTab} />\n        </section>\n      )}\n\n      {activeView === 'analysis' && (`,
  `          <p className="mt-1 text-sm text-slate-400">Cronoprogramma, propedeuticità e gestione dettagliata delle UDA.</p>\n          </div>\n          <LegacyUdaGanttView\n            classes={classes}\n            udas={udas}\n            settings={settings}\n            tests={tests}\n            onSaveUdas={onSaveUdas}\n            onNavigateTab={onNavigateTab}\n            recordLessonPrefill={recordLessonPrefill}\n            onRecordLessonCommitted={onRecordLessonCommitted}\n          />\n        </section>\n      )}\n\n      {activeView === 'analysis' && (`,
  'workspace planning Gantt handoff'
);

fs.writeFileSync(workspacePath, workspace);

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
