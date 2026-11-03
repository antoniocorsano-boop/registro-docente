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
  test('stores the selected Oggi task and FLOW-04 review mission only in App React session state', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain("import { resolveTodayRoute, type TodayAction } from './today/todayRouter';");
    expect(app).toContain("const [todayAction, setTodayAction] = useState<TodayAction | null>(null);");
    expect(app).toContain('const [reviewSession, setReviewSession] = useState<ReviewSessionContext | null>(null);');
  });

  test('starting a task never infers a class and builds ReviewSession only after explicit resolution', async () => {
    const app = await source('src/App.tsx');
    const start = sectionBetween(app, 'const handleStartTodayAction', 'const handleCancelTodayAction');

    expect(start).toContain('resolveTodayRoute(action, currentClassIdRef.current)');
    expect(start).toContain('setTodayAction(action)');
    expect(start).toContain("decision.status === 'needs-class'");
    expect(start).toContain("setActiveTab('home')");
    expect(start).toContain("if (action === 'review')");
    expect(start).toContain('publishReviewSession(buildReviewSession({');
    expect(start).toContain("origin: 'today-review'");
    expect(start.indexOf("decision.status === 'needs-class'")).toBeLessThan(start.indexOf("origin: 'today-review'"));
    expect(start).not.toContain('currentClassIdRef.current =');
    expect(start).not.toContain('setAppData(');
  });

  test('cancel and return Home clear only transient task and mission intent', async () => {
    const app = await source('src/App.tsx');
    const cancel = sectionBetween(app, 'const handleCancelTodayAction', '// Handle Class selection');
    const home = sectionBetween(app, 'const handleNavigateHome', '// Add new class');

    expect(cancel).toContain('setTodayAction(null)');
    expect(cancel).toContain('publishReviewSession(null)');
    expect(cancel).not.toContain('currentClassIdRef.current =');
    expect(cancel).not.toContain('setAppData(');
    expect(home).toContain('setTodayAction(null)');
    expect(home).toContain('publishReviewSession(null)');
    expect(home).toContain('currentClassIdRef.current = null;');
  });

  test('wires Home to pending review intent while preserving explicit class authority', async () => {
    const app = await source('src/App.tsx');
    const homeRender = sectionBetween(app, "{activeTab === 'home' && (", "{/* TAB 2: Dashboard Classe */}");
    const classSelection = sectionBetween(app, '// Handle Class selection', 'const handleNavigateHome');

    expect(homeRender).toContain('onStartTodayAction={handleStartTodayAction}');
    expect(homeRender).toContain('pendingTodayAction={todayAction}');
    expect(homeRender).toContain('onCancelTodayAction={handleCancelTodayAction}');
    expect(classSelection).toContain('currentClassIdRef.current = classId;');
    expect(classSelection).toContain("setActiveTab('dashboard')");
    expect(classSelection).toContain('const shouldStartPendingReview =');
    expect(classSelection).toContain('publishReviewSession(buildReviewSession({');
  });

  test('does not add todayAction or ReviewSession to durable app or backup schemas', async () => {
    const [types, storage, backup] = await Promise.all([
      source('src/types.ts'),
      source('src/security/secureAppStorage.ts'),
      source('src/security/backupPayload.ts')
    ]);

    expect(types).not.toContain('todayAction');
    expect(storage).not.toContain('todayAction');
    expect(backup).not.toContain('todayAction');
    expect(types).not.toContain('reviewSession');
    expect(storage).not.toContain('reviewSession');
    expect(backup).not.toContain('reviewSession');
  });
});