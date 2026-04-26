package com.kulchaflo.tv.mk2.promotedmedia

import android.net.Uri
import com.kulchaflo.tv.mk2.util.Logger
import com.kulchaflo.tv.mk2.util.HostPolicyRegistry

class GenericHtml5MediaAdapter(
    private val domVideoSourceResolver: DomVideoSourceResolver = DomVideoSourceResolver(),
    private val mseBlobSourceResolver: MseBlobSourceResolver = MseBlobSourceResolver(),
    private val youTubeStreamingDataResolver: YouTubeStreamingDataResolver = YouTubeStreamingDataResolver(),
) : PromotedMediaSiteAdapter {
    override val platformId: String = "html5-generic"

    override fun probe(
        pageUrl: String,
        pageTitle: String?,
    ): PromotedMediaSiteAdapter.ProbeResult? {
        val parsed = runCatching { Uri.parse(pageUrl) }.getOrNull() ?: return null
        val scheme = parsed.scheme?.lowercase() ?: return null
        if (scheme != "http" && scheme != "https") {
            return null
        }
        val host = HostPolicyRegistry.normalizedHostFromHost(parsed.host) ?: return null
        val path = parsed.encodedPath.orEmpty()
        val directPlayable = buildDirectPlayableSource(pageUrl, path)
        val youTubeKind = resolveYouTubePageKind(host, path)
        val youTubeNavigationReason = if (youTubeKind != null && !isYouTubePlaybackPageKind(youTubeKind)) {
            "youtube-navigation-page kind=$youTubeKind"
        } else {
            null
        }
        val mediaEvidence = when {
            directPlayable != null -> null
            youTubeKind != null && isYouTubePlaybackPageKind(youTubeKind) -> MediaEvidence("youtube:$youTubeKind")
            youTubeNavigationReason != null -> null
            else -> detectMediaEvidence(parsed, path)
        }
        val pageKind = when {
            directPlayable != null -> "direct-media-url"
            youTubeKind != null && isYouTubePlaybackPageKind(youTubeKind) -> youTubeKind
            mediaEvidence != null -> "media-evidence-page"
            else -> "html5-page"
        }

        val session = PromotedMediaSession(
            platformId = platformId,
            pageUrl = pageUrl,
            pageTitle = pageTitle,
            pageKind = pageKind,
            contentId = null,
            mediaTitle = pageTitle,
            metadata = mapOf(
                "host" to host,
                "path" to path,
            ),
        )
        return PromotedMediaSiteAdapter.ProbeResult(
            session = session,
            eligibility = if (directPlayable != null || mediaEvidence != null) {
                PromotedMediaSiteAdapter.Eligibility.ELIGIBLE
            } else {
                PromotedMediaSiteAdapter.Eligibility.NAVIGATION_ONLY
            },
            sourceCandidate = directPlayable ?: if (mediaEvidence != null) {
                PromotedMediaSource(
                    sourceId = "html5-media-evidence",
                    kind = PromotedMediaSource.Kind.PAGE_VIDEO,
                    uri = pageUrl,
                )
            } else {
                null
            },
            reason = when {
                directPlayable != null -> "media-evidence kind=direct-playable host=$host title=${pageTitle.orEmpty()}"
                youTubeNavigationReason != null -> "$youTubeNavigationReason host=$host path=$path title=${pageTitle.orEmpty()}"
                mediaEvidence != null -> "media-evidence kind=${mediaEvidence.kind} host=$host path=$path title=${pageTitle.orEmpty()}"
                else -> "no-media-evidence host=$host path=$path title=${pageTitle.orEmpty()}"
            },
        )
    }

    override fun resolveSource(
        session: PromotedMediaSession,
        context: PromotedMediaSiteAdapter.ResolutionContext,
        callback: (PromotedMediaSiteAdapter.SourceResult) -> Unit,
    ) {
        Logger.i(TAG, "source resolution attempt resolver=generic-dom platform=${session.platformId} pageUrl=${session.pageUrl}")
        if (isYouTubePlaybackPage(session)) {
            Logger.i(TAG, "youtube watch analysis pageKind=${session.pageKind} url=${session.pageUrl}")
            Logger.i(TAG, "youtube extraction attempted resolver=generic-dom pageKind=${session.pageKind} url=${session.pageUrl}")
        }
        domVideoSourceResolver.inspect(session, context) { inspection ->
            if (isYouTubePlaybackPage(session)) {
                Logger.i(
                    TAG,
                    "youtube extraction result resolver=generic-dom sourceKind=${inspection.source?.kind ?: "none"} reason=${inspection.reason}"
                )
            }
            if (inspection.source != null) {
                Logger.i(TAG, "generic DOM resolved platform=${session.platformId} pageUrl=${session.pageUrl} reason=${inspection.reason}")
                callback(
                    PromotedMediaSiteAdapter.SourceResult(
                        source = inspection.source,
                        reason = "generic-dom-resolved ${inspection.reason}",
                    ),
                )
                return@inspect
            }

            Logger.i(TAG, "generic DOM failed platform=${session.platformId} pageUrl=${session.pageUrl} reason=${inspection.reason}")
            if (isYouTubePlaybackPage(session)) {
                Logger.i(
                    TAG,
                    "youtube extraction fallback to PAGE_VIDEO reason=${inspection.reason} pageKind=${session.pageKind} resolver=generic-dom"
                )
                resolveGenericMseBlob(
                    session = session,
                    context = context,
                    prefixReason = "generic-dom-failed ${inspection.reason}",
                    fallback = { mseFailureReason ->
                        val mseFailureDetail = mseFailureReason.ifBlank { "none" }
                        Logger.i(TAG, "source resolution attempt resolver=youtube-fallback-helper platform=${session.platformId} pageUrl=${session.pageUrl} strategy=after-generic-mse")
                        Logger.i(TAG, "youtube extraction attempted resolver=youtube-streaming-data pageKind=${session.pageKind} url=${session.pageUrl}")
                        youTubeStreamingDataResolver.resolve(session, context) { youTubeResult ->
                            if (isYouTubePlaybackPage(session)) {
                                Logger.i(
                                    TAG,
                                    "youtube extraction result resolver=youtube-streaming-data sourceKind=${youTubeResult.source?.kind ?: "none"} reason=${youTubeResult.reason}"
                                )
                            }
                            if (youTubeResult.source != null) {
                                Logger.i(TAG, "YouTube fallback resolved platform=${session.platformId} pageUrl=${session.pageUrl} reason=${youTubeResult.reason}")
                                callback(
                                    youTubeResult.copy(
                                        reason = "generic-dom-failed ${inspection.reason} | generic-mse-blob-failed $mseFailureDetail | youtube-fallback-resolved ${youTubeResult.reason}",
                                    ),
                                )
                                return@resolve
                            }

                            Logger.i(TAG, "YouTube fallback failed platform=${session.platformId} pageUrl=${session.pageUrl} reason=${youTubeResult.reason}")
                            if (isYouTubePlaybackPage(session)) {
                                Logger.i(
                                    TAG,
                                    "youtube extraction fallback to PAGE_VIDEO reason=${youTubeResult.reason} pageKind=${session.pageKind} resolver=youtube-streaming-data"
                                )
                            }
                            callback(
                                youTubeResult.copy(
                                    reason = "generic-dom-failed ${inspection.reason} | generic-mse-blob-failed $mseFailureDetail | youtube-fallback-failed ${youTubeResult.reason}",
                                ),
                            )
                        }
                    },
                    callback = callback,
                )
                return@inspect
            }

            resolveGenericMseBlob(
                session = session,
                context = context,
                prefixReason = "generic-dom-failed ${inspection.reason}",
                callback = callback,
            )
        }
    }

    private fun resolveGenericMseBlob(
        session: PromotedMediaSession,
        context: PromotedMediaSiteAdapter.ResolutionContext,
        prefixReason: String,
        fallback: ((String) -> Unit)? = null,
        callback: (PromotedMediaSiteAdapter.SourceResult) -> Unit,
    ) {
        Logger.i(TAG, "source resolution attempt resolver=generic-mse-blob platform=${session.platformId} pageUrl=${session.pageUrl}")
        if (isYouTubePlaybackPage(session)) {
            Logger.i(TAG, "youtube extraction attempted resolver=generic-mse-blob pageKind=${session.pageKind} url=${session.pageUrl}")
        }
        mseBlobSourceResolver.resolve(session, context) { mseResult ->
            if (isYouTubePlaybackPage(session)) {
                Logger.i(
                    TAG,
                    "youtube extraction result resolver=generic-mse-blob sourceKind=${mseResult.source?.kind ?: "none"} reason=${mseResult.reason}"
                )
            }
            if (mseResult.source != null) {
                Logger.i(TAG, "generic MSE/blob resolved platform=${session.platformId} pageUrl=${session.pageUrl} reason=${mseResult.reason}")
                callback(
                    mseResult.copy(
                        reason = "$prefixReason | generic-mse-blob-resolved ${mseResult.reason}",
                    ),
                )
                return@resolve
            }

            Logger.i(TAG, "generic MSE/blob failed platform=${session.platformId} pageUrl=${session.pageUrl} reason=${mseResult.reason}")
            if (isYouTubePlaybackPage(session)) {
                Logger.i(
                    TAG,
                    "youtube extraction blocked reason=${mseResult.reason} pageKind=${session.pageKind} resolver=generic-mse-blob"
                )
            }
            if (fallback != null) {
                fallback(mseResult.reason)
                return@resolve
            }
            if (HostPolicyRegistry.isYouTubeHost(HostPolicyRegistry.normalizedHost(session.pageUrl)) && !isYouTubePlaybackPage(session)) {
                Logger.i(TAG, "source resolution attempt resolver=youtube-fallback-helper platform=${session.platformId} pageUrl=${session.pageUrl}")
                youTubeStreamingDataResolver.resolve(session, context) { youTubeResult ->
                    if (youTubeResult.source != null) {
                        Logger.i(TAG, "YouTube fallback resolved platform=${session.platformId} pageUrl=${session.pageUrl} reason=${youTubeResult.reason}")
                    } else {
                        Logger.i(TAG, "YouTube fallback failed platform=${session.platformId} pageUrl=${session.pageUrl} reason=${youTubeResult.reason}")
                    }
                    callback(
                        youTubeResult.copy(
                            reason = "$prefixReason | generic-mse-blob-failed ${mseResult.reason} | youtube-fallback ${youTubeResult.reason}",
                        ),
                    )
                }
                return@resolve
            }

            callback(
                mseResult.copy(
                    reason = "$prefixReason | generic-mse-blob-failed ${mseResult.reason}",
                ),
            )
        }
    }

    private fun isYouTubePlaybackPage(session: PromotedMediaSession): Boolean {
        return HostPolicyRegistry.isYouTubeHost(HostPolicyRegistry.normalizedHost(session.pageUrl)) && isYouTubePlaybackPageKind(session.pageKind)
    }

    private fun buildDirectPlayableSource(pageUrl: String, path: String): PromotedMediaSource? {
        val normalized = path.lowercase()
        val extension = DIRECT_PLAYABLE_EXTENSIONS.firstOrNull { normalized.endsWith(it) } ?: return null
        val mimeType = when (extension) {
            ".m3u8" -> "application/x-mpegURL"
            ".mp4", ".m4v" -> "video/mp4"
            ".webm" -> "video/webm"
            ".mp3" -> "audio/mpeg"
            ".m4a" -> "audio/mp4"
            else -> null
        }
        return PromotedMediaSource(
            sourceId = "html5-direct-url",
            kind = PromotedMediaSource.Kind.EXTRACTED_STREAM,
            uri = pageUrl,
            mimeType = mimeType,
        )
    }

    private fun detectMediaEvidence(parsed: Uri, path: String): MediaEvidence? {
        val normalizedPath = path.lowercase()
        val queryNames = parsed.queryParameterNames.map { it.lowercase() }
        val pathMatch = MEDIA_EVIDENCE_PATH_TOKENS.firstOrNull { token ->
            normalizedPath.contains("/$token") || normalizedPath.contains("$token/")
        }
        if (pathMatch != null) {
            return MediaEvidence("path:$pathMatch")
        }
        val queryMatch = MEDIA_EVIDENCE_QUERY_KEYS.firstOrNull { key -> queryNames.contains(key) }
        if (queryMatch != null) {
            return MediaEvidence("query:$queryMatch")
        }
        return null
    }

    private fun resolveYouTubePageKind(host: String, path: String): String? {
        if (host == "youtu.be") return "youtu-be"
        if (!HostPolicyRegistry.isYouTubeHost(host)) return null
        return when {
            path.startsWith("/watch") -> "watch"
            path.startsWith("/playlist") -> "playlist"
            path.startsWith("/shorts") -> "shorts"
            path.startsWith("/live") -> "live"
            path.startsWith("/embed") -> "embed"
            path.startsWith("/channel/") -> "channel"
            path.startsWith("/c/") -> "custom-channel"
            path.startsWith("/user/") -> "user-channel"
            path.startsWith("/@") -> "handle-channel"
            else -> "other"
        }
    }

    private fun isYouTubePlaybackPageKind(kind: String): Boolean {
        return kind == "watch" || kind == "shorts" || kind == "live" || kind == "embed" || kind == "youtu-be"
    }

    private data class MediaEvidence(
        val kind: String,
    )

    private companion object {
        private const val TAG = "KfPromotedMedia"
        private val DIRECT_PLAYABLE_EXTENSIONS = listOf(".m3u8", ".mp4", ".m4v", ".webm", ".mp3", ".m4a")
        private val MEDIA_EVIDENCE_PATH_TOKENS = listOf("watch", "video", "videos", "embed", "player", "stream", "live", "reel")
        private val MEDIA_EVIDENCE_QUERY_KEYS = setOf("v", "video", "media", "src", "file")
    }
}
