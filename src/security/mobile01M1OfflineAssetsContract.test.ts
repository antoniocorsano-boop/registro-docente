import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

const BASE = new URL('../../', import.meta.url);
const load = async (p: string) => Bun.file(new URL(p, BASE)).text();

const pdfScript = 'public/vendor/jspdf.umd.min.js';
const licensePath = 'public/vendor/jspdf.LICENSE.txt';

function gitBlobSha1(source: string): string {
  const data = Buffer.from(source);
  return createHash('sha1').update('blob ' + data.byteLength + '\0').update(data).digest('hex');
}

describe('MOBILE-01/M1 offline PDF and typography assets', () => {
  test('pins the exact upstream jsPDF 4.2.1 UMD asset and license', async () => {
    const bundle = await load(pdfScript);
    const notices = await load(licensePath);
    expect(gitBlobSha1(bundle)).toBe('0e600d49d2b2bf81dd97c1509e22d108c2ddd3b4');
    expect(gitBlobSha1(notices)).toBe('dc7d3a9fa305defebad6cb88ba4cd9776f26fcd3');
    expect(bundle).toContain('Version 4.2.1');
    expect(notices).toContain('Permission is hereby granted');
    expect(await Bun.file(new URL('public/vendor/html2pdf.bundle.min.js', BASE)).exists()).toBe(false);
    expect(await Bun.file(new URL('public/vendor/html2pdf.bundle.min.js.LICENSE.txt', BASE)).exists()).toBe(false);
  });

  test('loads no third-party PDF library or font at runtime', async () => {
    const index = await load('index.html');
    const css = await load('src/index.css');
    expect(index).toContain('<script src="/vendor/jspdf.umd.min.js"></script>');
    for (const host of ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com']) {
      expect(index).not.toContain(host);
    }
    expect(index).not.toMatch(/<link[^>]+https:\/\//);
    expect(css).toContain('font-family: system-ui,');
    expect(css).not.toContain("'Plus Jakarta Sans'");
  });

  test('preserves the existing offline-capable client-side PDF output path rather than substituting a fake report', async () => {
    const analytics = await load('src/components/AnalyticsView.tsx');
    expect(analytics).toContain('await renderWorkPdf(element)');
    expect(analytics).toContain("URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))");
    expect(analytics).not.toContain('html2pdf()');
    const exportFlow = analytics.slice(analytics.indexOf('const handleExportPDF'), analytics.indexOf('\n  return (', analytics.indexOf('const handleExportPDF')));
    expect(exportFlow).not.toContain('window.print()');
    const generator = await load('src/security/localPdf.ts');
    expect(generator).toContain('runtime.jspdf?.jsPDF');
    expect(generator).not.toContain('.html(');
    expect(analytics).toContain('handleExportPDF');
    const packageJson = JSON.parse(await load('package.json'));
    expect(packageJson.dependencies?.['html2pdf.js']).toBeUndefined();
    // Device fonts vary: the teacher's 320 px analysis selector must wrap rather
    // than overflowing a fixed row after external web fonts are removed.
    const assessments = await load('src/components/VerificheOnlineView.tsx');
    expect(assessments).toContain('className="flex min-w-0 flex-wrap items-center gap-2"');
    expect(assessments).toContain('className="p-2 neon-input text-xs text-white bg-slate-900 min-w-0 w-full sm:w-auto sm:max-w-full"');
  });
});
