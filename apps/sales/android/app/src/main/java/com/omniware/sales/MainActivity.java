package com.omniware.sales;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

/**
 * The phone's text size reaches the page as the WebView's textZoom (Android's font size, in percent).
 * The page makes room for large text, and every screen is checked at 130% (test/e2e/flows-fit.cjs),
 * so a larger setting is held at 130%: big text for those who need it, never past what was checked.
 * Changing the font size recreates this activity (fontScale is not in configChanges), so it holds then too.
 */
public class MainActivity extends BridgeActivity {
    static final int MAX_TEXT_ZOOM = 130;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebSettings settings = getBridge().getWebView().getSettings();
        if (settings.getTextZoom() > MAX_TEXT_ZOOM) settings.setTextZoom(MAX_TEXT_ZOOM);
    }
}
