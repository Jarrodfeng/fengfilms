package com.openspookyhouse.android

import android.content.Context
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.framework.CastOptions
import com.google.android.gms.cast.framework.OptionsProvider
import com.google.android.gms.cast.framework.SessionProvider
import com.google.android.gms.cast.framework.media.CastMediaOptions

/**
 * Tells the Cast SDK which receiver to launch: the OpenSpookyHouse Web
 * Receiver registered by the player in the Cast SDK Developer Console.
 * Until an App ID is configured, the default receiver ID is used so that
 * device discovery (and the cast button) still works.
 */
class CastOptionsProvider : OptionsProvider {
    override fun getCastOptions(context: Context): CastOptions =
        CastOptions.Builder()
            .setReceiverApplicationId(receiverId(context))
            // The game is not media: no media notification or lock screen controls
            .setCastMediaOptions(
                CastMediaOptions.Builder()
                    .setNotificationOptions(null)
                    .setMediaSessionEnabled(false)
                    .build()
            )
            .setStopReceiverApplicationWhenEndingSession(true)
            .build()

    override fun getAdditionalSessionProviders(context: Context): List<SessionProvider>? = null

    companion object {
        private const val PREFS = "osh"
        private const val KEY_APP_ID = "cast_app_id"

        fun configuredAppId(context: Context): String =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_APP_ID, null)
                ?: BuildConfig.CAST_APP_ID

        fun saveAppId(context: Context, id: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_APP_ID, id).apply()
        }

        fun receiverId(context: Context): String =
            configuredAppId(context).ifBlank { CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID }
    }
}
