package it.trama.registrodocente.prova;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RegistroBackupFilesPlugin.class);
        registerPlugin(RegistroPdfFilesPlugin.class);
        super.onCreate(savedInstanceState);

        // Android system Back (edge gesture or navigation button). The WebView
        // owns the history; App.tsx popstate owns all route/draft decisions.
        // Never finish the activity or synthesize a new history entry here.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null) return;
                WebView webView = getBridge().getWebView();
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                }
                // At the history root, remain in the app. No destructive fallback.
            }
        });
    }
}
