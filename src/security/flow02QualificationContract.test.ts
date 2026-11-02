import { describe, expect, test } from 'bun:test';

const FLOW_STATEMENT = 'Conduci is a mobile-first session orchestrator: it preserves the explicitly selected class, resolves lesson context deterministically, keeps rapid observations transient, exposes existing Privacy Shield and specialist tools, hands off explicitly to Registra, and performs no durable professional write.';

const registry = await Bun.file(
  new URL('../../qualification/invariants.v1.json', import.meta.url)
).json() as {
  invariants: Array<{
    id: string;
    owner: string;
    statement: string;
    impactPaths: string[];
    tests: string[];
    browserSmoke?: string[];
  }>;
};

const browserWorkflow = await Bun.file('.github/workflows/browser-qualification.yml').text();

describe('FLOW-02 qualification invariant', () => {
  test('publishes the canonical session-only Conduci invariant', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'FLOW-02-I01');

    expect(invariant).toBeDefined();
    expect(invariant?.owner).toBe('FLOW-02');
    expect(invariant?.statement).toBe(FLOW_STATEMENT);
  });

  test('covers every FLOW-02 product, integration and qualification path', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'FLOW-02-I01');
    const impactPaths = new Set(invariant?.impactPaths ?? []);

    for (const path of [
      'qualification/invariants.v1.json',
      'src/App.tsx',
      'src/conduct/',
      'src/components/ConductLessonPanel.tsx',
      'src/components/DashboardView.tsx',
      'src/components/CopilotExperience.tsx',
      'src/components/CopilotDeck.tsx',
      'src/components/LibraryCopilotComposer.tsx',
      'src/library/copilotLaunchContext.ts',
      'src/today/todayRouter.ts',
      'src/security/flow02ConductSessionContract.test.ts',
      'src/security/flow02ConductUiContract.test.ts',
      'src/security/flow02ConductCopilotUxContract.test.ts',
      'src/security/flow02AppIntegrationContract.test.ts',
      'src/security/flow02DashboardIntegrationContract.test.ts',
      'src/security/flow02BrowserQualificationContract.test.ts',
      'src/security/flow02QualificationContract.test.ts',
      'src/security/today01ContinuationContract.test.ts',
      'src/security/today01RouterContract.test.ts',
      'src/security/librarySingleCopilotSurfaceContract.test.ts',
      'tests/browser/flow-01-prepara.spec.cjs',
      'tests/browser/flow-02-conduci.spec.cjs',
      '.github/workflows/browser-qualification.yml'
    ]) {
      expect(impactPaths.has(path)).toBe(true);
    }
  });

  test('binds FLOW-02 to executable source contracts and dedicated Chromium evidence', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'FLOW-02-I01');
    const tests = new Set(invariant?.tests ?? []);
    const browserSmoke = new Set(invariant?.browserSmoke ?? []);

    for (const path of [
      'src/security/flow02ConductSessionContract.test.ts',
      'src/security/flow02ConductUiContract.test.ts',
      'src/security/flow02ConductCopilotUxContract.test.ts',
      'src/security/flow02AppIntegrationContract.test.ts',
      'src/security/flow02DashboardIntegrationContract.test.ts',
      'src/security/flow02BrowserQualificationContract.test.ts',
      'src/security/flow02QualificationContract.test.ts'
    ]) {
      expect(tests.has(path)).toBe(true);
    }

    expect(browserSmoke.has('tests/browser/qualification-invariant-smoke.spec.cjs')).toBe(true);
    expect(browserSmoke.has('tests/browser/flow-02-conduci.spec.cjs')).toBe(true);
  });

  test('runs dedicated FLOW-02 Chromium evidence after FLOW-01 and before historical regression', () => {
    expect(browserWorkflow).toContain('Run FLOW-01 Chromium qualification');
    expect(browserWorkflow).toContain('Run FLOW-02 Chromium qualification');
    expect(browserWorkflow).toContain('flow-02-conduci.spec.cjs');

    const flow01Index = browserWorkflow.indexOf('- name: Run FLOW-01 Chromium qualification');
    const flow02Index = browserWorkflow.indexOf('- name: Run FLOW-02 Chromium qualification');
    const historicalIndex = browserWorkflow.indexOf('- name: Run historical Chromium qualification');
    expect(flow01Index).toBeGreaterThanOrEqual(0);
    expect(flow02Index).toBeGreaterThan(flow01Index);
    expect(historicalIndex).toBeGreaterThan(flow02Index);
  });
});
