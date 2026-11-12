import { describe, expect, test } from 'bun:test';
const root = new URL('../../', import.meta.url);
const load = (path: string) => Bun.file(new URL(path, root)).text();

describe('MOBILE-01/M2c native PDF contract', () => {
  test('separate PDF writer uses local SAF and verifies file before receipt', async () => {
    const java = await load('mobile/android-probe/native/RegistroPdfFilesPlugin.java');
    for (const token of ['Intent.ACTION_CREATE_DOCUMENT', 'application/pdf', 'Intent.EXTRA_LOCAL_ONLY',
      'LOCAL_PROVIDERS.contains(uri.getAuthority())', 'destinationToken = null',
      'resolver.openOutputStream(uri, "wt")', 'resolver.openInputStream(uri)',
      'MessageDigest.isEqual(expected, hash)', 'receipt.put("status", "verified")']) expect(java).toContain(token);
    expect(java.indexOf('resolver.openInputStream')).toBeLessThan(java.indexOf('receipt.put("status", "verified")'));
    expect(java).not.toMatch(/MANAGE_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|takePersistableUriPermission|https?:\/\/|Log\.[a-z]/);
    const main = await load('mobile/android-probe/native/MainActivity.java');
    expect(main.indexOf('registerPlugin(RegistroPdfFilesPlugin.class)')).toBeLessThan(main.indexOf('super.onCreate(savedInstanceState)'));
    expect(main).toContain('registerPlugin(RegistroBackupFilesPlugin.class)');
  });
  test('native export requires explicit non-encrypted-document confirmation and current privacy context', async () => {
    const view = await load('src/components/AnalyticsView.tsx');
    const flow = view.slice(view.indexOf('const handleExportPDF'), view.indexOf('\n  return (', view.indexOf('const handleExportPDF')));
    expect(flow).toContain('document.getElementById(\'official-pdf-report\')');
    expect(flow).toContain('Il PDF è un documento di lavoro non cifrato');
    expect(flow.indexOf('window.confirm')).toBeLessThan(flow.indexOf('await renderWorkPdf'));
    expect(flow).toContain('exportContext.current.privacy === isPrivacyShieldActive');
    expect(flow).toContain("result === 'verified' && isActive()");
    expect(view).toContain('formatStudentNameWithPrivacy(m.student.name, isPrivacyShieldActive)');
    const render = await load('src/security/workPdfRendering.ts');
    expect(render).toContain("table?.querySelectorAll('thead th')");
    expect(render).toContain("table?.querySelectorAll('tbody tr')");
    expect(render).toContain("pdf.deletePage(1)");
    expect(render).toContain("drawRow(columns, true)");
    expect(render).toContain("emittedRows !== rows.length");
    expect(render).toContain("pdf.output('arraybuffer')");
    expect(render).not.toContain(".toCanvas()");
    expect(render).toContain("dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url");
    expect(render).toContain("pdf.addFileToVFS");
    expect(render).toContain("pdf.addFont");
    expect(render).toContain("font.characterToGlyph(code)");
    expect(render).toContain("local.origin !== window.location.origin");
    const testSource = await load('tests/browser/mobile01-m2c-native-pdf.spec.cjs');
    expect(testSource).toContain("execFileSync('pdftotext'");
    expect(testSource).toContain("Łukasz Nowak");
    expect(testSource).toContain("Иван Петров");
    const pkg = JSON.parse(await load('package.json'));
    expect(pkg.dependencies['dejavu-fonts-ttf']).toBe('2.37.3');
    const config = await load('vite.config.ts');
    expect(config).toContain("node_modules/dejavu-fonts-ttf/LICENSE");
    expect(config).toContain("fileName: 'assets/DejaVu-LICENSE.txt'");
    const lock = await load('bun.lock');
    expect(lock).toContain('"dejavu-fonts-ttf": ["dejavu-fonts-ttf@2.37.3"');
    const workflow = await load('.github/workflows/mobile-01-android-probe.yml');
    expect(workflow).toContain('android_pdf_native_implemented=true');
    expect(workflow).toContain('android_pdf_file_save_qualified=false');
  });
});
