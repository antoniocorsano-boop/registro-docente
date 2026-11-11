import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

const BASE = new URL('../../', import.meta.url);
const load = async (p: string) => Bun.file(new URL(p, BASE)).text();

const pdfScript = 'public/vendor/html2pdf.bundle.min.js';
const licensePath = 'public/vendor/html2pdf.bundle.min.js.LICENSE.txt';

function gitBlobSha1(source: string): string {
  const data = Buffer.from(source);
  return createHash('sha1').update('blob ' + data.byteLength + '\0').update(data).digest('hex');
}

describe('MOBILE-01/M1 offline PDF and typography assets', () => {
  test('pins the exact previously used html2pdf.js 0.10.1 library including third-party notices', async () => {
    const bundle = await load(pdfScript);
    const notices = await load(licensePath);
    expect(gitBlobSha1(bundle)).toBe('c57dc9292239c50312222b91f45613b5cb93518c');
    expect(gitBlobSha1(notices)).toBe('7cc52ed18f3e7f0e8b62ae003872b5031ea80635');
    expect(bundle).toContain('html2pdf.bundle.min.js.LICENSE.txt');
    expect(notices).toContain('html2pdf.js v0.10.1');
    expect(notices).toContain('MIT License');
  });

  test('loads no third-party PDF library or font at runtime', async () => {
    const index = await load('index.html');
    const css = await load('src/index.css');
    expect(index).toContain('<script src="/vendor/html2pdf.bundle.min.js"></script>');
    for (const host of ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com']) {
      expect(index).not.toContain(host);
    }
    expect(index).not.toMatch(/<link[^>]+https:\/\//);
    expect(css).toContain('font-family: system-ui,');
    expect(css).not.toContain("'Plus Jakarta Sans'");
  });

  test('preserves the existing offline-capable client-side PDF output path rather than substituting a fake report', async () => {
    const analytics = await load('src/components/AnalyticsView.tsx');
    expect(analytics).toContain("typeof html2pdf !== 'undefined'");
    expect(analytics).toContain('html2pdf()');
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
