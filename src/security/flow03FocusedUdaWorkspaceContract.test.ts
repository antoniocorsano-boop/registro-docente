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

describe('FLOW-03 focused UDA workspace contract', () => {
  test('keeps focused UDA selection session-only and bound to the recording class', async () => {
    const workspace = await source('src/components/UdaWorkspaceView.tsx');

    expect(workspace).toContain('const isFocusedRecordMode = Boolean(recordLessonPrefill);');
    expect(workspace).toContain('const [focusedRecordUdaId, setFocusedRecordUdaId]');
    expect(workspace).toContain("setActiveView(recordLessonPrefill.udaId ? 'planning' : 'uda');");
    expect(workspace).toContain('const focusedClassUdas = useMemo(');
    expect(workspace).toContain('uda.className === recordLessonPrefill.className');
    expect(workspace).toContain('const effectiveRecordLessonPrefill =');
  });

  test('asks for an explicit same-class UDA without exposing the general workspace controls', async () => {
    const workspace = await source('src/components/UdaWorkspaceView.tsx');
    const selection = sectionBetween(
      workspace,
      "if (isFocusedRecordMode && activeView === 'uda')",
      "if (isFocusedRecordMode && activeView === 'planning')"
    );

    expect(selection).toContain('aria-label="Seleziona UDA per Registra"');
    expect(selection).toContain('Scegli questa UDA');
    expect(selection).toContain('setFocusedRecordUdaId(uda.id)');
    expect(selection).toContain("setActiveView('planning')");
    expect(selection).not.toContain('onSaveUdas(');
    expect(selection).not.toContain('+ Nuova UDA');
    expect(selection).not.toContain('Viste UDA');
  });

  test('passes only the explicitly resolved prefill into the authoritative planning surface', async () => {
    const workspace = await source('src/components/UdaWorkspaceView.tsx');
    const gantt = await source('src/components/UdaGanttView.tsx');
    const focusedPlanning = sectionBetween(
      workspace,
      "if (isFocusedRecordMode && activeView === 'planning')",
      'return ('
    );

    expect(focusedPlanning).toContain('<LegacyUdaGanttView');
    expect(focusedPlanning).toContain('recordLessonPrefill={effectiveRecordLessonPrefill}');
    expect(focusedPlanning).toContain('focusedRecordMode={true}');
    expect(gantt).toContain('focusedRecordMode?: boolean;');
  });
});
