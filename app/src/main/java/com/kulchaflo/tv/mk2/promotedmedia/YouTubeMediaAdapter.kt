package com.kulchaflo.tv.mk2.promotedmedia

import android.net.Uri
import com.kulchaflo.tv.mk2.util.HostPolicyRegistry

class YouTubeMediaAdapter(
    private val domVideoSourceResolver: DomVideoSourceResolver = DomVideoSourceResolver(),
    private val mseBlobSourceResolver: MseBlobSourceResolver = MseBlobSourceResolver(),
    private val youTubeStreamingDataResolver: YouTubeStreamingDataResolver = YouTubeStreamingDataResolver(),
) : PromotedMediaSiteAdapter {
    override val platformId: String = "youtube"

    override fun probe(
        pageUrl: String,
        pageTitle: String?,
    ): PromotedMediaSiteAdapter.ProbeResult? {
        val parsed = runCatching { Uri.parse(pageUrl) }.getOrNull() ?: return null
        val host = HostPolicyRegistry.normalizedHostFromHost(parsed.host) ?: return null
        val path = parsed.encodedPath.orEmpty()
        val contentId = parsed.getQueryParameter("v")

        if (!HostPolicyRegistry.isYouTubeHost(host)) {
            return null
        }

        val pageKind = resolvePageKind(host, path)
        val eligible = when (pageKind) {
            "watch", "shorts", "live", "embed", "youtu-be" -> true
            else -> false
        }

        val session = PromotedMediaSession(
            platformId = platformId,
            pageUrl = pageUrl,
            pageTitle = pageTitle,
            pageKind = pageKind,
            contentId = contentId,
            mediaTitle = pageTitle,
            metadata = mapOf(
                "host" to host,
                "path" to path,
            ),
        )
        val sourceCandidate = if (eligible) {
            PromotedMediaSource(
                sourceId = "youtube-page-surface",
                kind = PromotedMediaSource.Kind.PAGE_VIDEO,
                uri = pageUrl,
            )
        } else {
            null
        }
        return PromotedMediaSiteAdapter.ProbeResult(
            session = session,
            eligibility = if (eligible) {
                PromotedMediaSiteAdapter.Eligibility.ELIGIBLE
            } else {
                PromotedMediaSiteAdapter.Eligibility.NAVIGATION_ONLY
            },
            sourceCandidate = sourceCandidate,
            reason = if (eligible) {
                "generic media candidate kind=$pageKind title=${pageTitle.orEmpty()}"
            } else {
                "navigation-page kind=$pageKind title=${pageTitle.orEmpty()}"
            },
        )
    }

    override fun resolveSource(
        session: PromotedMediaSession,
        context: PromotedMediaSiteAdapter.ResolutionContext,
        callback: (PromotedMediaSiteAdapter.SourceResult) -> Unit,
    ) {
        val eligible = when (session.pageKind) {
            "watch", "shorts", "live", "embed", "youtu-be" -> true
            else -> false
        }
        if (!eligible) {
            callback(
                PromotedMediaSiteAdapter.SourceResult(
                    source = null,
                    reason = "navigation page has no promoted source",
                ),
            )
            return
        }
        domVideoSourceResolver.inspect(session, context) { inspection ->
            if (inspection.source != null) {
                callback(
                    PromotedMediaSiteAdapter.SourceResult(
                        source = inspection.source,
                        reason = inspection.reason,
                    ),
                )
                return@inspect
            }
            mseBlobSourceResolver.resolve(session, context) { mseResult ->
                if (mseResult.source != null) {
                    callback(
                        mseResult.copy(
                            reason = "${inspection.reason} | ${mseResult.reason}",
                        ),
                    )
                    return@resolve
                }
                youTubeStreamingDataResolver.resolve(session, context) { youtubeResult ->
                    callback(
                        youtubeResult.copy(
                            reason = "${inspection.reason} | ${mseResult.reason} | ${youtubeResult.reason}",
                        ),
                    )
                }
            }
        }
    }

    private fun resolvePageKind(host: String, path: String): String {
        if (host == "youtu.be") return "youtu-be"
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
}
