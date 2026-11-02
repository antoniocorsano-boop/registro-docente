import fs from 'node:fs';

function replaceOnce(path, needle, replacement, label) {
  let source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`PATCH_MARKER_MISSING:${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`PATCH_MARKER_AMBIGUOUS:${label}`);
  source = source.slice(0, first) + replacement + source.slice(first + needle.length);
  fs.writeFileSync(path, source);
}

replaceOnce(
  'src/recording/recordSession.ts',
`export const updateRecordStagedNote = (\n  session: RecordSessionDraft,\n  stagedNote: string\n): RecordSessionDraft => {\n  const normalizedNote = normalizeOptionalText(stagedNote);\n\n  if (normalizedNote) {\n    return {\n      ...session,\n      stagedNote: normalizedNote\n    };\n  }\n\n  const { stagedNote: _stagedNote, ...rest } = session;\n  return rest;\n};`,
`export const updateRecordStagedNote = (\n  session: RecordSessionDraft,\n  stagedNote: string\n): RecordSessionDraft => {\n  if (stagedNote.length > 0) {\n    return {\n      ...session,\n      stagedNote\n    };\n  }\n\n  const { stagedNote: _stagedNote, ...rest } = session;\n  return rest;\n};`,
  'record-note-raw-editing'
);

replaceOnce(
  'src/persistence/submissionGradeImport.ts',
`): { classes: ClassData[]; importedCount: number } {\n  let importedCount = 0;\n\n  const nextClasses = classes.map(classData => {`,
`): { classes: ClassData[]; importedCount: number; importedCountByClassId: Record<string, number> } {\n  let importedCount = 0;\n  const importedCountByClassId: Record<string, number> = {};\n\n  const nextClasses = classes.map(classData => {`,
  'submission-result-shape'
);

replaceOnce(
  'src/persistence/submissionGradeImport.ts',
`      grades.push(nextGrade);\n      importedCount += 1;`,
`      grades.push(nextGrade);\n      importedCount += 1;\n      importedCountByClassId[classData.id] = (importedCountByClassId[classData.id] || 0) + 1;`,
  'submission-class-count'
);

replaceOnce(
  'src/persistence/submissionGradeImport.ts',
`  return {\n    classes: nextClasses,\n    importedCount\n  };`,
`  return {\n    classes: nextClasses,\n    importedCount,\n    importedCountByClassId\n  };`,
  'submission-return-counts'
);

replaceOnce(
  'src/App.tsx',
`  const completeRecordFlow = useCallback((\n    kind: RecordEvidenceKind,\n    navigationVersionAtSave: number\n  ): boolean => {\n    const session = recordSessionRef.current;\n    if (!session\n      || session.status !== 'editing'\n      || session.evidenceKind !== kind\n      || session.context.classId !== currentClassIdRef.current) {\n      return false;\n    }\n\n    publishRecordSession(markRecordSessionSaved(session));\n    if (navigationVersionRef.current === navigationVersionAtSave) {\n      setActiveTab('dashboard');\n      setTodayAction('record');\n    }\n    return true;\n  }, [publishRecordSession, setActiveTab]);`,
`  const completeRecordFlow = useCallback((\n    kind: RecordEvidenceKind,\n    navigationVersionAtSave: number,\n    originatingSession: RecordSessionDraft | null,\n    originatingClassId: string\n  ): boolean => {\n    const session = recordSessionRef.current;\n    if (!originatingSession\n      || !session\n      || session !== originatingSession\n      || session.status !== 'editing'\n      || session.evidenceKind !== kind\n      || session.context.classId !== originatingClassId\n      || currentClassIdRef.current !== originatingClassId\n      || navigationVersionRef.current !== navigationVersionAtSave) {\n      return false;\n    }\n\n    publishRecordSession(markRecordSessionSaved(session));\n    setActiveTab('dashboard');\n    setTodayAction('record');\n    return true;\n  }, [publishRecordSession, setActiveTab]);`,
  'record-completion-origin'
);

replaceOnce(
  'src/App.tsx',
`    const completed = completeRecordFlow('lesson-log', navigationVersionAtSave);`,
`    const completed = completeRecordFlow('lesson-log', navigationVersionAtSave, session, session.context.classId);`,
  'lesson-log-completion-call'
);

replaceOnce(
  'src/App.tsx',
`    const navigationVersionAtSave = navigationVersionRef.current;\n\n    const newGrades: Grade[] = batchData.grades.map(st => ({`,
`    const navigationVersionAtSave = navigationVersionRef.current;\n    const recordSessionAtSave = recordSessionRef.current;\n\n    const newGrades: Grade[] = batchData.grades.map(st => ({`,
  'evaluation-origin-capture'
);

replaceOnce(
  'src/App.tsx',
`        const recordCompleted = completeRecordFlow('evaluation', navigationVersionAtSave);`,
`        const recordCompleted = completeRecordFlow('evaluation', navigationVersionAtSave, recordSessionAtSave, classId);`,
  'evaluation-completion-call'
);

replaceOnce(
  'src/App.tsx',
`    const navigationVersionAtSave = navigationVersionRef.current;\n    const dateStr = newRecords[0]?.date || today();\n\n    return commitAppDataMutation(current => {\n      const targetClass = current.classes.find(c => c.id === classId);\n      if (!targetClass) throw new Error('Classe non più disponibile.');\n      const remaining = (targetClass.behaviors || []).filter(b => b.date !== dateStr);`,
`    const navigationVersionAtSave = navigationVersionRef.current;\n    const recordSessionAtSave = recordSessionRef.current;\n    const submittedBehaviorKeys = new Set(\n      newRecords.map(record => \`${'${record.date}'}::${'${record.studentId}'}\`)\n    );\n\n    return commitAppDataMutation(current => {\n      const targetClass = current.classes.find(c => c.id === classId);\n      if (!targetClass) throw new Error('Classe non più disponibile.');\n      const remaining = (targetClass.behaviors || []).filter(\n        record => !submittedBehaviorKeys.has(\`${'${record.date}'}::${'${record.studentId}'}\`)\n      );`,
  'behaviour-partial-merge'
);

replaceOnce(
  'src/App.tsx',
`        const recordCompleted = completeRecordFlow('behaviour', navigationVersionAtSave);`,
`        const recordCompleted = completeRecordFlow('behaviour', navigationVersionAtSave, recordSessionAtSave, classId);`,
  'behaviour-completion-call'
);

replaceOnce(
  'src/App.tsx',
`    let importedCount = 0;\n    const navigationVersionAtSave = navigationVersionRef.current;\n\n    return commitAppDataMutation(current => {\n      const result = reconcileSubmissionGrades(current.classes, submissionsRef.current, targetUdaId);\n      importedCount = result.importedCount;`,
`    let importedCount = 0;\n    let importedCountByClassId: Record<string, number> = {};\n    const navigationVersionAtSave = navigationVersionRef.current;\n    const recordSessionAtSave = recordSessionRef.current;\n    const recordingClassId = recordSessionAtSave?.context.classId;\n\n    return commitAppDataMutation(current => {\n      const result = reconcileSubmissionGrades(current.classes, submissionsRef.current, targetUdaId);\n      importedCount = result.importedCount;\n      importedCountByClassId = result.importedCountByClassId;`,
  'online-origin-counts'
);

replaceOnce(
  'src/App.tsx',
`        alert(\`Importazione completata con successo! ${'${importedCount}'} valutazioni sono state registrate negli elenchi di classe.\`);\n        completeRecordFlow('online-outcomes', navigationVersionAtSave);`,
`        alert(\`Importazione completata con successo! ${'${importedCount}'} valutazioni sono state registrate negli elenchi di classe.\`);\n        if (recordingClassId && (importedCountByClassId[recordingClassId] || 0) > 0) {\n          completeRecordFlow('online-outcomes', navigationVersionAtSave, recordSessionAtSave, recordingClassId);\n        }`,
  'online-class-completion'
);

replaceOnce(
  'src/security/flow03AppIntegrationContract.test.ts',
`    expect(completion).toContain("session.status !== 'editing'");\n    expect(completion).toContain('session.evidenceKind !== kind');\n    expect(completion).toContain('session.context.classId !== currentClassIdRef.current');\n    expect(completion).toContain('markRecordSessionSaved(session)');\n    expect(completion).toContain('navigationVersionRef.current === navigationVersionAtSave');`,
`    expect(completion).toContain('originatingSession: RecordSessionDraft | null');\n    expect(completion).toContain('session !== originatingSession');\n    expect(completion).toContain("session.status !== 'editing'");\n    expect(completion).toContain('session.evidenceKind !== kind');\n    expect(completion).toContain('session.context.classId !== originatingClassId');\n    expect(completion).toContain('currentClassIdRef.current !== originatingClassId');\n    expect(completion).toContain('navigationVersionRef.current !== navigationVersionAtSave');\n    expect(completion).toContain('markRecordSessionSaved(session)');`,
  'app-contract-completion'
);

replaceOnce(
  'src/security/flow03AppIntegrationContract.test.ts',
`    expect(evaluations).toContain("completeRecordFlow('evaluation', navigationVersionAtSave)");\n    expect(evaluations.indexOf("completeRecordFlow('evaluation', navigationVersionAtSave)")).toBeGreaterThan(evaluations.indexOf('afterCommit: () =>'));`,
`    expect(evaluations).toContain("completeRecordFlow('evaluation', navigationVersionAtSave, recordSessionAtSave, classId)");\n    expect(evaluations.indexOf("completeRecordFlow('evaluation', navigationVersionAtSave, recordSessionAtSave, classId)")).toBeGreaterThan(evaluations.indexOf('afterCommit: () =>'));`,
  'app-contract-evaluation-call'
);

replaceOnce(
  'src/security/flow03AppIntegrationContract.test.ts',
`    expect(behaviours).toContain("completeRecordFlow('behaviour', navigationVersionAtSave)");\n    expect(behaviours.indexOf("completeRecordFlow('behaviour', navigationVersionAtSave)")).toBeGreaterThan(behaviours.indexOf('afterCommit: () =>'));`,
`    expect(behaviours).toContain("completeRecordFlow('behaviour', navigationVersionAtSave, recordSessionAtSave, classId)");\n    expect(behaviours.indexOf("completeRecordFlow('behaviour', navigationVersionAtSave, recordSessionAtSave, classId)")).toBeGreaterThan(behaviours.indexOf('afterCommit: () =>'));`,
  'app-contract-behaviour-call'
);

replaceOnce(
  'src/security/flow03AppIntegrationContract.test.ts',
`    expect(imports).toContain("completeRecordFlow('online-outcomes', navigationVersionAtSave)");\n    expect(imports.indexOf("completeRecordFlow('online-outcomes', navigationVersionAtSave)")).toBeGreaterThan(imports.indexOf('afterCommit: () =>'));`,
`    expect(imports).toContain("completeRecordFlow('online-outcomes', navigationVersionAtSave, recordSessionAtSave, recordingClassId)");\n    expect(imports.indexOf("completeRecordFlow('online-outcomes', navigationVersionAtSave, recordSessionAtSave, recordingClassId)")).toBeGreaterThan(imports.indexOf('afterCommit: () =>'));`,
  'app-contract-online-call'
);

console.log('FLOW-03 independent review repairs applied');
