import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

function sectionBetween(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe('FLOW-03 focused authoritative UDA diary contract', () => {
  test('activates focused mode without creating a second diary authority', async () => {
    const gantt = await source('src/components/UdaGanttView.tsx');

    expect(gantt).toContain('focusedRecordMode = false');
    expect(gantt).toContain('const [showFocusedRecordDetails, setShowFocusedRecordDetails] = useState(false);');
    expect(gantt).toContain('if (focusedRecordMode) setShowFocusedRecordDetails(false);');
    expect(gantt).toContain('{!focusedRecordMode && (');
    expect(gantt).toContain('Registrazione rapida');
    expect(gantt).toContain('Mostra dettagli UDA');
    expect(gantt).toContain('setShowFocusedRecordDetails(true)');
  });

  test('keeps planning details and lesson history behind explicit disclosure', async () => {
    const gantt = await source('src/components/UdaGanttView.tsx');
    const dossier = sectionBetween(
      gantt,
      '{selectedUdaForDetail && (() => {',
      '{/* MODAL: INFO INDICE ATTIVITÀ UDA */}'
    );

    expect(dossier.match(/!focusedRecordMode \|\| showFocusedRecordDetails/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(dossier).toContain("3. Diario delle Lezioni & Tipologie di Attività");
    expect(dossier).toContain('ref={recordLessonFormRef} onSubmit={handleAddLesson}');
    expect(dossier).toContain('placeholder="Argomento o fase operativa svolta..."');
    expect(dossier).toContain('placeholder="Note professionali opzionali sulla lezione..."');
  });

  test('preserves the existing durable lesson mutation as the only completion authority', async () => {
    const gantt = await source('src/components/UdaGanttView.tsx');
    const addLesson = sectionBetween(gantt, 'const handleAddLesson', '// Remove lesson from UDA');

    expect(addLesson).toContain('void commitUdaViewMutation(nextUdas, () => {');
    expect(addLesson).toContain('onRecordLessonCommitted?.(updatedUda.id, navigationVersionAtSave);');
    expect(addLesson).not.toContain('focusedRecordMode');
  });
});