package com.kulchaflo.tv.mk2.promotedmedia

import org.json.JSONArray
import org.json.JSONObject

class DomVideoSourceResolver {
    data class InspectionResult(
        val source: PromotedMediaSource?,
        val reason: String,
        val hasBlob: Boolean,
        val mediaSourcePresent: Boolean,
    )

    fun resolve(
        session: PromotedMediaSession,
        context: PromotedMediaSiteAdapter.ResolutionContext,
        callback: (PromotedMediaSiteAdapter.SourceResult) -> Unit,
    ) {
        inspect(session, context) { inspection ->
            callback(
                PromotedMediaSiteAdapter.SourceResult(
                    source = inspection.source,
                    reason = inspection.reason,
                ),
            )
        }
    }

    fun inspect(
        session: PromotedMediaSession,
        context: PromotedMediaSiteAdapter.ResolutionContext,
        callback: (InspectionResult) -> Unit,
    ) {
        context.evaluateJavascript(DOM_VIDEO_RESOLUTION_SCRIPT) { rawResult ->
            val payload = decodeJavascriptString(rawResult)
            if (payload.isNullOrBlank()) {
                callback(
                    InspectionResult(
                        source = null,
                        reason = "dom-probe-empty-result",
                        hasBlob = false,
                        mediaSourcePresent = false,
                    ),
                )
                return@evaluateJavascript
            }

            runCatching {
                val json = JSONObject(payload)
                val hasBlob = json.optBoolean("hasBlob", false)
                val mediaSourcePresent = json.optBoolean("mediaSourcePresent", false)
                val selected = json.optJSONObject("selected")
                if (selected == null) {
                    val candidateCount = json.optInt("candidateCount", 0)
                    val directCount = json.optInt("directCount", 0)
                    return@runCatching InspectionResult(
                        source = null,
                        reason = "dom-probe-no-direct-stream candidates=$candidateCount direct=$directCount hasBlob=$hasBlob mediaSourcePresent=$mediaSourcePresent",
                        hasBlob = hasBlob,
                        mediaSourcePresent = mediaSourcePresent,
                    )
                }

                val sourceUri = selected.optString("src").takeIf { it.isNotBlank() }
                if (sourceUri.isNullOrBlank()) {
                    return@runCatching InspectionResult(
                        source = null,
                        reason = "dom-probe-selected-missing-src hasBlob=$hasBlob mediaSourcePresent=$mediaSourcePresent",
                        hasBlob = hasBlob,
                        mediaSourcePresent = mediaSourcePresent,
                    )
                }

                val mimeType = selected.optString("type").takeIf { it.isNotBlank() }
                val headers = buildMap {
                    context.pageUrl?.takeIf { it.isNotBlank() }?.let { put("Referer", it) }
                    context.userAgent?.takeIf { it.isNotBlank() }?.let { put("User-Agent", it) }
                    context.cookiesFor(sourceUri)?.takeIf { it.isNotBlank() }?.let { put("Cookie", it) }
                }
                InspectionResult(
                    source = PromotedMediaSource(
                        sourceId = "dom-video-extracted-stream",
                        kind = PromotedMediaSource.Kind.EXTRACTED_STREAM,
                        uri = sourceUri,
                        mimeType = mimeType,
                        headers = headers,
                    ),
                    reason = buildString {
                        append("dom-probe-resolved-direct-stream")
                        append(" platform=").append(session.platformId)
                        append(" pageKind=").append(session.pageKind)
                        append(" mimeType=").append(mimeType ?: "unknown")
                        append(" hasBlob=").append(hasBlob)
                        append(" mediaSourcePresent=").append(mediaSourcePresent)
                    },
                    hasBlob = hasBlob,
                    mediaSourcePresent = mediaSourcePresent,
                )
            }.onSuccess(callback).onFailure { throwable ->
                callback(
                    InspectionResult(
                        source = null,
                        reason = "dom-probe-parse-failed:${throwable.javaClass.simpleName}",
                        hasBlob = false,
                        mediaSourcePresent = false,
                    ),
                )
            }
        }
    }

    private fun decodeJavascriptString(rawResult: String?): String? {
        if (rawResult.isNullOrBlank() || rawResult == "null") return null
        return runCatching {
            JSONArray("[$rawResult]").getString(0)
        }.getOrElse {
            rawResult.trim('"')
        }
    }

    private companion object {
        private val DOM_VIDEO_RESOLUTION_SCRIPT =
            """
            (() => {
              const videos = Array.from(document.querySelectorAll('video'));
              const candidates = videos.map((video, index) => {
                const rect = video.getBoundingClientRect();
                const style = window.getComputedStyle(video);
                const sourceEl = video.querySelector('source');
                const src = video.currentSrc || video.src || (sourceEl ? sourceEl.src : '') || '';
                const type = video.getAttribute('type') || (sourceEl ? sourceEl.type : '') || '';
                const visible = rect.width > 32 &&
                  rect.height > 32 &&
                  style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  style.opacity !== '0';
                const directHttp = /^https?:/i.test(src);
                const blob = /^blob:/i.test(src);
                return {
                  index,
                  src,
                  type,
                  visible,
                  directHttp,
                  blob,
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  paused: !!video.paused
                };
              });
              const selected = candidates.find((candidate) => candidate.visible && candidate.directHttp) ||
                candidates.find((candidate) => candidate.directHttp) ||
                null;
              return JSON.stringify({
                candidateCount: candidates.length,
                directCount: candidates.filter((candidate) => candidate.directHttp).length,
                hasBlob: candidates.some((candidate) => candidate.blob),
                mediaSourcePresent: typeof window.MediaSource !== 'undefined',
                selected,
                sample: candidates.slice(0, 3)
              });
            })();
            """.trimIndent()
    }
}
