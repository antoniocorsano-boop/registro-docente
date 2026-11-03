import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-03B browser qualification contract', () => {
  test('materializes a dedicated desktop/mobile post-record UX journey', async () => {
    const spec = await source('tests/browser/flow-03b-post-record-ux.spec.cjs').catch(() => '');

    expect(spec).toContain("test.describe('FLOW-03B desktop qualification'");
    expect(spec).toContain("test.describe('FLOW-03B mobile qualification'");
    expect(spec).toContain("viewport: { width: 390, height: 844 }");
    expect(spec).toContain('installPageErrorCollector(page)');
    expect(spec).toContain("data-testid=\"flow03b-class-overview\"");
    expect(spec).toContain("data-testid=\"library-copilot-trigger\"");
    expect(spec).toContain('Dati Salvati in Locale con Successo!');
    expect(spec).toContain('Prima destinazione consigliata: Tabellone.');
    expect(spec).toContain('flow-03b-mobile-active-record.png');
    expect(spec).toContain('flow-03b-desktop-review.png');
    expect(spec).toContain('expect(pageErrors).toEqual([])');
  });

  test('runs FLOW-03B after FLOW-03 and before cross-surface regressions', async () => {
    const workflow = await source('.github/workflows/browser-qualification.yml');

    expect(workflow).toContain('cp tests/browser/flow-03b-post-record-ux.spec.cjs .browser-tools/flow-03b-post-record-ux.spec.cjs');
    expect(workflow).toContain('Run FLOW-03B Chromium qualification');
    expect(workflow).toContain('flow-03b-post-record-ux.spec.cjs');

    const flow03 = workflow.indexOf('Run FLOW-03 Chromium qualification');
    const flow03b = workflow.indexOf('Run FLOW-03B Chromium qualification');
    const lsm = workflow.indexOf('Run LSM-01C consumer Chromium qualification');
    expect(flow03).toBeGreaterThanOrEqual(0);
    expect(flow03b).toBeGreaterThan(flow03);
    expect(lsm).toBeGreaterThan(flow03b);
  });
});
