import { describe, expect, test } from 'bun:test';

const read = (path: string) => Bun.file(path).text();

describe('NAV-ANDROID-01 — Android system Back delegates to the existing history', () => {
  test('native callback attaches once after BridgeActivity initialization, not a web swipe recognizer', async () => {
    const java = await read('mobile/android-probe/native/MainActivity.java');
    expect(java.indexOf('super.onCreate(savedInstanceState)')).toBeLessThan(java.indexOf('getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true)'));
    expect(java.split('getOnBackPressedDispatcher().addCallback(')).toHaveLength(2);
    expect(java).toContain('if (getBridge() == null) return;');
    expect(java).toContain('WebView webView = getBridge().getWebView();');
    expect(java).toContain('if (webView != null && webView.canGoBack())');
    expect(java.split('webView.goBack();')).toHaveLength(2);
    expect(java.indexOf('webView.canGoBack()')).toBeLessThan(java.indexOf('webView.goBack();'));
    expect(java).not.toMatch(/\.finish\(|\.exitApp\(|\.loadUrl\(|evaluateJavascript\(|onTouchEvent\(|clearHistory\(|moveTaskToBack\(/);
    expect(java).toContain('registerPlugin(RegistroBackupFilesPlugin.class)');
    expect(java).toContain('registerPlugin(RegistroPdfFilesPlugin.class)');
  });

  test('existing browser popstate retains route and draft authority', async () => {
    const app = await read('src/App.tsx');
    const popstate = app.slice(app.indexOf('const handlePopState'), app.indexOf('const handleOpenPreparationCopilot'));
    expect(popstate).toContain("window.addEventListener('popstate', handlePopState)");
    expect(popstate).toContain('if (hasUnsavedActiveDraft())');
    expect(popstate).toContain('history.go(-delta)');
    expect(popstate).toContain('requestPlanningDeparture(replayVerifiedTraversal, restoring.destinationTab)');
    expect(popstate).toContain('restoreStudentReportFromHistory(');
    expect(popstate).toContain('resolveStudentReportReturnContext(');
    expect(app).not.toContain("addEventListener('touchstart'");
  });

  test('packaging exercises the native contract and never claims device qualification', async () => {
    const yml = await read('.github/workflows/mobile-01-android-probe.yml');
    expect(yml).toContain('bun test src/security/navAndroid01NativeBackContract.test.ts');
    expect(yml).toContain('cp native/MainActivity.java native/RegistroBackupFilesPlugin.java');
    expect(yml).toContain('android_system_back_device_qualified=false');
    expect(yml).not.toContain('android_system_back_device_qualified=true');
  });
});
