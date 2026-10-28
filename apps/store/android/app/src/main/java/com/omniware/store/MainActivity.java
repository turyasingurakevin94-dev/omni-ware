package com.omniware.store;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // The page is drawn at the sizes its design sets. Android's web view would otherwise
    // stretch every letter by the phone's font size, and rows wrap and clip. Bigger
    // letters are the app's own Big text (You), which keeps the layout (round 8).
    private void keepTextSize() {
        WebView web = bridge != null ? bridge.getWebView() : null;
        if (web != null) web.getSettings().setTextZoom(100);
    }

    @Override
    public void onStart() {
        super.onStart();
        keepTextSize();
    }

    @Override
    public void onResume() {
        super.onResume();
        keepTextSize();
    }
}
