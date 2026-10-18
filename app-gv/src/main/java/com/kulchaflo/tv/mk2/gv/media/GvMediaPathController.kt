package com.kulchaflo.tv.mk2.gv.media

import android.net.Uri
import com.kulchaflo.tv.mk2.gv.util.GvLogger

class GvMediaPathController {
    enum class State {
        BROWSER,
        CANDIDATE,
        READY_FOR_PROMOTION,
    }

    enum class ObservationKind {
        CANDIDATE_ONLY,
        DIRECT_MEDIA_READY,
    }

    data class Observation(
        val url: String,
        val pageKind: String,
        val kind: ObservationKind,
        val reason: String,
        val mimeHint: String? = null,
    )

    private var state: State = State.BROWSER

    fun onPageObserved(url: String, title: String?): Observation? {
        val observation = classify(url, title)
        when {
            observation == null -> {
                if (state != State.BROWSER) {
                    state = State.BROWSER
                }
                GvLogger.i(TAG, "page not eligible url=$url reason=no-media-evidence state=$state")
                return null
            }

            observation.kind == ObservationKind.CANDIDATE_ONLY -> {
                state = State.CANDIDATE
                GvLogger.i(
                    TAG,
                    "candidate-only page sourceKind=PAGE_VIDEO staying-in-browser pageKind=${observation.pageKind} url=$url reason=${observation.reason}"
                )
                return observation
            }

            else -> {
                state = State.READY_FOR_PROMOTION
                GvLogger.i(
                    TAG,
                    "playable source observed sourceKind=EXTRACTED_STREAM staying-in-browser pageKind=${observation.pageKind} url=$url mimeHint=${observation.mimeHint ?: "unknown"} reason=${observation.reason}"
                )
                return observation
            }
        }
    }

    fun onExtensionMediaEvidence(
        pageUrl: String,
        sourceUrl: String,
        mimeType: String?,
        title: String?,
    ): Observation? {
        val observation = classifyDirectSource(
            sourceUrl = sourceUrl,
            title = title,
            reasonPrefix = "extension-media-evidence",
            explicitMimeType = mimeType,
        ) ?: return null
        state = State.READY_FOR_PROMOTION
        GvLogger.i(
            TAG,
            "extension media evidence sourceKind=EXTRACTED_STREAM pageKind=${observation.pageKind} mimeHint=${observation.mimeHint ?: "unknown"}"
        )
        return observation
    }

    private fun classify(url: String, title: String?): Observation? {
        val parsed = runCatching { Uri.parse(url) }.getOrNull() ?: return null
        val host = parsed.host?.lowercase().orEmpty().removePrefix("www.")
        val path = parsed.encodedPath.orEmpty()
        return when {
            isDirectMediaPath(path) -> classifyDirectSource(
                sourceUrl = url,
                title = title,
                reasonPrefix = "direct-media-url",
                explicitMimeType = null,
            )
            host == "youtu.be" || (host.endsWith("youtube.com") && (path == "/watch" || path.startsWith("/live") || path.startsWith("/shorts/"))) -> Observation(
                url = url,
                pageKind = when {
                    host == "youtu.be" -> "youtu-be"
                    path == "/watch" -> "watch"
                    path.startsWith("/live") -> "live"
                    else -> "shorts"
                },
                kind = ObservationKind.CANDIDATE_ONLY,
                reason = "playback-page title=${title.orEmpty()}",
            )
            else -> null
        }
    }

    private fun classifyDirectSource(
        sourceUrl: String,
        title: String?,
        reasonPrefix: String,
        explicitMimeType: String?,
    ): Observation? {
        val parsed = runCatching { Uri.parse(sourceUrl) }.getOrNull() ?: return null
        val path = parsed.encodedPath.orEmpty()
        val mimeHint = explicitMimeType?.ifBlank { null } ?: inferMimeType(path)
        if (!isDirectMediaPath(path) && mimeHint == null) {
            return null
        }
        return Observation(
            url = sourceUrl,
            pageKind = "direct-media-url",
            kind = ObservationKind.DIRECT_MEDIA_READY,
            reason = "$reasonPrefix title=${title.orEmpty()}",
            mimeHint = mimeHint,
        )
    }

    private fun isDirectMediaPath(path: String): Boolean {
        val lower = path.lowercase()
        return lower.endsWith(".m3u8") ||
            lower.endsWith(".mp4") ||
            lower.endsWith(".webm") ||
            lower.endsWith(".mp3") ||
            lower.endsWith(".m4a")
    }

    private fun inferMimeType(path: String): String? = when {
        path.endsWith(".m3u8", ignoreCase = true) -> "application/x-mpegURL"
        path.endsWith(".mp4", ignoreCase = true) -> "video/mp4"
        path.endsWith(".webm", ignoreCase = true) -> "video/webm"
        path.endsWith(".mp3", ignoreCase = true) || path.endsWith(".m4a", ignoreCase = true) -> "audio/*"
        else -> null
    }

    private companion object {
        private const val TAG = "GvMedia"
    }
}
