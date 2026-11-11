import { describe, expect, test } from 'bun:test';

const PATH = new URL('../../mobile/android-probe/', import.meta.url);
const CONFIG = new URL('capacitor.config.json', PATH);
const PACKAGE = new URL('package.json', PATH);
const WORKFLOW = new URL('../../.github/workflows/mobile-01-android-probe.yml', import.meta.url);

describe('MOBILE-01/S0 isolated Android probe governance', () => {
  test('bundles the existing web build under a distinct experimental identity without a remote server', async () => {
    const config = JSON.parse(await Bun.file(CONFIG).text());
    expect(config.appId).toBe('it.trama.registrodocente.prova');
    expect(config.appName).toBe('Registro Docente - Prova');
    expect(config.webDir).toBe('../../dist');
    expect(config).not.toHaveProperty('server');
    expect(config).not.toHaveProperty('plugins');
  });

  test('keeps all Capacitor packages pinned in an isolated workspace', async () => {
    const pkg = JSON.parse(await Bun.file(PACKAGE).text());
    expect(pkg.private).toBe(true);
    expect(pkg.dependencies['@capacitor/core']).toBe('8.6.0');
    expect(pkg.dependencies['@capacitor/android']).toBe('8.6.0');
    expect(pkg.devDependencies['@capacitor/cli']).toBe('8.6.0');
    const canonical = JSON.parse(await Bun.file(new URL('../../package.json', import.meta.url)).text());
    expect(canonical.dependencies?.['@capacitor/android']).toBeUndefined();
  });

  test('runs only an exact-SHA private debug build without upload release, secrets or deployment', async () => {
    const yml = await Bun.file(WORKFLOW).text();
    expect(yml).toContain('pull_request:');
    expect(yml).toContain('workflow_dispatch:');
    expect(yml).toContain('contents: read');
    expect(yml).toContain('github.event.pull_request.head.sha || github.sha');
    expect(yml).toContain('bun install --frozen-lockfile');
    expect(yml).toContain('npx --no-install cap add android');
    expect(yml).toContain('npx --no-install cap sync android');
    expect(yml).toContain('assembleDebug');
    expect(yml).toContain('apksigner');
    expect(yml).toContain('sha256sum');
    // The APK must actually contain the offline PDF resources: a Vite build
    // without these assets is not sufficient evidence for Android M1.
    expect(yml).toContain('test -s dist/vendor/html2pdf.bundle.min.js');
    expect(yml).toContain('test -s dist/vendor/html2pdf.bundle.min.js.LICENSE.txt');
    expect(yml).toContain("assets/public/vendor/html2pdf.bundle.min.js'");
    expect(yml).toContain('cmp - dist/vendor/html2pdf.bundle.min.js');
    expect(yml).toContain('cmp - dist/vendor/html2pdf.bundle.min.js.LICENSE.txt');
    expect(yml).toContain('pdf_offline_bundle_present=true');
    expect(yml).toContain('android_pdf_file_save_qualified=false');
    expect(yml).toContain('remote_fonts_required=false');
    expect(yml).toContain('retention-days: 7');
    expect(yml).not.toMatch(/\n\s*push:\s*/);
    expect(yml).not.toMatch(/\n\s*release:\s*/);
    expect(yml).not.toContain('secrets.');
    expect(yml).not.toMatch(/gh release create|npx vercel|firebase deploy/i);
    expect(yml).not.toMatch(/GEMINI_API_KEY/);
  });
});
