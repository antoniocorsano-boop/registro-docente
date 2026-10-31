import { describe, expect, test } from 'bun:test';

const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);

async function composerSource(): Promise<string> {
  return Bun.file(COMPOSER).text();
}

describe('A4-R1 teacher-first Composer contract', () => {
  test('ordinary Copilot entry starts from teacher goal before source and context plumbing', async () => {
    const source = await composerSource();

    expect(source).toContain("from '../copilot/teacherFirstRequest'");
    expect(source).toContain('Cosa vuoi fare?');
    expect(source).toContain('Descrivi ciò che vuoi ottenere');
    expect(source).toContain('Per quale classe?');

    const goalIndex = source.indexOf('Cosa vuoi fare?');
    const sourceIndex = source.indexOf('Fonte della Biblioteca');
    const contextIndex = source.indexOf('Contesto didattico');

    expect(goalIndex).toBeGreaterThanOrEqual(0);
    expect(sourceIndex).toBeGreaterThan(goalIndex);
    expect(contextIndex).toBeGreaterThan(goalIndex);
  });

  test('teacher-facing fallback no longer exposes REVIEW LINK PREPARE implementation taxonomy', async () => {
    const source = await composerSource();

    expect(source).not.toContain('Non ho riconosciuto una richiesta tra revisione, collegamento e preparazione');
    expect(source).toContain('Dimmi cosa vuoi ottenere');
  });

  test('teacher-facing unavailable-intent guidance does not expose runtime taxonomy', async () => {
    const source = await composerSource();

    expect(source).not.toContain('L’interpretazione automatica dell’intento non è attiva.');
    expect(source).not.toContain('Core condiviso');
    expect(source).toContain('In questo momento posso proporti solo i passaggi già disponibili per il materiale e il contesto scelti.');
  });

  test('teacher-facing denial guidance keeps Core implementation language underneath the presentation', async () => {
    const source = await composerSource();

    expect(source).not.toContain('Ho compreso la richiesta, ma il Core non autorizza questa azione nel contesto corrente.');
    expect(source).not.toContain('Il Core non autorizza questo collegamento nel contesto corrente.');
    expect(source).toContain('Ho compreso la richiesta, ma questa azione non è disponibile nel contesto corrente.');
    expect(source).toContain('Questo collegamento non è disponibile nel contesto corrente.');
  });

  test('an explicit teacher-first PREPARE choice opens the governed disclosure without reclassifying the intent', async () => {
    const source = await composerSource();
    const handlerStart = source.indexOf('const handleTeacherFirstProceed = async () =>');
    const handlerEnd = source.indexOf('const handleResolve =', handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);
    const prepareStart = handler.indexOf("if (teacherFirstResolution.goalKind === 'prepare')");
    const nextResolution = handler.indexOf('const nextResolution', prepareStart);
    const prepareBranch = handler.slice(prepareStart, nextResolution);

    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    expect(prepareStart).toBeGreaterThanOrEqual(0);
    expect(prepareBranch).toContain('setIsPrepareOpen(true)');
    expect(prepareBranch).not.toContain('discoverLibraryCopilotIntent');
  });

  test('existing source/context launch keeps known bindings instead of restarting generic teacher-first resolution', async () => {
    const source = await composerSource();

    expect(source).toContain('const hasBoundLaunchContext');
    expect(source).toContain('!isBoundMissionFlow && !hasBoundLaunchContext');
    expect(source).toContain('data-testid="teacher-first-existing-bindings"');
    expect(source).toContain('Materiale già disponibile');
    expect(source).toContain('Contesto già disponibile');
  });

  test('a bound launch can disclose material controls explicitly without dropping the existing teaching binding', async () => {
    const source = await composerSource();
    const handlerStart = source.indexOf('const chooseTeacherFirstGoal =');
    const handlerEnd = source.indexOf('const handleTeacherFirstProceed =', handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handler).toContain("if (hasBoundLaunchContext && goal === 'material')");
    expect(handler).toContain('setTeacherFirstResolution({ ...framed, goalKind: goal })');
    expect(handler).not.toContain("if (hasBoundLaunchContext && goal === 'material') {\n      setContextOverride(null)");
  });

  test('a bound source/context PREPARE choice stays in the teacher-first governed handoff', async () => {
    const source = await composerSource();
    const handlerStart = source.indexOf('const chooseTeacherFirstGoal =');
    const handlerEnd = source.indexOf('const handleTeacherFirstProceed =', handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    expect(handler).toMatch(/hasBoundLaunchContext[^\n]*goal === 'prepare'/);
    expect(handler).toContain('setTeacherFirstResolution({ ...framed, goalKind: goal })');
  });

  test('selecting the material quick start preserves an already unambiguous automatic teaching context', async () => {
    const source = await composerSource();
    const handlerStart = source.indexOf('const chooseTeacherFirstGoal =');
    const handlerEnd = source.indexOf('const handleTeacherFirstProceed =', handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handler).toContain("if (goal !== 'material') setContextOverride(null);");
  });

  test('after an explicit source selection free text returns to governed conversational interpretation even when no UDA is required yet', async () => {
    const source = await composerSource();

    expect(source).toContain('const hasResolvedConversationContext = Boolean(selectedSource);');
    expect(source).toContain('!isBoundMissionFlow && !hasBoundLaunchContext && !hasResolvedConversationContext');
  });

  test('an explicitly selected source keeps material controls disclosed after free-text editing without exposing bound-launch plumbing by default', async () => {
    const source = await composerSource();
    const controlsStart = source.indexOf('const showMaterialControls =');
    const controlsEnd = source.indexOf(';', controlsStart);
    const controls = source.slice(controlsStart, controlsEnd + 1);

    expect(controlsStart).toBeGreaterThanOrEqual(0);
    expect(controls).toContain('Boolean(selectedSourceId && !hasBoundLaunchContext)');
  });

  test('existing governed agent and mission boundaries remain present behind the new entry flow', async () => {
    const source = await composerSource();

    expect(source).toContain('interpretCopilotIntent');
    expect(source).toContain('CopilotMissionBridge');
    expect(source).toContain('assertMissionRuntimeExecutionAuthorized');
    expect(source).toContain('LibraryProposalPanel');
  });
});
