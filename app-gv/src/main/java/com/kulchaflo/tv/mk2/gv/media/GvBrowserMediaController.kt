package com.kulchaflo.tv.mk2.gv.media

import android.view.KeyEvent
import com.kulchaflo.tv.mk2.gv.tabs.GvTabController
import com.kulchaflo.tv.mk2.gv.util.GvLogger
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.MediaSession

class GvBrowserMediaController(
    private val tabController: GvTabController,
) {
    private data class BrowserMediaState(
        val tabId: String,
        val mediaSession: MediaSession,
        var features: Long = MediaSession.Feature.NONE,
        var metadata: MediaSession.Metadata? = null,
        var positionState: MediaSession.PositionState? = null,
        var fullscreen: Boolean = false,
        var isPlaying: Boolean = false,
    )

    private var activeState: BrowserMediaState? = null

    val delegate = object : MediaSession.Delegate {
        override fun onActivated(session: GeckoSession, mediaSession: MediaSession) {
            val tabId = tabController.findTabBySession(session)?.id ?: "unknown"
            activeState = BrowserMediaState(tabId = tabId, mediaSession = mediaSession)
            GvLogger.i(TAG, "browser media session activated tabId=$tabId")
        }

        override fun onDeactivated(session: GeckoSession, mediaSession: MediaSession) {
            val tabId = tabController.findTabBySession(session)?.id ?: "unknown"
            if (activeState?.mediaSession == mediaSession) {
                activeState = null
            }
            GvLogger.i(TAG, "browser media session deactivated tabId=$tabId")
        }

        override fun onMetadata(
            session: GeckoSession,
            mediaSession: MediaSession,
            metadata: MediaSession.Metadata,
        ) {
            activeState = stateFor(session, mediaSession).apply { this.metadata = metadata }
            GvLogger.i(
                TAG,
                "browser media metadata tabId=${activeState?.tabId ?: "unknown"} title=${metadata.title ?: ""} artist=${metadata.artist ?: ""} album=${metadata.album ?: ""}"
            )
        }

        override fun onFeatures(
            session: GeckoSession,
            mediaSession: MediaSession,
            features: Long,
        ) {
            activeState = stateFor(session, mediaSession).apply { this.features = features }
            GvLogger.i(
                TAG,
                "browser media features tabId=${activeState?.tabId ?: "unknown"} play=${has(features, MediaSession.Feature.PLAY)} pause=${has(features, MediaSession.Feature.PAUSE)} seekForward=${has(features, MediaSession.Feature.SEEK_FORWARD)} seekBackward=${has(features, MediaSession.Feature.SEEK_BACKWARD)} skipAd=${has(features, MediaSession.Feature.SKIP_AD)} fullscreenFocus=${has(features, MediaSession.Feature.FOCUS)}"
            )
        }

        override fun onPlay(session: GeckoSession, mediaSession: MediaSession) {
            activeState = stateFor(session, mediaSession).apply { isPlaying = true }
            GvLogger.i(TAG, "browser media play tabId=${activeState?.tabId ?: "unknown"}")
        }

        override fun onPause(session: GeckoSession, mediaSession: MediaSession) {
            activeState = stateFor(session, mediaSession).apply { isPlaying = false }
            GvLogger.i(TAG, "browser media pause tabId=${activeState?.tabId ?: "unknown"}")
        }

        override fun onStop(session: GeckoSession, mediaSession: MediaSession) {
            activeState = stateFor(session, mediaSession).apply { isPlaying = false }
            GvLogger.i(TAG, "browser media stop tabId=${activeState?.tabId ?: "unknown"}")
        }

        override fun onPositionState(
            session: GeckoSession,
            mediaSession: MediaSession,
            positionState: MediaSession.PositionState,
        ) {
            activeState = stateFor(session, mediaSession).apply { this.positionState = positionState }
            GvLogger.d(
                TAG,
                "browser media position tabId=${activeState?.tabId ?: "unknown"} position=${positionState.position} duration=${positionState.duration} rate=${positionState.playbackRate}"
            )
        }

        override fun onFullscreen(
            session: GeckoSession,
            mediaSession: MediaSession,
            fullscreen: Boolean,
            elementMetadata: MediaSession.ElementMetadata?,
        ) {
            activeState = stateFor(session, mediaSession).apply { this.fullscreen = fullscreen }
            GvLogger.i(
                TAG,
                "browser media fullscreen tabId=${activeState?.tabId ?: "unknown"} enabled=$fullscreen source=${elementMetadata?.source ?: ""} duration=${elementMetadata?.duration ?: 0.0} width=${elementMetadata?.width ?: 0} height=${elementMetadata?.height ?: 0}"
            )
        }
    }

    fun handleMediaKey(event: KeyEvent): Boolean {
        if (event.action != KeyEvent.ACTION_DOWN) return false
        val state = activeState ?: return false
        return when (event.keyCode) {
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
                if (state.isPlaying && has(state.features, MediaSession.Feature.PAUSE)) {
                    state.mediaSession.pause()
                    GvLogger.i(TAG, "browser media key action=pause tabId=${state.tabId}")
                    true
                } else if (!state.isPlaying && has(state.features, MediaSession.Feature.PLAY)) {
                    state.mediaSession.play()
                    GvLogger.i(TAG, "browser media key action=play tabId=${state.tabId}")
                    true
                } else if (state.isPlaying) {
                    state.mediaSession.pause()
                    GvLogger.i(TAG, "browser media key action=pause tabId=${state.tabId} fallback=no-feature-flag")
                    true
                } else {
                    state.mediaSession.play()
                    GvLogger.i(TAG, "browser media key action=play tabId=${state.tabId} fallback=no-feature-flag")
                    true
                }
            }

            KeyEvent.KEYCODE_MEDIA_PLAY -> {
                if (has(state.features, MediaSession.Feature.PLAY)) {
                    state.mediaSession.play()
                    GvLogger.i(TAG, "browser media key action=play tabId=${state.tabId}")
                    true
                } else {
                    state.mediaSession.play()
                    GvLogger.i(TAG, "browser media key action=play tabId=${state.tabId} fallback=no-feature-flag")
                    true
                }
            }

            KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                if (has(state.features, MediaSession.Feature.PAUSE)) {
                    state.mediaSession.pause()
                    GvLogger.i(TAG, "browser media key action=pause tabId=${state.tabId}")
                    true
                } else {
                    state.mediaSession.pause()
                    GvLogger.i(TAG, "browser media key action=pause tabId=${state.tabId} fallback=no-feature-flag")
                    true
                }
            }

            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> {
                if (!has(state.features, MediaSession.Feature.SEEK_FORWARD)) return false
                state.mediaSession.seekForward()
                GvLogger.i(TAG, "browser media key action=seekForward tabId=${state.tabId}")
                true
            }

            KeyEvent.KEYCODE_MEDIA_REWIND -> {
                if (!has(state.features, MediaSession.Feature.SEEK_BACKWARD)) return false
                state.mediaSession.seekBackward()
                GvLogger.i(TAG, "browser media key action=seekBackward tabId=${state.tabId}")
                true
            }

            KeyEvent.KEYCODE_MEDIA_NEXT -> {
                if (!has(state.features, MediaSession.Feature.NEXT_TRACK)) return false
                state.mediaSession.nextTrack()
                GvLogger.i(TAG, "browser media key action=nextTrack tabId=${state.tabId}")
                true
            }

            KeyEvent.KEYCODE_MEDIA_PREVIOUS -> {
                if (!has(state.features, MediaSession.Feature.PREVIOUS_TRACK)) return false
                state.mediaSession.previousTrack()
                GvLogger.i(TAG, "browser media key action=previousTrack tabId=${state.tabId}")
                true
            }

            KeyEvent.KEYCODE_INFO -> {
                if (!has(state.features, MediaSession.Feature.SKIP_AD)) return false
                state.mediaSession.skipAd()
                GvLogger.i(TAG, "browser media key action=skipAd tabId=${state.tabId}")
                true
            }

            else -> false
        }
    }

    fun clear() {
        activeState = null
    }

    fun clearForTab(tabId: String) {
        if (activeState?.tabId == tabId) {
            activeState = null
            GvLogger.i(TAG, "browser media state cleared tabId=$tabId reason=tab-closed")
        }
    }

    fun describeSessionState(session: GeckoSession): String {
        val tabId = tabController.findTabBySession(session)?.id ?: "unknown"
        val state = activeState
        if (state == null) {
            return "tabId=$tabId active=false reason=no-active-media-session"
        }
        val sameSession = tabController.findTabBySession(session)?.id == state.tabId
        return buildString {
            append("tabId=$tabId")
            append(" active=true")
            append(" activeTabId=${state.tabId}")
            append(" sameSession=$sameSession")
            append(" playing=${state.isPlaying}")
            append(" play=${has(state.features, MediaSession.Feature.PLAY)}")
            append(" pause=${has(state.features, MediaSession.Feature.PAUSE)}")
            append(" seekForward=${has(state.features, MediaSession.Feature.SEEK_FORWARD)}")
            append(" seekBackward=${has(state.features, MediaSession.Feature.SEEK_BACKWARD)}")
            append(" fullscreen=${state.fullscreen}")
            append(" title=${state.metadata?.title ?: ""}")
        }
    }

    private fun stateFor(session: GeckoSession, mediaSession: MediaSession): BrowserMediaState {
        val tabId = tabController.findTabBySession(session)?.id ?: "unknown"
        val existing = activeState
        if (existing != null && existing.mediaSession == mediaSession) {
            return existing.apply { if (this.tabId != tabId) Unit }
        }
        return BrowserMediaState(tabId = tabId, mediaSession = mediaSession)
    }

    private fun has(features: Long, feature: Long): Boolean = features and feature == feature

    private companion object {
        private const val TAG = "GvBrowserMedia"
    }
}
