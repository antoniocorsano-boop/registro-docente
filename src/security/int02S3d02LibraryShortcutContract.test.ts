import {describe,expect,test} from 'bun:test';

describe('S3d-02 — percorso diretto fonte → Copilota verifica',()=>{
  test('la prima azione apre il percorso assistito senza selezione obbligatoria di UDA',async()=>{
    const card=await Bun.file('src/components/LibrarySourceCard.tsx').text();
    const types=await Bun.file('src/library/copilotLaunchContext.ts').text();
    const composer=await Bun.file('src/components/LibraryCopilotComposer.tsx').text();

    expect(types).toContain("'assessment'");
    expect(card).toContain('data-testid="int02-prepare-assisted-assessment"');
    expect(card).toContain('Prepara una verifica con il Copilota');
    expect(card).toContain("intent: 'assessment'");
    expect(card).toContain("surface: 'library'");
    expect(card).toContain('sourceId: source.id');
    expect(card).toContain('className: currentClassName ?? undefined');
    expect(card).toContain("source.privacy === 'teacher-professional'");
    expect(card).toContain("source.status === 'ready'");
    expect(card).toContain('Boolean(excerpt?.trim())');
    expect(card).toContain('data-testid="library-source-other-actions"');
    expect(card).toContain('transferFocusToCopilotRef.current = true');
    expect(card).toContain('restorePrimaryAssessmentFocusRef.current = true');
    expect(card).toContain('if (!isUseSurfaceOpen && restorePrimaryAssessmentFocusRef.current)');
    expect(card).toContain('if (returnButton?.isConnected && !returnButton.disabled) returnButton.focus()');
    expect(card).toContain('if (transferFocusToCopilotRef.current)');
    expect(card).toContain('Altre possibilità: UDA, lezione o editor manuale');
    expect(card).toContain('data-testid="int02-prepare-assessment"');
    expect(card).toContain('Apri editor manuale senza Copilota');

    const shortcut=card.slice(
      card.indexOf('data-testid="int02-prepare-assisted-assessment"'),
      card.indexOf('data-testid="library-source-other-actions"')
    );
    expect(shortcut).toContain('onOpenCopilot({');
    expect(shortcut).not.toContain('onPrepareAssessment(');
    expect(shortcut).not.toContain('onSaveNewTest(');
    expect(shortcut).not.toContain('udaId:');

    expect(composer).toContain("setIsAssessmentOpen(directLaunchIntent === 'assessment')");
    expect(composer).toContain('const showMaterialControls = isAssessmentOpen ||');
    expect(composer).toContain('currentClassName !== launchRequest.context.className');
    expect(composer).toContain('<AssessmentCopilotPanel');
    expect(composer).toContain('isAssessmentClassUnambiguous');
    expect(composer).toContain('getLiveContext');
    expect(composer).toContain('onAcceptAssessmentDraft(session,draft)');
    expect(composer).not.toContain("setEditorUdaId(udas[0]");
  });

  test('il precedente percorso manuale conserva handoff, controlli e separazione dal salvataggio',async()=>{
    const card=await Bun.file('src/components/LibrarySourceCard.tsx').text();
    const app=await Bun.file('src/App.tsx').text();
    const view=await Bun.file('src/components/VerificheOnlineView.tsx').text();
    expect(card).toContain('onPrepareAssessment(source.id)');
    expect(app).toContain('handlePrepareAssessmentFromLibrary');
    expect(view).toContain('data-testid="int02-assessment-handoff"');
    expect(view).toContain('data-testid="int02-open-assessment-editor"');
    expect(view).toContain("setEditorUdaId('')");
    expect(view).toContain('onClick={() => handleStartNewInteractiveTest()}');
  });
});
