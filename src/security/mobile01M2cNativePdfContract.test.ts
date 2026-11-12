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
    expect(render).toContain("clone.classList.remove('hidden', 'print:block')");
    expect(render).toContain("outputPdf('arraybuffer')");
    expect(render).toContain('ink < 10');
    const workflow = await load('.github/workflows/mobile-01-android-probe.yml');
    expect(workflow).toContain('android_pdf_native_implemented=true');
    expect(workflow).toContain('android_pdf_file_save_qualified=false');
  });
});
