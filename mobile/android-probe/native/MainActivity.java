package it.trama.registrodocente.prova;

import android.annotation.TargetApi;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.view.WindowManager;
import android.view.View;
import android.view.ViewGroup;
import android.graphics.Color;
import android.widget.FrameLayout;
import com.getcapacitor.JSObject;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private Runnable unregisterPlatformBack;
    // Activity-local epoch. A process restart always requires the ordinary vault unlock.
    private volatile int sessionEpoch = 0;
    private volatile boolean sessionForeground = false;
    private volatile int authorizedEpoch = -1;
    private View sessionShield;
    private long visualRequestId;
    private int priorWebAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO;

    JSObject readSessionState() {
        JSObject state = new JSObject();
        state.put("epoch", sessionEpoch);
        state.put("foreground", sessionForeground);
        return state;
    }

    boolean authorizeSessionEpoch(int epoch) {
        if (!sessionForeground || sessionEpoch != epoch) return false;
        authorizedEpoch = epoch;
        return true;
    }

    boolean isDocumentSessionAuthorized() {
        return sessionForeground && authorizedEpoch == sessionEpoch;
    }

    void acknowledgeProtectedSurface(int epoch, Runnable onComplete, Runnable onStale) {
        if (!sessionForeground || sessionEpoch != epoch) {
            onStale.run();
            return;
        }
        if (sessionShield == null) {
            onComplete.run();
            return;
        }
        if (getBridge() == null || getBridge().getWebView() == null) {
            onStale.run();
            return;
        }
        final WebView web = getBridge().getWebView();
        final View expectedShield = sessionShield;
        // A DOM commit alone is insufficient. Keep the WebView invisible and
        // the native shield attached until its protected visual state is ready.
        web.postVisualStateCallback(++visualRequestId, new WebView.VisualStateCallback() {
            @Override
            public void onComplete(long requestId) {
                if (!sessionForeground || sessionEpoch != epoch || sessionShield != expectedShield) {
                    onStale.run();
                    return;
                }
                web.setVisibility(View.VISIBLE);
                web.setImportantForAccessibility(priorWebAccessibility);
                ViewGroup parent = (ViewGroup) expectedShield.getParent();
                if (parent != null) parent.removeView(expectedShield);
                sessionShield = null;
                onComplete.run();
            }
        });
    }

    private void coverSessionSurface() {
        if (sessionShield != null) return;
        ViewGroup decor = (ViewGroup) getWindow().getDecorView();
        View shield = new View(this);
        shield.setBackgroundColor(Color.rgb(3, 7, 18));
        shield.setClickable(true);
        shield.setFocusable(true);
        shield.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
        shield.setContentDescription("Registro protetto");
        if (getBridge() != null) {
            WebView web = getBridge().getWebView();
            priorWebAccessibility = web.getImportantForAccessibility();
            web.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        }
        decor.addView(shield, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        sessionShield = shield;
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setVisibility(View.INVISIBLE);
        }
    }

    private void signalSessionChange() {
        if (getBridge() != null) getBridge().triggerDocumentJSEvent("registro-session-change");
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RegistroBackupFilesPlugin.class);
        registerPlugin(RegistroPdfFilesPlugin.class);
        registerPlugin(RegistroSessionPlugin.class);
        super.onCreate(savedInstanceState);
        // Never expose the professional archive in Android's task overview.
        // API 33+ protects the task preview without disabling ordinary screenshots.
        // Older Android has no public recents-only API: prefer FLAG_SECURE.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PlatformBack.disableRecentsScreenshot(this);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }

        // One owner per OS API level. Modern Android receives committed system
        // Back directly at the window; earlier versions use AndroidX.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    navigateWebHistory();
                }
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        sessionForeground = true;
        signalSessionChange();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && unregisterPlatformBack == null) {
            unregisterPlatformBack = PlatformBack.register(this, this::navigateWebHistory);
        }
    }

    @Override
    public void onPause() {
        sessionForeground = false;
        authorizedEpoch = -1;
        sessionEpoch += 1;
        coverSessionSurface();
        signalSessionChange();
        if (unregisterPlatformBack != null) {
            unregisterPlatformBack.run();
            unregisterPlatformBack = null;
        }
        super.onPause();
    }

    private void navigateWebHistory() {
        // Preserve the web app's existing route and draft authority.
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        }
        // At root, remain in the app; no synthetic route or destructive fallback.
    }

    // Isolate API 33 classes from the pre-33 execution path.
    @TargetApi(33)
    private static final class PlatformBack {
        static void disableRecentsScreenshot(MainActivity activity) {
            activity.setRecentsScreenshotEnabled(false);
        }

        static Runnable register(MainActivity activity, Runnable navigate) {
            OnBackInvokedDispatcher dispatcher = activity.getOnBackInvokedDispatcher();
            OnBackInvokedCallback callback = navigate::run;
            // DEFAULT, not OVERLAY: do not preempt the system keyboard or
            // a focused dialog window. Consume only a committed Back.
            dispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback);
            return () -> dispatcher.unregisterOnBackInvokedCallback(callback);
        }
    }
}
