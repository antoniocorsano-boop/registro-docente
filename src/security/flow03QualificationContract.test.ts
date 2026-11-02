import { describe, expect, test } from 'bun:test';

const FLOW_STATEMENT = 'Registra is a session-only recording orchestrator: it preserves explicit professional context, carries staged lesson evidence without auto-writing it, delegates all durable writes to authoritative specialist surfaces, preserves drafts on failure, and offers Rivedi only after a matching successful durable mutation.';

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

describe('FLOW-03 qualification invariant', () => {
  test('publishes the canonical session-only Registra invariant', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'FLOW-03-I01');

    expect(invariant).toBeDefined();
    expect(invariant?.owner).toBe('FLOW-03');
    expect(invariant?.statement).toBe(FLOW_STATEMENT);
  });

  test('covers every FLOW-03 product, specialist and qualification path', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'FLOW-03-I01');
    const impactPaths = new Set(invariant?.impactPaths ?? []);

    for (const path of [
      'qualification/invariants.v1.json',
      'src/App.tsx',
      'src/recording/',
      'src/components/RecordLessonPanel.tsx',
      'src/components/ConductLessonPanel.tsx',
      'src/components/DashboardView.tsx',
      'src/components/EvaluationsView.tsx',
      'src/components/BehaviorsView.tsx',
      'src/components/VerificheOnlineView.tsx',
      'src/components/UdaWorkspaceView.tsx',
      'src/components/UdaGanttView.tsx',
      'src/today/todayRouter.ts',
      'src/security/flow03RecordSessionContract.test.ts',
      'src/security/flow03ConductHandoffContract.test.ts',
      'src/security/flow03RecordUiContract.test.ts',
      'src/security/flow03AppIntegrationContract.test.ts',
      'src/security/flow03EvaluationPrefillContract.test.ts',
      'src/security/flow03BehaviourExplicitContract.test.ts',
      'src/security/flow03OnlineOutcomesContextContract.test.ts',
      'src/security/flow03UdaDiaryHandoffContract.test.ts',
      'src/security/flow03BrowserQualificationContract.test.ts',
      'src/security/flow03QualificationContract.test.ts',
      'tests/browser/flow-02-conduci.spec.cjs',
      'tests/browser/flow-03-registra.spec.cjs',
      '.github/workflows/browser-qualification.yml'
    ]) {
      expect(impactPaths.has(path)).toBe(true);
    }
  });

  test('binds FLOW-03 to executable source contracts and dedicated Chromium evidence', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'FLOW-03-I01');
    const tests = new Set(invariant?.tests ?? []);
    const browserSmoke = new Set(invariant?.browserSmoke ?? []);

    for (const path of [
      'src/security/flow03RecordSessionContract.test.ts',
      'src/security/flow03ConductHandoffContract.test.ts',
      'src/security/flow03RecordUiContract.test.ts',
      'src/security/flow03AppIntegrationContract.test.ts',
      'src/security/flow03EvaluationPrefillContract.test.ts',
      'src/security/flow03BehaviourExplicitContract.test.ts',
      'src/security/flow03OnlineOutcomesContextContract.test.ts',
      'src/security/flow03UdaDiaryHandoffContract.test.ts',
      'src/security/flow03BrowserQualificationContract.test.ts',
      'src/security/flow03QualificationContract.test.ts'
    ]) {
      expect(tests.has(path)).toBe(true);
    }

    expect(browserSmoke.has('tests/browser/qualification-invariant-smoke.spec.cjs')).toBe(true);
    expect(browserSmoke.has('tests/browser/flow-03-registra.spec.cjs')).toBe(true);
  });

  test('runs dedicated FLOW-03 Chromium evidence after FLOW-02 and before historical regression', () => {
    expect(browserWorkflow).toContain('Run FLOW-02 Chromium qualification');
    expect(browserWorkflow).toContain('Run FLOW-03 Chromium qualification');
    expect(browserWorkflow).toContain('flow-03-registra.spec.cjs');

    const flow02Index = browserWorkflow.indexOf('- name: Run FLOW-02 Chromium qualification');
    const flow03Index = browserWorkflow.indexOf('- name: Run FLOW-03 Chromium qualification');
    const historicalIndex = browserWorkflow.indexOf('- name: Run historical Chromium qualification');
    expect(flow02Index).toBeGreaterThanOrEqual(0);
    expect(flow03Index).toBeGreaterThan(flow02Index);
    expect(historicalIndex).toBeGreaterThan(flow03Index);
  });
});
