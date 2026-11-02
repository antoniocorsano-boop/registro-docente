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

describe('TODAY-01 session context contract', () => {
  test('stores the selected Oggi task only in App React session state', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain("import { resolveTodayRoute, type TodayAction } from './today/todayRouter';");
    expect(app).toContain("const [todayAction, setTodayAction] = useState<TodayAction | null>(null);");
  });

  test('starting a task never infers a class and keeps ambiguous context on Home', async () => {
    const app = await source('src/App.tsx');
    const start = sectionBetween(app, 'const handleStartTodayAction', 'const handleCancelTodayAction');

    expect(start).toContain('resolveTodayRoute(action, currentClassIdRef.current)');
    expect(start).toContain('setTodayAction(action)');
    expect(start).toContain("decision.status === 'needs-class'");
    expect(start).toContain("setActiveTab('home')");
    expect(start).not.toContain('currentClassIdRef.current =');
    expect(start).not.toContain('setAppData(');
  });

  test('cancel and return Home clear only the session task intent', async () => {
    const app = await source('src/App.tsx');
    const cancel = sectionBetween(app, 'const handleCancelTodayAction', '// Handle Class selection');
    const home = sectionBetween(app, 'const handleNavigateHome', '// Add new class');

    expect(cancel).toContain('setTodayAction(null)');
    expect(cancel).not.toContain('currentClassIdRef.current =');
    expect(cancel).not.toContain('setAppData(');
    expect(home).toContain('setTodayAction(null)');
    expect(home).toContain('currentClassIdRef.current = null;');
  });

  test('wires Home to the session intent while preserving explicit class selection', async () => {
    const app = await source('src/App.tsx');
    const homeRender = sectionBetween(app, "{activeTab === 'home' && (", "{/* TAB 2: Dashboard Classe */}");
    const classSelection = sectionBetween(app, '// Handle Class selection', 'const handleNavigateHome');

    expect(homeRender).toContain('onStartTodayAction={handleStartTodayAction}');
    expect(homeRender).toContain('pendingTodayAction={todayAction}');
    expect(homeRender).toContain('onCancelTodayAction={handleCancelTodayAction}');
    expect(classSelection).toContain('currentClassIdRef.current = classId;');
    expect(classSelection).toContain("setActiveTab('dashboard')");
    expect(classSelection).not.toContain('setTodayAction(null)');
  });

  test('does not add todayAction to durable app or backup schemas', async () => {
    const [types, storage, backup] = await Promise.all([
      source('src/types.ts'),
      source('src/security/secureAppStorage.ts'),
      source('src/security/backupPayload.ts')
    ]);

    expect(types).not.toContain('todayAction');
    expect(storage).not.toContain('todayAction');
    expect(backup).not.toContain('todayAction');
  });
});