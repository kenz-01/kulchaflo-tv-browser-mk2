package com.kulchaflo.tv.mk2.promotedmedia

import android.content.Context
import android.graphics.SurfaceTexture
import android.view.TextureView
import android.view.View
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.kulchaflo.tv.mk2.util.Logger
import java.net.URL

interface PromotedMediaPlayer {
    val playerId: String

    fun createRenderView(context: Context): View

    fun onAttach(session: PromotedMediaSession, source: PromotedMediaSource)

    fun onDetach()
}

class TextureSurfacePromotedMediaPlayer : PromotedMediaPlayer, TextureView.SurfaceTextureListener {
    override val playerId: String = "texture-surface-promoted-player"

    private var appContext: Context? = null
    private var textureView: TextureView? = null
    private var exoPlayer: ExoPlayer? = null
    private var pendingSession: PromotedMediaSession? = null
    private var pendingSource: PromotedMediaSource? = null
    private var textureAvailable = false
    private var lastStartedSource: PromotedMediaSource? = null
    private var retriedWithoutCookiesForUri: String? = null

    override fun createRenderView(context: Context): View {
        appContext = context.applicationContext
        return TextureView(context).also { view ->
            textureView = view
            view.surfaceTextureListener = this
            Logger.i(TAG, "player render surface created type=TextureView playerId=$playerId backend=media3")
        }
    }

    override fun onAttach(session: PromotedMediaSession, source: PromotedMediaSource) {
        pendingSession = session
        pendingSource = source
        Logger.i(
            TAG,
            "player attach requested playerId=$playerId backend=media3 platform=${session.platformId} pageKind=${session.pageKind} sourceKind=${source.kind} sourceUri=${source.uri ?: "none"}"
        )
        maybeStartPlayback()
    }

    override fun onDetach() {
        pendingSession = null
        pendingSource = null
        releasePlayer()
        Logger.i(TAG, "player detach completed playerId=$playerId backend=media3")
    }

    override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        textureAvailable = true
        Logger.i(TAG, "player surface available playerId=$playerId backend=media3 width=$width height=$height")
        exoPlayer?.setVideoTextureView(textureView)
        maybeStartPlayback()
    }

    override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        Logger.i(TAG, "player surface resized playerId=$playerId backend=media3 width=$width height=$height")
    }

    override fun onSurfaceTextureDestroyed(surfaceTexture: SurfaceTexture): Boolean {
        textureAvailable = false
        Logger.i(TAG, "player surface destroyed playerId=$playerId backend=media3")
        releasePlayer()
        return true
    }

    override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) = Unit

    private fun maybeStartPlayback() {
        val session = pendingSession ?: return
        val source = pendingSource ?: return
        if (!textureAvailable || textureView == null) {
            Logger.i(
                TAG,
                "player waiting for surface playerId=$playerId backend=media3 platform=${session.platformId} sourceKind=${source.kind}"
            )
            return
        }

        if (source.kind != PromotedMediaSource.Kind.EXTRACTED_STREAM || source.uri.isNullOrBlank()) {
            Logger.i(
                TAG,
                "player unsupported source kind=${source.kind} reason=promotion-requires-extracted-stream playerId=$playerId backend=media3 sourceUri=${source.uri ?: "none"}"
            )
            return
        }

        val context = appContext
        if (context == null) {
            Logger.w(TAG, "player failed errorType=missing-context message=no-application-context playerId=$playerId backend=media3")
            return
        }

        releasePlayer()

        val httpFactory = buildHttpDataSourceFactory(source)
        val mediaSourceFactory = DefaultMediaSourceFactory(buildDataSourceFactory(context, httpFactory))
        val player = ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .build()
        exoPlayer = player
        player.setVideoTextureView(textureView)
        player.repeatMode = Player.REPEAT_MODE_OFF
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                when (playbackState) {
                    Player.STATE_READY -> {
                        Logger.i(TAG, "player prepared playerId=$playerId backend=media3")
                        if (!player.playWhenReady) {
                            player.playWhenReady = true
                            player.play()
                            Logger.i(TAG, "player started playerId=$playerId backend=media3")
                        }
                    }

                    Player.STATE_ENDED -> {
                        Logger.i(TAG, "player ended playerId=$playerId backend=media3")
                    }
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                val sourceForError = lastStartedSource
                val retried = maybeRetryWithoutCookiesOnGoogleVideo(error, sourceForError)
                if (retried) {
                    return
                }
                Logger.w(
                    TAG,
                    "player failed errorType=${playbackErrorType(error)} message=${error.message ?: "unknown"} detail=${playbackErrorDetail(error)} playerId=$playerId backend=media3"
                )
            }
        })

        val mediaItem = buildMediaItem(source)
        lastStartedSource = source
        val hasHeaders = source.headers.isNotEmpty()
        val hasCookies = !source.headers["Cookie"].isNullOrBlank()
        Logger.i(
            TAG,
            "player backend=media3 playerId=$playerId source kind=${source.kind} headers attached=$hasHeaders cookies attached=$hasCookies"
        )
        Logger.i(
            TAG,
            "player media item prepared uri=${source.uri} mimeType=${source.mimeType ?: inferredMimeType(source) ?: "unknown"}"
        )
        runCatching {
            player.setMediaItem(mediaItem)
            player.prepare()
        }.onFailure { throwable ->
            Logger.w(
                TAG,
                "player failed errorType=prepare-exception message=${throwable.message ?: throwable.javaClass.simpleName} playerId=$playerId backend=media3"
            )
            releasePlayer()
        }
    }

    private fun buildMediaItem(source: PromotedMediaSource): MediaItem {
        return MediaItem.Builder()
            .setUri(source.uri)
            .apply {
                (normalizedMimeType(source.mimeType) ?: inferredMimeType(source))?.let { setMimeType(it) }
            }
            .build()
    }

    private fun buildHttpDataSourceFactory(source: PromotedMediaSource): HttpDataSource.Factory {
        val userAgent = source.headers["User-Agent"].orEmpty().ifBlank { DEFAULT_USER_AGENT }
        val requestHeaders = source.headers
            .filterKeys { key -> !key.equals("User-Agent", ignoreCase = true) }
        return DefaultHttpDataSource.Factory()
            .setUserAgent(userAgent)
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(12000)
            .setReadTimeoutMs(12000)
            .setDefaultRequestProperties(requestHeaders)
    }

    private fun buildDataSourceFactory(
        context: Context,
        httpFactory: HttpDataSource.Factory,
    ): DataSource.Factory {
        return DefaultDataSource.Factory(context, httpFactory)
    }

    private fun inferredMimeType(source: PromotedMediaSource): String? {
        val uri = source.uri.orEmpty().lowercase()
        return when {
            uri.contains(".m3u8") -> MimeTypes.APPLICATION_M3U8
            uri.contains(".mpd") -> MimeTypes.APPLICATION_MPD
            uri.contains(".mp4") || uri.contains(".m4v") -> MimeTypes.VIDEO_MP4
            uri.contains(".webm") -> MimeTypes.VIDEO_WEBM
            uri.contains(".mp3") -> MimeTypes.AUDIO_MPEG
            uri.contains(".m4a") -> MimeTypes.AUDIO_MP4
            else -> null
        }
    }

    private fun normalizedMimeType(mimeType: String?): String? {
        val raw = mimeType?.trim().orEmpty()
        if (raw.isBlank()) return null
        return raw.substringBefore(';').trim().ifBlank { null }
    }

    private fun playbackErrorType(error: PlaybackException): String {
        return when (error.errorCode) {
            PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
            PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT,
            PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS,
            PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND -> "network-io"

            PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED,
            PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED,
            PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED,
            PlaybackException.ERROR_CODE_PARSING_MANIFEST_UNSUPPORTED -> "parsing"

            PlaybackException.ERROR_CODE_DECODING_FAILED,
            PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED,
            PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES -> "decoding"

            PlaybackException.ERROR_CODE_DRM_SCHEME_UNSUPPORTED,
            PlaybackException.ERROR_CODE_DRM_PROVISIONING_FAILED,
            PlaybackException.ERROR_CODE_DRM_CONTENT_ERROR -> "drm"

            else -> "playback"
        }
    }

    private fun playbackErrorDetail(error: PlaybackException): String {
        val cause = error.cause
        if (cause is HttpDataSource.InvalidResponseCodeException) {
            return "httpStatus=${cause.responseCode} uri=${cause.dataSpec.uri} headers=${cause.headerFields.keys.filterNotNull().joinToString(",").ifBlank { "none" }}"
        }
        return "cause=${cause?.javaClass?.simpleName ?: "none"}"
    }

    private fun maybeRetryWithoutCookiesOnGoogleVideo(
        error: PlaybackException,
        source: PromotedMediaSource?,
    ): Boolean {
        val currentSource = source ?: return false
        val uri = currentSource.uri ?: return false
        if (!isGoogleVideoUrl(uri)) return false
        if (currentSource.headers["Cookie"].isNullOrBlank()) return false
        if (retriedWithoutCookiesForUri == uri) return false
        val cause = error.cause
        val isHttpFailure = cause is HttpDataSource.InvalidResponseCodeException
        val isNetworkLike = playbackErrorType(error) == "network-io"
        if (!isHttpFailure && !isNetworkLike) return false

        retriedWithoutCookiesForUri = uri
        val retriedSource = currentSource.copy(
            headers = currentSource.headers.filterKeys { !it.equals("Cookie", ignoreCase = true) }
        )
        Logger.i(
            TAG,
            "player retry without cookies reason=googlevideo-network-failure playerId=$playerId backend=media3 uri=$uri"
        )
        pendingSource = retriedSource
        maybeStartPlayback()
        return true
    }

    private fun isGoogleVideoUrl(uri: String): Boolean {
        return runCatching {
            val parsed = URL(uri)
            val host = parsed.host.lowercase()
            host.contains("googlevideo.com") && parsed.path.lowercase().contains("videoplayback")
        }.getOrDefault(false)
    }

    private fun releasePlayer() {
        val player = exoPlayer ?: return
        runCatching {
            player.clearMediaItems()
            player.clearVideoTextureView(textureView)
            player.release()
        }
        exoPlayer = null
        lastStartedSource = null
    }

    private companion object {
        private const val TAG = "KfPromotedMedia"
        private const val DEFAULT_USER_AGENT = "KulchaFloTvMkII/1.0"
    }
}
