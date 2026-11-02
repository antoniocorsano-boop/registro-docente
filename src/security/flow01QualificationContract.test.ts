import { describe, expect, test } from 'bun:test';

const FLOW_STATEMENT = 'Prepara is a session-only professional-intent router: it preserves the explicitly selected class, delegates to existing authoritative preparation surfaces, opens Copilota with class-only prepare intent, and never persists or invents preparation targets.';

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

describe('FLOW-01 qualification invariant', () => {
  test('publishes the canonical session-only Prepara invariant', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'FLOW-01-I01');

    expect(invariant).toBeDefined();
    expect(invariant?.owner).toBe('FLOW-01');
    expect(invariant?.statement).toBe(FLOW_STATEMENT);
  });

  test('covers every FLOW-01 product, integration and qualification path', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'FLOW-01-I01');
    const impactPaths = new Set(invariant?.impactPaths ?? []);

    for (const path of [
      'qualification/invariants.v1.json',
      'src/App.tsx',
      'src/preparation/',
      'src/today/todayRouter.ts',
      'src/components/PreparationRouterPanel.tsx',
      'src/components/DashboardView.tsx',
      'src/security/flow01PreparationRouterContract.test.ts',
      'src/security/flow01PreparationUiContract.test.ts',
      'src/security/flow01AppIntegrationContract.test.ts',
      'src/security/flow01BrowserQualificationContract.test.ts',
      'src/security/flow01QualificationContract.test.ts',
      'tests/browser/flow-01-prepara.spec.cjs',
      '.github/workflows/browser-qualification.yml'
    ]) {
      expect(impactPaths.has(path)).toBe(true);
    }
  });

  test('binds FLOW-01 to executable source contracts and dedicated Chromium evidence', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'FLOW-01-I01');
    const tests = new Set(invariant?.tests ?? []);
    const browserSmoke = new Set(invariant?.browserSmoke ?? []);

    for (const path of [
      'src/security/flow01PreparationRouterContract.test.ts',
      'src/security/flow01PreparationUiContract.test.ts',
      'src/security/flow01AppIntegrationContract.test.ts',
      'src/security/flow01BrowserQualificationContract.test.ts',
      'src/security/flow01QualificationContract.test.ts'
    ]) {
      expect(tests.has(path)).toBe(true);
    }

    expect(browserSmoke.has('tests/browser/qualification-invariant-smoke.spec.cjs')).toBe(true);
    expect(browserSmoke.has('tests/browser/flow-01-prepara.spec.cjs')).toBe(true);
  });

  test('runs dedicated FLOW-01 Chromium evidence before historical regression', () => {
    expect(browserWorkflow).toContain('Run FLOW-01 Chromium qualification');
    expect(browserWorkflow).toContain('flow-01-prepara.spec.cjs');

    const flowIndex = browserWorkflow.indexOf('- name: Run FLOW-01 Chromium qualification');
    const historicalIndex = browserWorkflow.indexOf('- name: Run historical Chromium qualification');
    expect(flowIndex).toBeGreaterThanOrEqual(0);
    expect(historicalIndex).toBeGreaterThan(flowIndex);
  });
});
