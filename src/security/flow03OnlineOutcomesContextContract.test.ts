import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-03 online outcomes context contract', () => {
  test('accepts an optional explicit class, opens the explicit outcomes action surface and imports nothing on mount', async () => {
    const view = await source('src/components/VerificheOnlineView.tsx');

    expect(view).toContain('initialClassName?: string;');
    expect(view).toContain('initialClassName,');
    expect(view).toContain('if (!initialClassName) return;');
    expect(view).toContain('const safeClass = classes.find(item => item.name === initialClassName);');
    expect(view).toContain('setSelectedClass(safeClass.name);');
    expect(view).toContain("setActiveSubTab('analisi');");

    const effectStart = view.indexOf('if (!initialClassName) return;');
    const effectEnd = view.indexOf('}, [classes, initialClassName]);', effectStart);
    expect(effectStart).toBeGreaterThanOrEqual(0);
    expect(effectEnd).toBeGreaterThan(effectStart);
    const effect = view.slice(effectStart, effectEnd);
    expect(effect).toContain("setActiveSubTab('analisi');");
    expect(effect).not.toContain('onImportSubmissionsToRegister(');
    expect(effect).not.toContain('handleImportSubmissions(');
  });

  test('App supplies the explicit class only for the matching FLOW-03 online-outcomes session', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain("initialClassName={recordSession?.status === 'editing'");
    expect(app).toContain("&& recordSession.evidenceKind === 'online-outcomes'");
    expect(app).toContain('&& recordSession.context.classId === currentClass?.id');
    expect(app).toContain('? recordSession.context.className');
  });
});
