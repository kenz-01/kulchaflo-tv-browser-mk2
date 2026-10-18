package com.kulchaflo.tv.mk2.gv.media

import android.content.Context
import android.net.Uri
import android.view.InputDevice
import android.view.MotionEvent
import android.view.ViewGroup
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.PlayerView
import com.kulchaflo.tv.mk2.gv.util.GvLogger

class GvPromotedMediaPlayer(
    private val context: Context,
    private val host: ViewGroup,
) {
    interface Listener {
        fun onPromotedPlayerError(source: GvMediaPathController.Observation, error: androidx.media3.common.PlaybackException)
    }

    var listener: Listener? = null

    private var playerView: PlayerView? = null
    private var player: ExoPlayer? = null
    private var activeSource: GvMediaPathController.Observation? = null

    fun isPromoted(): Boolean = activeSource != null

    fun currentSourceUrl(): String? = activeSource?.url

    fun dispatchPointerTap(x: Float, y: Float): Boolean {
        val target = playerView ?: return false
        target.showController()
        val downTime = android.os.SystemClock.uptimeMillis()
        val down = pointerEvent(MotionEvent.ACTION_DOWN, downTime, x, y)
        val handledDown = target.dispatchTouchEvent(down)
        down.recycle()
        val up = pointerEvent(MotionEvent.ACTION_UP, downTime, x, y)
        val handledUp = target.dispatchTouchEvent(up)
        up.recycle()
        return handledDown || handledUp
    }

    fun dispatchPointerHover(x: Float, y: Float): Boolean {
        val target = playerView ?: return false
        target.showController()
        val eventTime = android.os.SystemClock.uptimeMillis()
        val event = MotionEvent.obtain(
            eventTime,
            eventTime,
            MotionEvent.ACTION_HOVER_MOVE,
            x,
            y,
            0,
        ).apply {
            source = InputDevice.SOURCE_MOUSE
        }
        val handled = target.dispatchGenericMotionEvent(event)
        event.recycle()
        return handled
    }

    fun play(source: GvMediaPathController.Observation) {
        if (activeSource?.url == source.url) {
            GvLogger.i(TAG, "promoted media unchanged pageKind=${source.pageKind}")
            return
        }
        releaseInternal(reason = "replace-source")

        val renderView = PlayerView(context).apply {
            useController = true
            controllerAutoShow = true
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
            keepScreenOn = true
        }

        val dataSourceFactory = DefaultHttpDataSource.Factory()
            .setUserAgent("KulchaFlo-MkII-GV")
            .setAllowCrossProtocolRedirects(true)
        val trackSelector = DefaultTrackSelector(context).apply {
            setParameters(
                buildUponParameters()
                    .setForceHighestSupportedBitrate(true)
            )
        }

        val exoPlayer = ExoPlayer.Builder(context)
            .setTrackSelector(trackSelector)
            .setMediaSourceFactory(
                androidx.media3.exoplayer.source.DefaultMediaSourceFactory(context)
                    .setDataSourceFactory(dataSourceFactory)
            )
            .build()
            .apply {
            setMediaItem(
                MediaItem.Builder()
                    .setUri(Uri.parse(source.url))
                    .setMimeType(normalizeMimeType(source.mimeHint))
                    .build()
            )
            playWhenReady = true
            repeatMode = Player.REPEAT_MODE_OFF
            addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    when (playbackState) {
                        Player.STATE_BUFFERING -> GvLogger.i(TAG, "player buffering pageKind=${source.pageKind}")
                        Player.STATE_READY -> GvLogger.i(TAG, "player prepared pageKind=${source.pageKind}")
                        Player.STATE_ENDED -> GvLogger.i(TAG, "player ended pageKind=${source.pageKind}")
                    }
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    if (isPlaying) {
                        GvLogger.i(TAG, "player started pageKind=${source.pageKind}")
                    }
                }

                override fun onVideoSizeChanged(videoSize: VideoSize) {
                    val width = videoSize.width
                    val height = videoSize.height
                    if (width > 0 && height > 0) {
                        GvLogger.i(TAG, "player video size=${width}x$height pageKind=${source.pageKind}")
                    }
                }

                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    GvLogger.e(
                        TAG,
                        "player failed errorType=${error.errorCodeName} pageKind=${source.pageKind}",
                        error
                    )
                    listener?.onPromotedPlayerError(source, error)
                }
            })
            prepare()
        }

        renderView.player = exoPlayer
        host.removeAllViews()
        host.addView(renderView)
        host.visibility = android.view.View.VISIBLE

        playerView = renderView
        player = exoPlayer
        activeSource = source

        GvLogger.i(
            TAG,
            "player backend=media3 qualityPolicy=highest-supported-bitrate mimeType=${normalizeMimeType(source.mimeHint) ?: "unknown"} pageKind=${source.pageKind}"
        )
    }

    fun stop(reason: String) {
        releaseInternal(reason)
    }

    fun onStart() {
        player?.playWhenReady = true
    }

    fun onStop() {
        player?.pause()
    }

    fun release() {
        releaseInternal(reason = "release")
    }

    private fun releaseInternal(reason: String) {
        val hadPreviousSource = activeSource != null
        playerView?.player = null
        player?.release()
        player = null
        playerView = null
        activeSource = null
        host.removeAllViews()
        host.visibility = android.view.View.GONE
        if (hadPreviousSource) {
            GvLogger.i(TAG, "promoted media exited reason=$reason")
        }
    }

    private fun normalizeMimeType(mimeHint: String?): String? = when (mimeHint?.lowercase()) {
        "application/x-mpegurl" -> MimeTypes.APPLICATION_M3U8
        "application/vnd.apple.mpegurl" -> MimeTypes.APPLICATION_M3U8
        "video/mp4" -> MimeTypes.VIDEO_MP4
        "video/webm" -> MimeTypes.VIDEO_WEBM
        "audio/*" -> null
        else -> mimeHint
    }

    private fun pointerEvent(action: Int, downTime: Long, x: Float, y: Float): MotionEvent {
        val eventTime = android.os.SystemClock.uptimeMillis()
        return MotionEvent.obtain(
            downTime,
            eventTime,
            action,
            x,
            y,
            0,
        ).apply {
            source = InputDevice.SOURCE_TOUCHSCREEN
        }
    }

    private companion object {
        private const val TAG = "GvPlayer"
    }
}
