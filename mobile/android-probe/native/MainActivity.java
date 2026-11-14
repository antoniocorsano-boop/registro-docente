package it.trama.registrodocente.prova;

import android.annotation.TargetApi;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private Runnable unregisterPlatformBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RegistroBackupFilesPlugin.class);
        registerPlugin(RegistroPdfFilesPlugin.class);
        super.onCreate(savedInstanceState);

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
    protected void onResume() {
        super.onResume();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && unregisterPlatformBack == null) {
            unregisterPlatformBack = PlatformBack.register(this, this::navigateWebHistory);
        }
    }

    @Override
    protected void onPause() {
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
