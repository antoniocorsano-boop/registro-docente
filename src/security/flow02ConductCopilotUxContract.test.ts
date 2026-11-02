import { describe, expect, test } from 'bun:test';

const composer = await Bun.file(
  new URL('../components/LibraryCopilotComposer.tsx', import.meta.url)
).text();

function sectionBetween(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe('FLOW-02 conduct Copilot UX rework', () => {
  test('recognizes conduct as a dedicated presentation mode without granting direct-action authority', () => {
    expect(composer).toContain("const isConductLaunch = directLaunchIntent === 'conduct';");

    const directGate = sectionBetween(
      composer,
      'const hasCompleteDirectLaunch = Boolean(',
      'const teachingSuggestion = useMemo'
    );
    expect(directGate).toContain("directLaunchIntent === 'prepare'");
    expect(directGate).toContain("directLaunchIntent === 'review'");
    expect(directGate).toContain("directLaunchIntent === 'link'");
    expect(directGate).not.toContain("directLaunchIntent === 'conduct'");
  });

  test('does not infer a UDA automatically when conduct intentionally launches without an explicit teaching target', () => {
    const teachingSuggestion = sectionBetween(
      composer,
      'const teachingSuggestion = useMemo(() => {',
      'const resolvedTeachingContext ='
    );

    expect(teachingSuggestion).toContain("if (contextOverride !== 'auto' || hasLaunchTeachingTarget || isConductLaunch) return null;");
  });

  test('uses in-lesson language and never exposes the technical ambiguous-UDA phrase in conduct mode', () => {
    expect(composer).toContain('Supporto durante la lezione');
    expect(composer).toContain('La classe è già impostata. Descrivi ciò che ti serve adesso; il Copilota userà solo il contesto professionale già disponibile.');
    expect(composer).toContain('Che cosa ti serve adesso?');
    expect(composer).toContain('Per esempio: aiutami a spiegare questo passaggio in modo più semplice');

    const contextLabel = sectionBetween(
      composer,
      'const contextLabel =',
      'const linkTargetLabel = useMemo'
    );
    expect(contextLabel).toContain('isConductLaunch');
    expect(contextLabel).toContain('supporto durante la lezione');
  });

  test('keeps the generic teacher-first goal grid out of the conduct entry', () => {
    const entry = sectionBetween(
      composer,
      '<section className="space-y-3" data-testid="teacher-first-copilot-entry">',
      '{showTeachingContextControls && ('
    );
    expect(entry).toContain('isConductLaunch');
    expect(entry).toContain('!isConductLaunch');
    expect(entry).toContain('Preparare un’attività');
    expect(entry).toContain('Lavorare su un materiale');
    expect(entry).toContain('Collegare a una UDA');
    expect(entry).toContain('Rivedere qualcosa');
  });

  test('conduct submissions bypass generic teacher-first framing but remain fail-closed', () => {
    const handleResolve = sectionBetween(
      composer,
      'const handleResolve = (event: React.FormEvent) => {',
      'const handleBeginLink = async () => {'
    );
    expect(handleResolve).toContain('isConductLaunch');
    expect(handleResolve).toContain('void resolveObjective(message);');

    expect(composer).toContain('Ho capito che ti serve supporto durante la lezione, ma questa risposta non è ancora disponibile nel Copilota corrente. Posso continuare a usare il contesto della classe senza modificare registrazioni o valutazioni.');
    expect(composer).toContain('Per questa richiesta serve un materiale. Apri Materiali da Conduci, scegli la fonte e poi torna al Copilota.');
  });
});
