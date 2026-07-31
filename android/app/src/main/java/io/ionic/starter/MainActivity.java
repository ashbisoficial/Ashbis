package io.ionic.starter;

import android.os.Bundle;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android puede matar el proceso del WebView (no el de la app) para
        // liberar memoria mientras la app está en segundo plano — pasa
        // seguido en celulares con poca RAM cuando hay varias apps abiertas
        // a la vez. Sin este override, la app vuelve a primer plano con el
        // header/nav nativos andando pero el contenido en blanco para
        // siempre, porque nadie le pide al WebView que recargue la página.
        WebView webView = getBridge().getWebView();
        webView.setWebViewClient(
            new BridgeWebViewClient(getBridge()) {
                @Override
                public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    super.onRenderProcessGone(view, detail);
                    if (view == webView) {
                        view.loadUrl(getBridge().getAppUrl());
                    }
                    return true;
                }
            }
        );
    }
}
