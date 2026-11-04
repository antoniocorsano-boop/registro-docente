import { describe, expect, test } from 'bun:test';

describe('INT-01 bidirectional didactic continuity', () => {
  test('uses a compact, navigation-only continuity bar without duplicating specialist decisions', async () => {
    const bar = await Bun.file('src/components/DidacticContinuityBar.tsx').text();
    expect(bar).toContain('DidacticContinuityBar');
    expect(bar).toContain('Classe');
    expect(bar).toContain('Cornice');
    expect(bar).toContain('UDA');
    expect(bar).toContain('Apri UDA');
    expect(bar).toContain('Apri Programmazione');
    expect(bar).toContain('min-h-[44px]');
    expect(bar).not.toMatch(/onSave|calcola\w*Media|vot[io]|percentual|\bKPI\b/);
  });

  test('Programmazione focalizza il profilo coerente, senza fallback al primo per classe ambigua', async () => {
    const view = await Bun.file('src/components/planning/PlanningProfileView.tsx').text();
    expect(view).toContain('focusedProfileId');
    expect(view).toContain('DidacticContinuityBar');
    expect(view).toContain('hasClassContext');
    expect(view).not.toContain(': profiles[0]?.id ?? null;');
    expect(view).toContain('onOpenUda');
  });

  test('the actual UDA workspace, not only the legacy Gantt, exposes class-first focus', async () => {
    const alias = await Bun.file('src/components/UdaGanttView.ts').text();
    expect(alias).toContain("UdaWorkspaceView as UdaGanttView");
    const workspace = await Bun.file('src/components/UdaWorkspaceView.tsx').text();
    expect(workspace).toContain('DidacticContinuityBar');
    expect(workspace).toContain('onTeachingFocusChange');
    expect(workspace).toContain('currentClassName');
    expect(workspace).toContain('teachingFocus');
    expect(workspace).toContain('onOpenPlanning');
    expect(workspace).toContain("setActiveView('planning')");
    expect(workspace).toContain('onTeachingFocusChange?.({ udaId: uda.id })');
    const legacy = await Bun.file('src/components/UdaGanttView.tsx').text();
    expect(legacy).toContain('teachingFocus');
    expect(legacy).toContain('onTeachingFocusChange');
  });

  test('a new planning profile starts with the active class grade and configured discipline', async () => {
    const editor = await Bun.file('src/components/planning/PlanningProfileEditor.tsx').text();
    const view = await Bun.file('src/components/planning/PlanningProfileView.tsx').text();
    const app = await Bun.file('src/App.tsx').text();
    expect(editor).toContain('defaultSubjectCode');
    expect(editor).toContain('defaultGradeLevel');
    expect(view).toContain('resolveClassGradeLevel');
    expect(view).toContain('defaultSubjectCode');
    expect(app).toContain('defaultSubjectCode={curricularSubjectCode}');
    expect(app).toContain('resolveCurricularSubjectCode(settings.subject)');
    expect(app).not.toContain('defaultSubjectCode={settings.subject}');
    // Do not force the legacy hard-coded subject when a real subject is known.
    expect(editor).not.toContain("const subjectCode = 'tecnologia';");
  });

  test('the specialist Analysis view also respects the active class boundary', async () => {
    const workspace = await Bun.file('src/components/UdaWorkspaceView.tsx').text();
    const start = workspace.indexOf("{activeView === 'analysis' && (");
    const end = workspace.indexOf("{isCreateOpen && (", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const analysis = workspace.slice(start, end);
    expect(analysis).toContain('currentClassName={currentClassName}');
  });

  test('App routes Programmazione and UDA through one current class and focus', async () => {
    const app = await Bun.file('src/App.tsx').text();
    expect(app).toContain('focusedProfileId={planningFrame.status');
    expect(app).toContain("onOpenUda={() => handleNavigateTab('uda-gantt')}");
    expect(app).toContain("onOpenPlanning={() => handleNavigateTab('programmazione')}");
    expect(app).toContain('onTeachingFocusChange={');
  });

  test('does not change the projected UDA write boundary', async () => {
    const view = await Bun.file('src/components/UdaGanttView.tsx').text();
    expect(view).not.toContain('assertTeachingUdaWritableByRegistro(');
    expect(view).toContain('onSaveUdas');
    expect(view).toContain('onTeachingFocusChange');
  });

  test('HPR-UX-F02 shows only the active class in context; standalone filters remain available', async () => {
    const workspace = await Bun.file('src/components/UdaWorkspaceView.tsx').text();
    const gantt = await Bun.file('src/components/UdaGanttView.tsx').text();
    expect(workspace).toContain('aria-label="Classe corrente nella vista UDA"');
    expect(workspace).toContain('{currentClassName ? (');
    expect(gantt).toContain('aria-label="Classe corrente UDA"');
    expect(gantt).toContain('aria-label="Classe corrente nel cronoprogramma"');
    expect(gantt).toContain('onClick={() => handleMasterClassChange(\'all\')}');
    expect(gantt).toContain('aria-label="Filtra classe UDA"');
    expect(gantt).toContain('scopedUdas');
    expect(gantt).toContain('classScopedUdaMutationAllowed');
  });

  test('HPR-UX-F01 distinguishes saved planning from optional Arena adoption', async () => {
    const view = await Bun.file('src/components/planning/PlanningProfileView.tsx').text();
    const editor = await Bun.file('src/components/planning/PlanningProfileEditor.tsx').text();
    expect(view).toContain('aria-label="Stato della programmazione"');
    expect(view).toContain('Programmazione disponibile');
    expect(view).toContain('Programmazione da configurare');
    expect(view).toContain('Curricolo Arena da collegare (facoltativo)');
    expect(view).toContain("planningFrame?.status === 'ambiguous'");
    expect(editor).not.toContain('Configura il profilo reale prima di collegare il curricolo Arena.');
    expect(editor).toContain('profile ?');
  });

  test('HPR: compact mobile Programmazione prioritizes UDA and progressively discloses configuration', async () => {
    const view = await Bun.file('src/components/planning/PlanningProfileView.tsx').text();
    expect(view).toContain('aria-label="Programmazione corrente"');
    expect(view).toContain('Apri UDA');
    expect(view).toContain('aria-controls="int01-planning-details"');
    expect(view).toContain('aria-controls="int01-arena-details"');
    expect(view).toContain("setMobileDetailsOpen(open => !open)");
    expect(view).toContain("setMobileArenaOpen(open => !open)");
    expect(view).toContain("planningFrame?.status !== 'resolved'");
    expect(view).toContain('id="int01-planning-details"');
    expect(view).toContain('sm:block');
    expect(view).toContain('<PlanningProfileEditor');
    expect(view).toContain('<ArenaPlanningContextPanel');
  });

  test('HPR guarded navigation and resolved class-only profile presentation', async () => {
    const app = await Bun.file('src/App.tsx').text();
    const view = await Bun.file('src/components/planning/PlanningProfileView.tsx').text();
    const editor = await Bun.file('src/components/planning/PlanningProfileEditor.tsx').text();
    expect(app).toContain('requestPlanningDeparture');
    expect(app).toContain('Modifiche non salvate');
    expect(app).toContain('Salva e continua');
    expect(app).toContain('Continua senza salvare');
    expect(app).toContain('Rimani nella Programmazione');
    expect(app).toContain('history.go(-delta)');
    expect(app).toContain('history.go(restoring.delta)');
    expect(app).toContain('__tramaHistoryPosition');
    expect(app).toContain('markHistoryPush()');
    expect(app).toContain('(node as HTMLElement).inert = true');
    expect(app).toContain('planningExitDialogRef.current?.querySelectorAll');
    expect(app).toContain('onRegisterDraftGuard={registerPlanningDraftGuard}');
    expect(view).toContain('Profilo della classe corrente');
    expect(view).toContain('retainedProfileRef');
    expect(view).toContain('Cornice da verificare. La bozza rimane disponibile');
    expect(view).toContain('onRegisterDraftGuard={registerEditorGuard}');
    expect(editor).toContain('saveDraftChanges');
    expect(editor).toContain("window.addEventListener('beforeunload'");
  });

  test('HPR history marker survives neutral bootstrap without restoring stale class', async () => {
    const secureRoot = await Bun.file('src/components/SecureRegistroRoot.tsx').text();
    const app = await Bun.file('src/App.tsx').text();
    expect(secureRoot).toContain('const existingPosition = window.history.state?.__tramaHistoryPosition');
    expect(secureRoot).toContain('const existingEpoch = window.history.state?.__tramaHistoryEpoch');
    expect(secureRoot).toContain('const existingEntryId = window.history.state?.__tramaHistoryEntryId');
    expect(secureRoot).toContain("window.history.replaceState(neutralHistoryState, '', nextUrl)");
    expect(secureRoot).toContain("params.delete('class')");
    expect(secureRoot).toContain("params.delete('tab')");
    expect(app).toContain('__tramaHistoryPosition');
    expect(app).toContain('history.go(-delta)');
    expect(app).toContain('history.go(restoring.delta)');
  });

  test('vault neutral bootstrap preserves history position but clears stale class and tab', async () => {
    const root = await Bun.file('src/components/SecureRegistroRoot.tsx').text();
    const app = await Bun.file('src/App.tsx').text();
    expect(root).toContain('history.state?.__tramaHistoryPosition');
    expect(root).toContain('window.history.replaceState(neutralHistoryState');
    expect(root).toContain("params.delete('class')");
    expect(root).toContain("params.delete('tab')");
    expect(app).toContain('markHistoryPush()');
    expect(app).toContain('history.go(-delta)');
    expect(app).toContain('history.go(restoring.delta)');
  });

  test('legacy history cannot silently reclassify a dirty Programmazione', async () => {
    const app = await Bun.file('src/App.tsx').text();
    expect(app).toContain('browserHistoryIndexRef');
    expect(app).toContain('readBrowserHistoryIndex');
    expect(app).toContain('historyUrlRef');
    expect(app).toContain('window.location.href === restoring.originUrl');
    expect(app).not.toContain('history.go(direction)');
    expect(app).toContain('openUnverifiableDeparture');
    expect(app).toContain('historyFallbackRef');
    expect(app).toContain('historyEpochRef');
    expect(app).toContain('targetEpoch === historyEpochRef.current');
    expect(app).toContain('historyPositionRef.current !== null && historyEpochRef.current !== null');
    expect(app).not.toContain('(historyPositionRef.current ?? 0) + 1');
    expect(app).toContain('history.go(-delta)');
    expect(app).toContain('history.go(restoring.delta)');
  });

  test('clean legacy entries acquire a unique identity before a dirty Back', async () => {
    const app = await Bun.file('src/App.tsx').text();
    expect(app).toContain('const historyEntryIdRef');
    expect(app).toContain('__tramaHistoryEntryId');
    expect(app).toContain('const currentEntryId = targetEntryId ?? crypto.randomUUID()');
    expect(app).toContain('historyPositionRef.current = targetPosition');
    expect(app).toContain('restoring.originBrowserIndex');
    expect(app).toContain('targetEntryId === restoring.originEntryId');
    expect(app).toContain('historyFallbackWarning');
    expect(app).toContain('la cronologia in avanti potrebbe essere sostituita');
    expect(app).toContain('originVerified && window.location.href === restoring.originUrl');
  });
});
