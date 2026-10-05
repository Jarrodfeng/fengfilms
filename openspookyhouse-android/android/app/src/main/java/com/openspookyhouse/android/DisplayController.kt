package com.openspookyhouse.android

import android.annotation.SuppressLint
import android.app.Presentation
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Display
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/**
 * Wired (USB-C to HDMI/DisplayPort) and Miracast displays show up to Android
 * as "presentation" displays. When one is attached, the TV picture is shown
 * there using the same receiver page as the Chromecast, fed over a local
 * bridge instead of the Cast channel.
 */
class DisplayController(
    private val context: Context,
    private val assets: WebViewAssetLoader,
    private val listener: Listener,
) : DisplayManager.DisplayListener {
    interface Listener {
        fun onDisplayChanged(name: String?)
        fun onDisplayMessage(json: String)
    }

    private val displays = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    private val main = Handler(Looper.getMainLooper())
    private var presentation: GamePresentation? = null

    val active: Boolean get() = presentation != null
    val name: String? get() = presentation?.display?.name

    fun start() {
        displays.registerDisplayListener(this, main)
        update()
    }

    fun stop() {
        displays.unregisterDisplayListener(this)
        dismiss()
    }

    override fun onDisplayAdded(displayId: Int) = update()
    override fun onDisplayRemoved(displayId: Int) = update()
    override fun onDisplayChanged(displayId: Int) {}

    private fun update() {
        val target = displays.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION).firstOrNull()
        if (target?.displayId == presentation?.display?.displayId) return
        dismiss()
        if (target != null) {
            try {
                presentation = GamePresentation(context, target).also { it.show() }
            } catch (e: WindowManager.InvalidDisplayException) {
                presentation = null
            }
        }
        listener.onDisplayChanged(presentation?.display?.name)
    }

    private fun dismiss() {
        presentation?.dismiss()
        presentation = null
    }

    /** Main thread only. */
    fun send(json: String) {
        presentation?.web?.evaluateJavascript("window.__oshReceive&&window.__oshReceive(${JSONObject.quote(json)})", null)
    }

    private inner class GamePresentation(outer: Context, display: Display) : Presentation(outer, display) {
        var web: WebView? = null

        @SuppressLint("SetJavaScriptEnabled")
        override fun onCreate(savedInstanceState: Bundle?) {
            super.onCreate(savedInstanceState)
            window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            val view = WebView(context)
            view.setBackgroundColor(0xFF000000.toInt())
            view.settings.javaScriptEnabled = true
            view.settings.domStorageEnabled = true
            view.settings.textZoom = 100
            view.webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assets.shouldInterceptRequest(request.url)
            }
            view.addJavascriptInterface(object {
                @JavascriptInterface
                fun reply(json: String) {
                    main.post { listener.onDisplayMessage(json) }
                }
            }, "OSHDisplay")
            view.loadUrl(MainActivity.RECEIVER_URL)
            setContentView(view)
            web = view
        }

        override fun onStop() {
            web?.destroy()
            web = null
            super.onStop()
        }
    }
}
