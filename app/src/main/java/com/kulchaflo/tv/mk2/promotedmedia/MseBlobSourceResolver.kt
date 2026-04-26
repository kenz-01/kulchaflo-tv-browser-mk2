package com.kulchaflo.tv.mk2.promotedmedia

import com.kulchaflo.tv.mk2.util.Logger
import org.json.JSONArray
import org.json.JSONObject

class MseBlobSourceResolver {
    fun resolve(
        session: PromotedMediaSession,
        context: PromotedMediaSiteAdapter.ResolutionContext,
        callback: (PromotedMediaSiteAdapter.SourceResult) -> Unit,
    ) {
        Logger.i(TAG, "source resolution attempt resolver=mse-blob platform=${session.platformId} pageKind=${session.pageKind} url=${session.pageUrl}")
        context.evaluateJavascript(MSE_BLOB_RESOLUTION_SCRIPT) { rawResult ->
            val payload = decodeJavascriptString(rawResult)
            if (payload.isNullOrBlank()) {
                callback(
                    PromotedMediaSiteAdapter.SourceResult(
                        source = null,
                        reason = "mse-probe-empty-result",
                    ),
                )
                return@evaluateJavascript
            }

            runCatching {
                val json = JSONObject(payload)
                val blobCount = json.optInt("blobCount", 0)
                val mediaSourcePresent = json.optBoolean("mediaSourcePresent", false)
                val sourceBuffersObservable = json.optBoolean("sourceBuffersObservable", false)
                val selected = json.optJSONObject("selectedCandidate")
                val diagnosticPrefix = buildString {
                    append("blobCount=").append(blobCount)
                    append(" mediaSourcePresent=").append(mediaSourcePresent)
                    append(" sourceBuffersObservable=").append(sourceBuffersObservable)
                    append(" resourceCandidates=").append(json.optInt("resourceCandidateCount", 0))
                    append(" hls=").append(json.optInt("hlsCount", 0))
                    append(" mp4=").append(json.optInt("mp4Count", 0))
                    append(" webm=").append(json.optInt("webmCount", 0))
                    append(" audio=").append(json.optInt("audioCount", 0))
                    append(" dash=").append(json.optInt("dashCount", 0))
                    append(" googlevideoDirect=").append(json.optInt("googleVideoDirectCount", 0))
                    append(" segment=").append(json.optInt("segmentCount", 0))
                }
                if (blobCount > 0 || mediaSourcePresent) {
                    Logger.i(TAG, "blob/MSE detected platform=${session.platformId} pageKind=${session.pageKind} $diagnosticPrefix")
                }
                if (selected == null) {
                    val sampleNames = mutableListOf<String>()
                    val sample = json.optJSONArray("resourceSample") ?: JSONArray()
                    for (index in 0 until minOf(sample.length(), 3)) {
                        sampleNames += sample.optString(index)
                    }
                    val onlyDash = json.optInt("dashCount", 0) > 0 &&
                        json.optInt("hlsCount", 0) == 0 &&
                        json.optInt("mp4Count", 0) == 0 &&
                        json.optInt("webmCount", 0) == 0 &&
                        json.optInt("audioCount", 0) == 0
                    val onlySegments = json.optInt("segmentCount", 0) > 0 &&
                        json.optInt("hlsCount", 0) == 0 &&
                        json.optInt("mp4Count", 0) == 0 &&
                        json.optInt("webmCount", 0) == 0 &&
                        json.optInt("audioCount", 0) == 0 &&
                        json.optInt("dashCount", 0) == 0
                    return@runCatching PromotedMediaSiteAdapter.SourceResult(
                        source = null,
                        reason = "mse-probe-no-playable-candidate $diagnosticPrefix onlyDash=$onlyDash onlySegments=$onlySegments sample=${sampleNames.joinToString(separator = "|").ifBlank { "none" }}",
                    )
                }

                val candidateUrl = selected.optString("url").takeIf { it.isNotBlank() }
                if (candidateUrl.isNullOrBlank()) {
                    return@runCatching PromotedMediaSiteAdapter.SourceResult(
                        source = null,
                        reason = "mse-probe-selected-missing-url $diagnosticPrefix",
                    )
                }
                val mimeType = selected.optString("mimeType").takeIf { it.isNotBlank() }
                val headers = buildMap {
                    context.pageUrl?.takeIf { it.isNotBlank() }?.let { put("Referer", it) }
                    context.userAgent?.takeIf { it.isNotBlank() }?.let { put("User-Agent", it) }
                    context.cookiesFor(candidateUrl)?.takeIf { it.isNotBlank() }?.let { put("Cookie", it) }
                }
                PromotedMediaSiteAdapter.SourceResult(
                    source = PromotedMediaSource(
                        sourceId = "mse-resource-candidate",
                        kind = PromotedMediaSource.Kind.EXTRACTED_STREAM,
                        uri = candidateUrl,
                        mimeType = mimeType,
                        headers = headers,
                    ),
                    reason = "mse-probe-resolved-candidate kind=${selected.optString("kind").ifBlank { "unknown" }} supported=${selected.optBoolean("supported", false)} $diagnosticPrefix",
                )
            }.onSuccess(callback).onFailure { throwable ->
                callback(
                    PromotedMediaSiteAdapter.SourceResult(
                        source = null,
                        reason = "mse-probe-parse-failed:${throwable.javaClass.simpleName}",
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
        private const val TAG = "KfPromotedMedia"
        private val MSE_BLOB_RESOLUTION_SCRIPT =
            """
            (() => {
              const videos = Array.from(document.querySelectorAll('video'));
              const resourceEntries = (performance.getEntriesByType && performance.getEntriesByType('resource')) || [];
              const resourceNames = resourceEntries
                .map((entry) => entry && entry.name ? String(entry.name) : '')
                .filter(Boolean);
              const resourceCandidates = resourceNames.map((url) => {
                const lower = url.toLowerCase();
                const isHls = lower.includes('.m3u8');
                const isDash = lower.includes('.mpd');
                const isMp4 = lower.includes('.mp4');
                const isWebm = lower.includes('.webm');
                const isAudio = lower.includes('.mp3') || lower.includes('.m4a');
                const isGoogleVideo = lower.includes('googlevideo.com') && lower.includes('videoplayback');
                let mimeType = isHls ? 'application/x-mpegURL' : isDash ? 'application/dash+xml' : isMp4 ? 'video/mp4' : isWebm ? 'video/webm' : isAudio ? 'audio/mp4' : '';
                let normalizedUrl = url;
                let googleVideoDirect = false;
                let googleVideoSegment = false;
                if (isGoogleVideo) {
                  try {
                    const parsed = new URL(url, window.location.href);
                    const mimeParam = decodeURIComponent(parsed.searchParams.get('mime') || '').toLowerCase();
                    const mimeFromType = (parsed.searchParams.get('mime') || '').toLowerCase();
                    const explicitMime = mimeParam || mimeFromType;
                    const sourceParam = (parsed.searchParams.get('source') || '').toLowerCase();
                    const hasCipherSignature =
                      parsed.searchParams.has('sig') ||
                      parsed.searchParams.has('signature') ||
                      parsed.searchParams.has('lsig');
                    const hasSegmentMarkers =
                      parsed.searchParams.has('sq') ||
                      parsed.searchParams.has('range') ||
                      sourceParam === 'yt_otf';
                    const hasDirectPlaybackMarkers =
                      parsed.searchParams.has('id') &&
                      parsed.searchParams.has('expire') &&
                      (parsed.searchParams.has('sig') || parsed.searchParams.has('signature')) &&
                      parsed.searchParams.has('lsig') &&
                      (
                        sourceParam === 'youtube' ||
                        sourceParam === 'yt_live_broadcast' ||
                        sourceParam === 'yt_premiere_broadcast'
                      );
                    if (!mimeType && mimeParam) {
                      mimeType = mimeParam;
                    }
                    const inferredMime =
                      mimeType ||
                      (parsed.searchParams.get('itag')
                        ? (
                          ['18','22','59'].includes(parsed.searchParams.get('itag')) ? 'video/mp4' :
                          ['43','44','45','46'].includes(parsed.searchParams.get('itag')) ? 'video/webm' :
                          ['140','141','139'].includes(parsed.searchParams.get('itag')) ? 'audio/mp4' :
                          ['171','172','249','250','251'].includes(parsed.searchParams.get('itag')) ? 'audio/webm' :
                          ''
                        )
                        : '');
                    if (
                      hasCipherSignature &&
                      !hasSegmentMarkers &&
                      (
                        explicitMime.startsWith('video/mp4') ||
                        explicitMime.startsWith('video/webm') ||
                        explicitMime.startsWith('audio/mp4') ||
                        explicitMime.startsWith('audio/webm') ||
                        inferredMime.startsWith('video/mp4') ||
                        inferredMime.startsWith('video/webm') ||
                        inferredMime.startsWith('audio/mp4') ||
                        inferredMime.startsWith('audio/webm') ||
                        parsed.searchParams.has('clen') ||
                        hasDirectPlaybackMarkers
                      )
                    ) {
                      googleVideoDirect = true;
                      if (!mimeType && inferredMime) {
                        mimeType = inferredMime;
                      }
                      if (!mimeType && hasDirectPlaybackMarkers) {
                        mimeType = 'video/mp4';
                      }
                      normalizedUrl = parsed.toString();
                    } else {
                      googleVideoSegment = true;
                    }
                  } catch (error) {
                    googleVideoSegment = true;
                  }
                }
                const supported = isHls || isMp4 || isWebm || isAudio || googleVideoDirect;
                return {
                  url: normalizedUrl,
                  kind: isHls
                    ? 'hls'
                    : isDash
                      ? 'dash'
                      : isMp4
                        ? 'mp4'
                        : isWebm
                          ? 'webm'
                          : isAudio
                            ? 'audio'
                            : googleVideoDirect
                              ? 'googlevideo-direct'
                              : googleVideoSegment
                                ? 'segment'
                                : 'unknown',
                  supported,
                  mimeType
                };
              });
              const selectedCandidate =
                resourceCandidates.find((candidate) => candidate.kind === 'hls') ||
                resourceCandidates.find((candidate) => candidate.kind === 'mp4') ||
                resourceCandidates.find((candidate) => candidate.kind === 'webm') ||
                resourceCandidates.find((candidate) => candidate.kind === 'audio') ||
                resourceCandidates.find((candidate) => candidate.kind === 'googlevideo-direct') ||
                null;
              const videoState = videos.slice(0, 2).map((video, index) => ({
                index,
                currentSrc: video.currentSrc || '',
                src: video.src || '',
                readyState: video.readyState,
                networkState: video.networkState,
                bufferedRanges: video.buffered ? video.buffered.length : 0,
                duration: Number.isFinite(video.duration) ? video.duration : null
              }));
              return JSON.stringify({
                mediaSourcePresent: typeof window.MediaSource !== 'undefined',
                sourceBuffersObservable: false,
                blobCount: videos.filter((video) => /^blob:/i.test(video.currentSrc || video.src || '')).length,
                resourceCandidateCount: resourceCandidates.length,
                hlsCount: resourceCandidates.filter((candidate) => candidate.kind === 'hls').length,
                mp4Count: resourceCandidates.filter((candidate) => candidate.kind === 'mp4').length,
                webmCount: resourceCandidates.filter((candidate) => candidate.kind === 'webm').length,
                audioCount: resourceCandidates.filter((candidate) => candidate.kind === 'audio').length,
                dashCount: resourceCandidates.filter((candidate) => candidate.kind === 'dash').length,
                googleVideoDirectCount: resourceCandidates.filter((candidate) => candidate.kind === 'googlevideo-direct').length,
                segmentCount: resourceCandidates.filter((candidate) => candidate.kind === 'segment').length,
                selectedCandidate,
                resourceSample: resourceCandidates.slice(0, 6).map((candidate) => candidate.url),
                videoState
              });
            })();
            """.trimIndent()
    }
}
