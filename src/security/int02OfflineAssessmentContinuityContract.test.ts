import {describe,expect,test} from 'bun:test';

describe('INT-02 — continuità locale della verifica senza generatore',()=>{
  test('pannello: obiettivo prima di proseguire, nessun consenso o chiamata IA necessaria',async()=>{
    const panel=await Bun.file('src/components/AssessmentCopilotPanel.tsx').text();
    const handler=panel.slice(panel.indexOf('const handleContinueManually=async()=>{'),
      panel.indexOf('  return (\n    <section data-testid="int02-s3c02-assessment-panel"'));
    expect(panel).toContain('data-testid="int02-assessment-continue-locally"');
    expect(panel).toContain('Continua senza generatore');
    expect(panel).toContain('Il generatore non è disponibile.');
    expect(panel).toContain('Nessuna domanda generata e nessun salvataggio automatico.');
    // No parallel "Continua" button when the remote provider is healthy.
    expect(panel).toContain('providerAvailable===false&&(');
    expect(panel).toContain('providerAvailable!==false&&(');
    expect(handler).toContain('live.source.status');
    expect(handler).toContain('live.source.privacy');
    expect(handler).toContain('live.activeClassId!==classId');
    expect(handler).toContain('onContinueManually(source.id,classId,cleanObjective)');
    expect(handler).not.toContain('requestAssessmentDraftFromCopilot(');
    expect(handler).not.toContain('remoteConsent');
    expect(handler).not.toContain('onAccept(');
    expect(handler).not.toContain('onSaveNewTest');
  });

  test('App: descriptor effimero, controllo classe/fonte e guardia bozze esistenti',async()=>{
    const app=await Bun.file('src/App.tsx').text();
    const handoff=await Bun.file('src/library/assessmentHandoff.ts').text();
    const handler=app.slice(
      app.indexOf('const handleContinueAssessmentManually = useCallback('),
      app.indexOf('  /** Open one student'));
    expect(handler).toContain('hasUnsavedActiveDraft()');
    expect(handler).toContain('canAcceptAssessmentEditorTransfer(');
    expect(handler).toContain('resolveAssessmentHandoff(');
    expect(handler).toContain('activeClassId:liveClassId');
    expect(handler).toContain('guided:true,nonce:crypto.randomUUID()');
    expect(handler).toContain("handleNavigateTab('verifiche-online')");
    expect(handler).not.toContain('onSaveNewTest');
    expect(handler).not.toContain('setTests(');
    expect(handler).not.toContain('Gemini');
    expect(app).toContain('onContinueAssessmentManually={handleContinueAssessmentManually}');
    const composer=await Bun.file('src/components/LibraryCopilotComposer.tsx').text();
    expect(composer).toContain('await onContinueAssessmentManually(sourceId,classId,objective)');
    expect(composer).toContain("onSurfaceModeChange('closed')");
    expect(app).toContain('onGuidedAssessmentHandoffConsumed={nonce =>');
    expect(handoff).toContain("'OBJECTIVE_INVALID'");
    expect(handoff).toContain("source.privacy !== 'teacher-professional'");
    expect(handoff).toContain("source.status !== 'ready'");
    expect(handoff).not.toContain('source.payload.text\n    }');
  });

  test('editor: apertura guidata immediata, nessun quesito generato e UDA vuota',async()=>{
    const view=await Bun.file('src/components/VerificheOnlineView.tsx').text();
    const body=view.slice(view.indexOf('const handoff=assessmentHandoff;'),
      view.indexOf('  // Open interactive editor for existing test'));
    expect(body).toContain('lastGuidedHandoffNonceRef.current===handoff.nonce');
    expect(body).toContain('classes.filter(item=>item.name===activeClassName).length===1');
    expect(body).toContain('editorDirtyRef.current||editorSavingRef.current');
    expect(body).toContain('handleStartNewInteractiveTest()');
    expect(body).toContain("setEditorTitle(`Verifica: ${handoff.sourceTitle}`)");
    expect(body).toContain("setEditorDescription(`Obiettivo didattico: ${handoff.objective}`)");
    expect(body).toContain('setIsManuallyGuided(true)');
    expect(body).toContain('onGuidedAssessmentHandoffConsumed?.(handoff.nonce)');
    expect(view).toContain("setEditorUdaId('')");
    expect(view).toContain('il generatore non è stato utilizzato');
    expect(view).toContain("isManuallyGuided ? 'Prepara la verifica' : 'Rivedi la verifica'");
    expect(view).toContain('editorBaselineRef.current=null');
    expect(view).toContain('Modifiche non salvate');
    expect(body).not.toContain('await onSaveNewTest(');
  });
});
