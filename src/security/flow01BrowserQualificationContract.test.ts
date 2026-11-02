import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-01 browser qualification contract', () => {
  test('materializes a dedicated Chromium journey', () => {
    expect(existsSync('tests/browser/flow-01-prepara.spec.cjs')).toBe(true);
  });

  test('copies the FLOW-01 journey into the isolated Playwright toolchain', async () => {
    const workflow = await source('.github/workflows/browser-qualification.yml');
    expect(workflow).toContain('cp tests/browser/flow-01-prepara.spec.cjs .browser-tools/flow-01-prepara.spec.cjs');
  });

  test('runs FLOW-01 as an explicit qualification gate before historical regression', async () => {
    const workflow = await source('.github/workflows/browser-qualification.yml');
    expect(workflow).toContain('- name: Run FLOW-01 Chromium qualification');
    expect(workflow).toContain('flow-01-prepara.spec.cjs');
    expect(workflow).toContain('--output=../browser-evidence/flow-01-test-results');

    const flowIndex = workflow.indexOf('- name: Run FLOW-01 Chromium qualification');
    const historicalIndex = workflow.indexOf('- name: Run historical Chromium qualification');
    expect(flowIndex).toBeGreaterThanOrEqual(0);
    expect(historicalIndex).toBeGreaterThan(flowIndex);
  });

  test('browser journey is required to emit desktop and 390x844 review evidence', async () => {
    if (!existsSync('tests/browser/flow-01-prepara.spec.cjs')) return;
    const spec = await source('tests/browser/flow-01-prepara.spec.cjs');

    for (const evidence of [
      'flow-01-desktop-router.png',
      'flow-01-desktop-copilot.png',
      'flow-01-mobile-router.png',
      'flow-01-mobile-copilot.png'
    ]) {
      expect(spec).toContain(evidence);
    }
    expect(spec).toContain('width: 390, height: 844');
    expect(spec).toContain('assertNoHorizontalOverflow');
  });
});
