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

describe('FLOW-03 safe evaluation prefill contract', () => {
  test('accepts optional session-only initial UDA/date inputs without changing the save contract', async () => {
    const view = await source('src/components/EvaluationsView.tsx');

    expect(view).toContain('initialUdaId?: string;');
    expect(view).toContain('initialDate?: string;');
    expect(view).toContain('onSaveEvaluations: (batchData: {');
    expect(view).toContain('}) => Promise<void>;');
  });

  test('prefills only a new evaluation and validates UDA ownership against the current class', async () => {
    const view = await source('src/components/EvaluationsView.tsx');
    const effect = sectionBetween(view, 'useEffect(() => {', 'const handleInputChange');

    expect(effect).toContain('if (editingBatchId)');
    expect(effect).toContain("const safeInitialUdaId = udas.some(u => u.id === initialUdaId && u.className === currentClass.name)");
    expect(effect).toContain("? initialUdaId || ''");
    expect(effect).toContain("setUdaId(safeInitialUdaId);");
    expect(effect).toContain("setDate(isIsoDate(initialDate) ? initialDate! : today());");
    expect(effect.indexOf('const safeInitialUdaId')).toBeLessThan(effect.indexOf('if (editingBatchId)'));
    expect(effect.indexOf('setUdaId(existingGrades[0].udaId || \'\');')).toBeLessThan(effect.indexOf('setUdaId(safeInitialUdaId);'));
  });

  test('keeps UDA/date fully reviewable and never auto-submits the prefill', async () => {
    const view = await source('src/components/EvaluationsView.tsx');

    expect(view).toContain('value={udaId}');
    expect(view).toContain('onChange={e => setUdaId(e.target.value)}');
    expect(view).toContain('value={date}');
    expect(view).toContain('onChange={e => setDate(e.target.value)}');
    expect(view).not.toContain('onSaveEvaluations({\n        batchId: uid()');
    expect(view).not.toContain('useEffect(() => {\n    onSaveEvaluations');
  });

  test('filters the visible UDA choices to the selected class instead of offering cross-class targets', async () => {
    const view = await source('src/components/EvaluationsView.tsx');

    expect(view).toContain('udas.filter(u => u.className === currentClass.name).map(u => (');
  });

  test('App supplies FLOW-03 initial context only for the matching evaluation session', async () => {
    const app = await source('src/App.tsx');
    const render = sectionBetween(app, "{activeTab === 'voti' && currentClass && (", '{/* TAB 4: Valutazione Comportamenti */}');

    expect(render).toContain("initialUdaId={recordSession?.status === 'editing' && recordSession.evidenceKind === 'evaluation'");
    expect(render).toContain('? recordSession.context.udaId');
    expect(render).toContain(': undefined}');
    expect(render).toContain("initialDate={recordSession?.status === 'editing' && recordSession.evidenceKind === 'evaluation' ? today() : undefined}");
  });
});
