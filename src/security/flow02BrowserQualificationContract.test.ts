import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-02 browser qualification contract', () => {
  test('materializes one dedicated Chromium journey', () => {
    expect(existsSync('tests/browser/flow-02-conduci.spec.cjs')).toBe(true);
  });

  test('browser workflow installs and runs the dedicated FLOW-02 spec', async () => {
    const workflow = await source('.github/workflows/browser-qualification.yml');

    expect(workflow).toContain('cp tests/browser/flow-02-conduci.spec.cjs .browser-tools/flow-02-conduci.spec.cjs');
    expect(workflow).toContain('name: Run FLOW-02 Chromium qualification');
    expect(workflow).toContain('flow-02-conduci.spec.cjs');
    expect(workflow).toContain('--output=../browser-evidence/flow-02-test-results');
  });

  test('journey captures desktop and mobile evidence for the in-lesson moment', async () => {
    if (!existsSync('tests/browser/flow-02-conduci.spec.cjs')) return;
    const spec = await source('tests/browser/flow-02-conduci.spec.cjs');

    for (const evidence of [
      'flow-02-desktop-conduct.png',
      'flow-02-mobile-conduct-viewport.png',
      'flow-02-mobile-conduct.png',
      'flow-02-mobile-note.png',
      'flow-02-mobile-privacy.png',
      'flow-02-mobile-copilot.png',
      'flow-02-mobile-record-handoff.png'
    ]) {
      expect(spec).toContain(evidence);
    }

    expect(spec).toContain("viewport: { width: 390, height: 844 }");
    expect(spec).toContain('Temporanea — non ancora registrata');
    expect(spec).toContain('Privacy Shield');
    expect(spec).toContain('Vai a Registra');
  });

  test('journey proves mobile geometry and privacy boundaries', async () => {
    if (!existsSync('tests/browser/flow-02-conduci.spec.cjs')) return;
    const spec = await source('tests/browser/flow-02-conduci.spec.cjs');

    expect(spec).toContain('assertNoHorizontalOverflow');
    expect(spec).toContain('assertStickyHeaderClearsConductPanel');
    expect(spec).toContain('assertCriticalControlsTouchSafe');
    expect(spec).toContain('assertTextareaNotCoveredByFixedBottomControl');
    expect(spec).toContain("expect(composer).not.toContainText(RAPID_NOTE)");
    expect(spec).toContain("expect(composer).toContainText(CLASS_NAME)");
  });

  test('journey proves explicit Registra handoff retains the selected class', async () => {
    if (!existsSync('tests/browser/flow-02-conduci.spec.cjs')) return;
    const spec = await source('tests/browser/flow-02-conduci.spec.cjs');

    expect(spec).toContain("getByRole('button', { name: 'Vai a Registra', exact: true })");
    expect(spec).toContain("getByRole('region', { name: `Registra per ${CLASS_NAME}` })");
    expect(spec).toContain("getByLabel('Nota di sessione', { exact: true })");
    expect(spec).toContain('toHaveValue(RAPID_NOTE)');
    expect(spec).toContain('assertSelectedClassStillVisible');
  });
});
