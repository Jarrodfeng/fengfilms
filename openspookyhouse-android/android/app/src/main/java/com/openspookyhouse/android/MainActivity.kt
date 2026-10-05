package com.openspookyhouse.android

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.addCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.mediarouter.app.MediaRouteButton
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject
import kotlin.math.max

/**
 * Hosts the game (HTML5 canvas, bundled in assets/www) in a WebView and
 * connects it to Android: file picking, immersive full-screen, haptics, the
 * back button, Google Cast and secondary displays.
 */
class MainActivity : AppCompatActivity(), CastController.Listener, DisplayController.Listener {
    private lateinit var root: FrameLayout
    private lateinit var web: WebView
    private lateinit var castButton: MediaRouteButton
    private lateinit var cast: CastController
    private lateinit var display: DisplayController
    private lateinit var assets: WebViewAssetLoader

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var immersive = true
    private var castState = "UNAVAILABLE"
    private var castDevice = ""

    private val pickFiles = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        fileCallback?.onReceiveValue(uris.toTypedArray())
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        root = FrameLayout(this).apply { setBackgroundColor(BACKGROUND) }
        setContentView(root)

        assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this).apply {
            setBackgroundColor(BACKGROUND)
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            isHapticFeedbackEnabled = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Keep the game's renderer at foreground priority
                setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true)
            }
        }
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            textZoom = 100 // the layout handles its own sizing
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            mediaPlaybackRequiresUserGesture = true
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assets.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == WebViewAssetLoader.DEFAULT_DOMAIN) return false
                // Anything else (e.g. links in the help text) opens in the browser
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                return true
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // The game autosaves when backgrounded; start over cleanly
                recreate()
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    // The game files (.DAT/.PIX/.ART/.zip) have no reliable MIME type
                    pickFiles.launch(arrayOf("*/*"))
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    false
                }
            }
        }
        web.addJavascriptInterface(Bridge(), "OSHNative")
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        // The cast dialog is opened from the game's own cast button
        castButton = MediaRouteButton(this).apply { alpha = 0f }
        root.addView(castButton, FrameLayout.LayoutParams(1, 1))

        // Keep content clear of the camera cut-out, system bars and keyboard
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(safe.left, safe.top, safe.right, max(safe.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }

        onBackPressedDispatcher.addCallback(this) {
            js("window.__osh&&window.__osh.onBack()")
        }

        applyImmersive()
        cast = CastController(this, castButton, this)
        display = DisplayController(this, assets, this)
        web.loadUrl(APP_URL)
    }

    override fun onStart() {
        super.onStart()
        display.start()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        applyImmersive()
    }

    override fun onPause() {
        // The page sees `visibilitychange` first and autosaves
        web.onPause()
        super.onPause()
    }

    override fun onStop() {
        display.stop()
        super.onStop()
    }

    override fun onDestroy() {
        cast.release()
        web.destroy()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersive()
    }

    private fun applyImmersive() {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        if (immersive) {
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller.hide(WindowInsetsCompat.Type.systemBars())
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars())
        }
        controller.isAppearanceLightStatusBars = false
        controller.isAppearanceLightNavigationBars = false
    }

    private fun js(script: String) {
        runOnUiThread { if (!isDestroyed) web.evaluateJavascript(script, null) }
    }

    // ---- Second screens ----

    /** The game sees one "TV": a Chromecast session wins over a local display. */
    private fun publishScreenState() {
        val (state, device) = when {
            castState == "CONNECTED" -> castState to castDevice
            display.active -> "DISPLAY" to (display.name ?: "Display")
            else -> castState to castDevice
        }
        js("window.__osh&&window.__osh.onCastState(${JSONObject.quote(state)},${JSONObject.quote(device)})")
    }

    override fun onCastState(state: String, device: String) {
        castState = state
        castDevice = device
        publishScreenState()
    }

    override fun onCastMessage(json: String) {
        js("window.__osh&&window.__osh.onCastMessage(${JSONObject.quote(json)})")
    }

    override fun onDisplayChanged(name: String?) = publishScreenState()

    override fun onDisplayMessage(json: String) = onCastMessage(json)

    // ---- JavaScript bridge (called on a WebView binder thread) ----

    private inner class Bridge {
        @JavascriptInterface
        fun haptic() = runOnUiThread { web.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY) }

        @JavascriptInterface
        fun quit() = runOnUiThread { finishAndRemoveTask() }

        @JavascriptInterface
        fun setFullscreen(on: Boolean) = runOnUiThread {
            immersive = on
            applyImmersive()
        }

        @JavascriptInterface
        fun setKeepScreenOn(on: Boolean) = runOnUiThread {
            if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }

        @JavascriptInterface
        fun castState(): String = when {
            cast.state == "CONNECTED" -> "CONNECTED"
            display.active -> "DISPLAY"
            else -> cast.state
        }

        @JavascriptInterface
        fun openCastDialog() = runOnUiThread { cast.showDialog() }

        @JavascriptInterface
        fun castSend(json: String) = runOnUiThread {
            if (cast.isConnected) cast.send(json) else display.send(json)
        }

        @JavascriptInterface
        fun getCastAppId(): String = CastOptionsProvider.configuredAppId(this@MainActivity)

        @JavascriptInterface
        fun setCastAppId(id: String) = runOnUiThread {
            cast.setAppId(id.trim().uppercase().filter { it.isLetterOrDigit() })
        }

        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME
    }

    companion object {
        private const val BACKGROUND = 0xFF0B0612.toInt()
        const val APP_URL = "https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/www/index.html"
        const val RECEIVER_URL = "https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/www/receiver/index.html?local=1"
    }
}
