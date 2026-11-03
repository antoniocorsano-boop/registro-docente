import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-04 browser qualification contract', () => {
  test('materializes one dedicated Chromium review-session journey', () => {
    expect(existsSync('tests/browser/flow-04-review-session.spec.cjs')).toBe(true);
  });

  test('browser workflow copies and runs FLOW-04 after FLOW-03 on the exact candidate SHA', async () => {
    const workflow = await source('.github/workflows/browser-qualification.yml');

    expect(workflow).toContain('env:\n  CANDIDATE_SHA: ${{ github.event.pull_request.head.sha || github.sha }}');
    expect(workflow).toContain('ref: ${{ env.CANDIDATE_SHA }}');
    expect(workflow).toContain('Verify exact candidate checkout');
    expect(workflow).toContain('cp tests/browser/flow-04-review-session.spec.cjs .browser-tools/flow-04-review-session.spec.cjs');
    expect(workflow).toContain('name: Run FLOW-04 Chromium qualification');
    expect(workflow).toContain('flow-04-review-session.spec.cjs');
    expect(workflow).toContain('--output=../browser-evidence/flow-04-test-results');

    const flow03Run = workflow.indexOf('name: Run FLOW-03 Chromium qualification');
    const flow04Run = workflow.indexOf('name: Run FLOW-04 Chromium qualification');
    const historicalRun = workflow.indexOf('name: Run historical Chromium qualification');
    expect(flow03Run).toBeGreaterThan(-1);
    expect(flow04Run).toBeGreaterThan(flow03Run);
    expect(historicalRun).toBeGreaterThan(flow04Run);
  });

  test('journey proves Oggi review continuity, failure modes and mobile 390x844 geometry', async () => {
    expect(existsSync('tests/browser/flow-04-review-session.spec.cjs')).toBe(true);
    if (!existsSync('tests/browser/flow-04-review-session.spec.cjs')) return;
    const spec = await source('tests/browser/flow-04-review-session.spec.cjs');

    for (const marker of [
      'Oggi → Rivedi',
      'Rivedi la classe ${CLASS_NAME}',
      'Missione Rivedi',
      'Torna a Rivedi',
      'Superficie corrente: Tabellone',
      'Superficie corrente: Analisi',
      'class switch closes the prior review mission',
      'non-review navigation closes the mission',
      'assertNoHorizontalOverflow',
      'assertTouchSafe',
      'expect(pageErrors).toEqual([])'
    ]) {
      expect(spec).toContain(marker);
    }

    expect(spec).toContain("viewport: { width: 1280, height: 900 }");
    expect(spec).toContain("viewport: { width: 390, height: 844 }");
  });

  test('journey proves Registra → Rivedi keeps evidence ordering without auto-opening a surface', async () => {
    expect(existsSync('tests/browser/flow-04-review-session.spec.cjs')).toBe(true);
    if (!existsSync('tests/browser/flow-04-review-session.spec.cjs')) return;
    const spec = await source('tests/browser/flow-04-review-session.spec.cjs');

    for (const marker of [
      'Registra → Rivedi',
      "['Tabellone', 'Analisi', 'Storico', 'Scheda alunno']",
      'no destination auto-opens',
      'opening the first destination keeps the banner',
      'returning keeps contextual ordering'
    ]) {
      expect(spec).toContain(marker);
    }
  });

  test('FLOW-04 invariant binds the dedicated browser evidence and source contract', async () => {
    const registry = JSON.parse(await source('qualification/invariants.v1.json')) as {
      invariants?: Array<{ id?: string; tests?: string[]; browserSmoke?: string[] }>;
    };
    const invariant = registry.invariants?.find(item => item.id === 'FLOW-04-I01');

    expect(invariant).toBeDefined();
    expect(invariant?.tests).toContain('src/security/flow04BrowserQualificationContract.test.ts');
    expect(invariant?.browserSmoke).toContain('tests/browser/flow-04-review-session.spec.cjs');
  });
});
