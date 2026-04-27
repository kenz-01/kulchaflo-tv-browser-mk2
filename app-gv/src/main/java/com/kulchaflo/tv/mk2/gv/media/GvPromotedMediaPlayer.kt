package com.kulchaflo.tv.mk2.gv.media

import android.content.Context
import android.net.Uri
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
    private var playerView: PlayerView? = null
    private var player: ExoPlayer? = null
    private var activeSource: GvMediaPathController.Observation? = null

    fun isPromoted(): Boolean = activeSource != null

    fun currentSourceUrl(): String? = activeSource?.url

    fun play(source: GvMediaPathController.Observation) {
        if (activeSource?.url == source.url) {
            GvLogger.i(TAG, "promoted media unchanged url=${source.url}")
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
                        Player.STATE_BUFFERING -> GvLogger.i(TAG, "player buffering url=${source.url}")
                        Player.STATE_READY -> GvLogger.i(TAG, "player prepared url=${source.url}")
                        Player.STATE_ENDED -> GvLogger.i(TAG, "player ended url=${source.url}")
                    }
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    if (isPlaying) {
                        GvLogger.i(TAG, "player started url=${source.url}")
                    }
                }

                override fun onVideoSizeChanged(videoSize: VideoSize) {
                    val width = videoSize.width
                    val height = videoSize.height
                    if (width > 0 && height > 0) {
                        GvLogger.i(TAG, "player video size=${width}x$height url=${source.url}")
                    }
                }

                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    GvLogger.e(
                        TAG,
                        "player failed errorType=${error.errorCodeName} message=${error.message ?: "unknown"} url=${source.url}",
                        error
                    )
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
            "player backend=media3 qualityPolicy=highest-supported-bitrate url=${source.url} mimeType=${normalizeMimeType(source.mimeHint) ?: "unknown"} pageKind=${source.pageKind}"
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
        val previousUrl = activeSource?.url
        playerView?.player = null
        player?.release()
        player = null
        playerView = null
        activeSource = null
        host.removeAllViews()
        host.visibility = android.view.View.GONE
        if (previousUrl != null) {
            GvLogger.i(TAG, "promoted media exited reason=$reason url=$previousUrl")
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

    private companion object {
        private const val TAG = "GvPlayer"
    }
}
