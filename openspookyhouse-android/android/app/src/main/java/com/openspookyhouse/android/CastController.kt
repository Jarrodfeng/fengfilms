package com.openspookyhouse.android

import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.mediarouter.app.MediaRouteButton
import com.google.android.gms.cast.framework.CastButtonFactory
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.CastState
import com.google.android.gms.cast.framework.CastStateListener
import com.google.android.gms.cast.framework.SessionManagerListener
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability

/**
 * Google Cast sender. The game keeps running on the phone; the Chromecast
 * runs the OpenSpookyHouse Web Receiver and draws the frames the game sends
 * over a custom message namespace.
 */
class CastController(
    private val activity: AppCompatActivity,
    private val button: MediaRouteButton,
    private val listener: Listener,
) {
    interface Listener {
        /** NO_DEVICES, NOT_CONNECTED, CONNECTING, CONNECTED or UNAVAILABLE */
        fun onCastState(state: String, device: String)
        fun onCastMessage(json: String)
    }

    @Volatile
    var state: String = "UNAVAILABLE"
        private set

    private var context: CastContext? = null
    private var session: CastSession? = null

    private val stateListener = CastStateListener { publish(stateName(it), deviceName()) }

    private val sessionListener = object : SessionManagerListener<CastSession> {
        override fun onSessionStarted(s: CastSession, sessionId: String) = attach(s)
        override fun onSessionResumed(s: CastSession, wasSuspended: Boolean) = attach(s)
        override fun onSessionEnded(s: CastSession, error: Int) = detach()
        override fun onSessionSuspended(s: CastSession, reason: Int) = detach()
        override fun onSessionStartFailed(s: CastSession, error: Int) = detach()
        override fun onSessionResumeFailed(s: CastSession, error: Int) = detach()
        override fun onSessionStarting(s: CastSession) = publish("CONNECTING", "")
        override fun onSessionResuming(s: CastSession, sessionId: String) = publish("CONNECTING", "")
        override fun onSessionEnding(s: CastSession) {}
    }

    init {
        val play = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(activity)
        if (play == ConnectionResult.SUCCESS) {
            CastContext.getSharedInstance(activity, ContextCompat.getMainExecutor(activity))
                .addOnSuccessListener { setUp(it) }
                .addOnFailureListener { Log.w(TAG, "Cast unavailable", it) }
        } else {
            Log.i(TAG, "Google Play services unavailable ($play); casting disabled")
        }
    }

    private fun setUp(ctx: CastContext) {
        context = ctx
        CastButtonFactory.setUpMediaRouteButton(activity, button)
        ctx.addCastStateListener(stateListener)
        ctx.sessionManager.addSessionManagerListener(sessionListener, CastSession::class.java)
        ctx.sessionManager.currentCastSession?.takeIf { it.isConnected }?.let { attach(it) }
            ?: publish(stateName(ctx.castState), "")
    }

    /** Messages only flow once the session's channel is registered. */
    private fun stateName(castState: Int): String = when (castState) {
        CastState.NO_DEVICES_AVAILABLE -> "NO_DEVICES"
        CastState.NOT_CONNECTED -> "NOT_CONNECTED"
        CastState.CONNECTING -> "CONNECTING"
        CastState.CONNECTED -> if (session != null) "CONNECTED" else "CONNECTING"
        else -> "UNAVAILABLE"
    }

    private fun deviceName(): String = session?.castDevice?.friendlyName ?: ""

    private fun attach(s: CastSession) {
        session = s
        try {
            s.setMessageReceivedCallbacks(NAMESPACE) { _, _, message -> listener.onCastMessage(message) }
        } catch (e: Exception) {
            Log.w(TAG, "Could not open the game channel", e)
        }
        publish("CONNECTED", deviceName())
    }

    private fun detach() {
        try {
            session?.removeMessageReceivedCallbacks(NAMESPACE)
        } catch (e: Exception) {
            Log.w(TAG, "Could not close the game channel", e)
        }
        session = null
        publish(context?.let { stateName(it.castState) } ?: "UNAVAILABLE", "")
    }

    private fun publish(newState: String, device: String) {
        state = newState
        listener.onCastState(newState, device)
    }

    val isConnected: Boolean get() = session != null

    /** Main thread only. */
    fun send(json: String) {
        val s = session ?: return
        try {
            s.sendMessage(NAMESPACE, json)
        } catch (e: Exception) {
            Log.w(TAG, "Send failed", e)
        }
    }

    /** Opens the device chooser (or the "stop casting" dialog when connected). */
    fun showDialog() {
        if (context != null) button.performClick()
    }

    fun setAppId(id: String) {
        CastOptionsProvider.saveAppId(activity, id)
        try {
            context?.setReceiverApplicationId(CastOptionsProvider.receiverId(activity))
        } catch (e: Exception) {
            Log.w(TAG, "Could not change the receiver app ID", e)
        }
    }

    fun release() {
        context?.removeCastStateListener(stateListener)
        context?.sessionManager?.removeSessionManagerListener(sessionListener, CastSession::class.java)
    }

    companion object {
        const val NAMESPACE = "urn:x-cast:com.openspookyhouse.game"
        private const val TAG = "OSHCast"
    }
}
