import { describe, expect, test } from 'bun:test';

const read = (path: string) => Bun.file(path).text();

describe('NAV-ANDROID-01 — Android system Back delegates to the existing history', () => {
  test('one native owner per API level, lifecycle-bound and committed Back only', async () => {
    const java = await read('mobile/android-probe/native/MainActivity.java');
    expect(java.indexOf('super.onCreate(savedInstanceState)')).toBeLessThan(java.indexOf('if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU)'));
    expect(java).toContain('if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU)');
    expect(java.split('getOnBackPressedDispatcher().addCallback(')).toHaveLength(2);
    expect(java).toContain('if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && unregisterPlatformBack == null)');
    expect(java.indexOf('super.onResume()')).toBeLessThan(java.indexOf('PlatformBack.register(this, this::navigateWebHistory)'));
    // Capacitor 8.6 BridgeActivity declares these lifecycle overrides public.
    expect(java).toContain('public void onResume()');
    expect(java).toContain('public void onPause()');
    expect(java).toContain('unregisterPlatformBack.run();');
    expect(java).toContain('unregisterPlatformBack = null;');
    expect(java.indexOf('unregisterPlatformBack.run();')).toBeLessThan(java.indexOf('super.onPause()'));
    expect(java).toContain('@TargetApi(33)');
    expect(java).toContain('OnBackInvokedCallback callback = navigate::run;');
    expect(java).toContain('dispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback)');
    expect(java).toContain('return () -> dispatcher.unregisterOnBackInvokedCallback(callback);');
    expect(java.split('dispatcher.registerOnBackInvokedCallback(')).toHaveLength(2);
    expect(java).not.toMatch(/PRIORITY_OVERLAY,|Build\.MANUFACTURER|Build\.MODEL|onBackStarted\(|onBackProgressed\(/);
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
    const manifest = await read('mobile/android-probe/prepare-native-back.mjs');
    expect(manifest).toContain('android:enableOnBackInvokedCallback="true"');
    expect(yml).toContain('node prepare-native-back.mjs');
    expect(yml).toContain('probe-manifest-tree.txt');
    expect(yml).toContain('beta-manifest-tree.txt');
    expect(yml.match(/android:enableOnBackInvokedCallback/g)).toHaveLength(2);
    expect(yml).toContain('android_system_back_device_qualified=false');
    expect(yml).not.toContain('android_system_back_device_qualified=true');
  });
});

describe('SEC-SESSION-01 — native task preview privacy', () => {
  test('recents protection is installed at creation, not only after a pause', async () => {
    const java = await read('mobile/android-probe/native/MainActivity.java');
    const create = java.slice(java.indexOf('protected void onCreate'), java.indexOf('public void onResume'));
    expect(create).toContain('if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)');
    expect(create).toContain('PlatformBack.disableRecentsScreenshot(this)');
    expect(create).toContain('getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE)');
    expect(java).toContain('activity.setRecentsScreenshotEnabled(false)');
    expect(java).not.toContain('clearFlags(WindowManager.LayoutParams.FLAG_SECURE)');
  });
});

describe('SEC-SESSION-01 — protected visual state', () => {
  test('native cover survives until a current WebView visual-state callback', async () => {
    const java = await read('mobile/android-probe/native/MainActivity.java');
    const ack = java.slice(java.indexOf('void acknowledgeProtectedSurface'), java.indexOf('private void coverSessionSurface'));
    const cover = java.slice(java.indexOf('private void coverSessionSurface'), java.indexOf('private void signalSessionChange'));
    expect(cover).toContain('setVisibility(View.INVISIBLE)');
    expect(ack).toContain('postVisualStateCallback');
    const callback = ack.slice(ack.indexOf('public void onComplete(long requestId)'));
    expect(callback).toContain('sessionEpoch != epoch || sessionShield != expectedShield');
    expect(callback.indexOf('sessionEpoch != epoch')).toBeLessThan(callback.indexOf('web.setVisibility(View.VISIBLE)'));
    expect(callback.indexOf('web.setVisibility(View.VISIBLE)')).toBeLessThan(callback.indexOf('parent.removeView(expectedShield)'));
    expect(ack.slice(0, ack.indexOf('postVisualStateCallback'))).not.toContain('removeView');
    const plugin = await read('mobile/android-probe/native/RegistroSessionPlugin.java');
    expect(plugin).toContain('acknowledgeProtectedSurface(epoch,');
    expect(plugin).toContain('() -> call.resolve(new JSObject())');
  });
});
