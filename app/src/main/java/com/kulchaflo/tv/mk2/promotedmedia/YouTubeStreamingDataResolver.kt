package com.kulchaflo.tv.mk2.promotedmedia

import com.kulchaflo.tv.mk2.util.Logger
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.zip.GZIPInputStream
import kotlin.concurrent.thread
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import kotlin.text.RegexOption.DOT_MATCHES_ALL

class YouTubeStreamingDataResolver {
    private val htmlFallbackLock = Any()
    private val inFlightHtmlFallbacks =
        mutableMapOf<String, MutableList<(PromotedMediaSiteAdapter.SourceResult) -> Unit>>()
    private val signatureOpCache = mutableMapOf<String, List<SignatureOp>?>()

    fun resolve(
        session: PromotedMediaSession,
        context: PromotedMediaSiteAdapter.ResolutionContext,
        callback: (PromotedMediaSiteAdapter.SourceResult) -> Unit,
    ) {
        Logger.i(TAG, "source resolution attempt resolver=youtube-streaming-data pageKind=${session.pageKind} url=${session.pageUrl}")
        context.evaluateJavascript(YOUTUBE_STREAMING_DATA_SCRIPT) { rawResult ->
            val payload = decodeJavascriptString(rawResult)
            if (payload.isNullOrBlank()) {
                callback(
                    PromotedMediaSiteAdapter.SourceResult(
                        source = null,
                        reason = "youtube-streaming-data-empty-result",
                    ),
                )
                return@evaluateJavascript
            }

            val parsed = runCatching {
                val snapshot = parseSnapshot(JSONObject(payload), session)
                Logger.i(
                    TAG,
                    "blob/MSE detected platform=${session.platformId} pageKind=${session.pageKind} playability=${snapshot.playability} playerResponseAvailable=${snapshot.playerResponseAvailable} playerResponseSource=${snapshot.playerResponseSource} streamingDataAvailable=${snapshot.streamingDataAvailable} hls=${!snapshot.hlsManifestUrl.isNullOrBlank()} dash=${!snapshot.dashManifestUrl.isNullOrBlank()} directMuxed=${!snapshot.directFormatUrl.isNullOrBlank()} adaptiveDirectVideo=${!snapshot.adaptiveDirectVideoUrl.isNullOrBlank()} adaptiveDirectAudio=${!snapshot.adaptiveDirectAudioUrl.isNullOrBlank()} cipheredMuxed=${snapshot.cipheredMuxedCount} cipheredVideo=${snapshot.cipheredAdaptiveVideoCount} cipheredAudio=${snapshot.cipheredAdaptiveAudioCount} formatCount=${snapshot.formatCount} adaptiveFormatCount=${snapshot.adaptiveFormatCount}"
                )
                val sourceResult = buildNormalizedSelection(
                    snapshot = snapshot,
                    session = session,
                    referer = context.pageUrl?.takeIf { it.isNotBlank() },
                    userAgent = context.userAgent?.takeIf { it.isNotBlank() },
                    pageCookies = context.cookiesFor(session.pageUrl).orEmpty().ifBlank { null },
                    selectedUrlCookiesProvider = { url -> context.cookiesFor(url) },
                ).toYouTubeSourceResult(snapshot)
                snapshot to sourceResult
            }.getOrElse { throwable ->
                callback(
                    PromotedMediaSiteAdapter.SourceResult(
                        source = null,
                        reason = "youtube-streaming-data-parse-failed:${throwable.javaClass.simpleName}",
                    ),
                )
                return@evaluateJavascript
            }
            val (snapshot, immediateResult) = parsed
            val shouldFallbackForMissingPlayerResponse =
                snapshot.playerResponseSource == "none" && !snapshot.playerResponseAvailable
            val shouldFallbackForCipheredMuxedOnly =
                immediateResult.source == null &&
                    snapshot.hlsManifestUrl.isNullOrBlank() &&
                    snapshot.dashManifestUrl.isNullOrBlank() &&
                    snapshot.directFormatUrl.isNullOrBlank() &&
                    snapshot.cipheredMuxedCount > 0 &&
                    !snapshot.cipheredMuxedCipher.isNullOrBlank()
            if (shouldFallbackForMissingPlayerResponse || shouldFallbackForCipheredMuxedOnly) {
                Logger.i(
                    TAG,
                    "youtube extraction stage=watch-html requested reason=${if (shouldFallbackForMissingPlayerResponse) "missing-player-response" else "ciphered-muxed-only"} playerResponseSource=${snapshot.playerResponseSource} playerResponseAvailable=${snapshot.playerResponseAvailable} directMuxed=${!snapshot.directFormatUrl.isNullOrBlank()} cipheredMuxedCount=${snapshot.cipheredMuxedCount} url=${session.pageUrl}"
                )
                resolveWithHtmlFallback(session, context, callback)
                return@evaluateJavascript
            }
            callback(immediateResult)
        }
    }

    private fun resolveWithHtmlFallback(
        session: PromotedMediaSession,
        context: PromotedMediaSiteAdapter.ResolutionContext,
        callback: (PromotedMediaSiteAdapter.SourceResult) -> Unit,
    ) {
        val queueFallback = synchronized(htmlFallbackLock) {
            val existing = inFlightHtmlFallbacks[session.pageUrl]
            if (existing != null) {
                existing += callback
                Logger.i(TAG, "youtube html fallback joined existing request url=${session.pageUrl} waiters=${existing.size}")
                false
            } else {
                inFlightHtmlFallbacks[session.pageUrl] = mutableListOf(callback)
                true
            }
        }
        if (!queueFallback) return
        Logger.i(TAG, "youtube extraction stage=watch-html attempted url=${session.pageUrl}")
        val pageUrl = session.pageUrl
        val referer = context.pageUrl?.takeIf { it.isNotBlank() }
        val userAgent = context.userAgent?.takeIf { it.isNotBlank() }
        val pageCookies = context.cookiesFor(pageUrl)?.takeIf { it.isNotBlank() }
        thread(name = "kf-youtube-html-fallback", isDaemon = true) {
            val result = runCatching {
                val connection = (URL(pageUrl).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    instanceFollowRedirects = true
                    connectTimeout = 8000
                    readTimeout = 8000
                    setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    setRequestProperty("Accept-Language", "en-GB,en-US;q=0.9,en;q=0.8")
                    setRequestProperty("Accept-Encoding", "gzip")
                    userAgent?.let { setRequestProperty("User-Agent", it) }
                    referer?.let { setRequestProperty("Referer", it) }
                    pageCookies?.let { setRequestProperty("Cookie", it) }
                }
                val responseCode = connection.responseCode
                val contentEncoding = connection.contentEncoding.orEmpty()
                val inputStream = when {
                    responseCode in 200..299 -> connection.inputStream
                    else -> connection.errorStream ?: throw RuntimeException("http-$responseCode")
                }
                val decodedStream = if (contentEncoding.contains("gzip", ignoreCase = true)) {
                    GZIPInputStream(inputStream)
                } else {
                    inputStream
                }
                decodedStream.bufferedReader().use { it.readText() }.also {
                    Logger.i(
                        TAG,
                        "youtube extraction stage=watch-html fetched responseCode=$responseCode contentEncoding=${contentEncoding.ifBlank { "identity" }} htmlLength=${it.length} url=${session.pageUrl}"
                    )
                    connection.disconnect()
                }
            }.mapCatching { html ->
                val playerResponseText = extractHtmlPlayerResponse(html)
                if (playerResponseText.isNullOrBlank()) {
                    Logger.i(TAG, "youtube extraction stage=watch-html missing playerResponseSource=watch-html:none url=${session.pageUrl}")
                    PromotedMediaSiteAdapter.SourceResult(
                        source = null,
                        reason = "youtube-streaming-data-no-playable-url playability=unknown playerResponseAvailable=false playerResponseSource=watch-html:none streamingDataAvailable=false missingFields=playerResponse,streamingData,hlsManifestUrl,dashManifestUrl,directFormatUrl directMuxedCount=0 adaptiveDirectVideoCount=0 adaptiveDirectAudioCount=0",
                    )
                } else {
                    val snapshot = parseSnapshot(JSONObject(playerResponseText), session, "watch-html")
                    Logger.i(
                        TAG,
                        "youtube extraction stage=watch-html playerResponseSource=${snapshot.playerResponseSource} streamingDataAvailable=${snapshot.streamingDataAvailable} url=${session.pageUrl}"
                    )
                    val decipheredResult =
                        if (
                            snapshot.hlsManifestUrl.isNullOrBlank() &&
                            snapshot.dashManifestUrl.isNullOrBlank() &&
                            snapshot.directFormatUrl.isNullOrBlank() &&
                            !snapshot.cipheredMuxedCipher.isNullOrBlank()
                        ) {
                            attemptCipheredMuxedResolution(
                                html = html,
                                snapshot = snapshot,
                                session = session,
                                referer = referer,
                                userAgent = userAgent,
                                pageCookies = pageCookies,
                            )
                        } else {
                            null
                        }
                    if (decipheredResult != null) {
                        Logger.i(
                            TAG,
                            "youtube extraction stage=watch-html outcome=decipher-resolved sourceKind=${decipheredResult.source?.kind ?: "none"} reason=${decipheredResult.reason} url=${session.pageUrl}"
                        )
                        decipheredResult
                    } else {
                        buildNormalizedSelection(
                            snapshot = snapshot,
                            session = session,
                            referer = referer,
                            userAgent = userAgent,
                            pageCookies = pageCookies,
                            selectedUrlCookiesProvider = { _ -> null },
                        ).toYouTubeSourceResult(snapshot).also { stageResult ->
                            Logger.i(
                                TAG,
                                "youtube extraction stage=watch-html outcome=normalized-return sourceKind=${stageResult.source?.kind ?: "none"} reason=${stageResult.reason} url=${session.pageUrl}"
                            )
                        }
                    }
                }
            }.getOrElse { throwable ->
                Logger.w(
                    TAG,
                    "youtube extraction stage=watch-html failed class=${throwable.javaClass.simpleName} message=${throwable.message ?: "none"} url=${session.pageUrl}"
                )
                PromotedMediaSiteAdapter.SourceResult(
                    source = null,
                    reason = "youtube-streaming-data-html-fallback-failed:${throwable.javaClass.simpleName}:${throwable.message ?: "none"}",
                )
            }
            Handler(Looper.getMainLooper()).post {
                val callbacks = synchronized(htmlFallbackLock) {
                    inFlightHtmlFallbacks.remove(session.pageUrl).orEmpty()
                }
                Logger.i(
                    TAG,
                    "youtube extraction stage=watch-html callback-dispatch waiters=${callbacks.size} sourceKind=${result.source?.kind ?: "none"} reason=${result.reason} url=${session.pageUrl}"
                )
                callbacks.forEach { it(result) }
            }
        }
    }

    private fun buildNormalizedSelection(
        snapshot: YouTubeStreamingSnapshot,
        session: PromotedMediaSession,
        referer: String?,
        userAgent: String?,
        pageCookies: String?,
        selectedUrlCookiesProvider: (String) -> String?,
    ): NormalizedMediaSelection {
        val selectedUrl = snapshot.hlsManifestUrl ?: snapshot.dashManifestUrl ?: snapshot.directFormatUrl
        val selectedMimeType = when {
            !snapshot.hlsManifestUrl.isNullOrBlank() -> "application/x-mpegURL"
            !snapshot.dashManifestUrl.isNullOrBlank() -> "application/dash+xml"
            else -> snapshot.directMimeType
        }
        val selectedKind = when {
            !snapshot.hlsManifestUrl.isNullOrBlank() -> "hls-manifest"
            !snapshot.dashManifestUrl.isNullOrBlank() -> "dash-manifest"
            !snapshot.directFormatUrl.isNullOrBlank() -> "muxed-direct-format"
            else -> "none"
        }
        if (!selectedUrl.isNullOrBlank()) {
            val selectedUrlCookies = selectedUrlCookiesProvider(selectedUrl)?.takeIf { it.isNotBlank() }
            val originHeader = runCatching {
                val url = URL(referer ?: session.pageUrl)
                "${url.protocol}://${url.host}"
            }.getOrNull()
            val headers = buildMap {
                referer?.let { put("Referer", it) }
                originHeader?.let { put("Origin", it) }
                userAgent?.let { put("User-Agent", it) }
                (selectedUrlCookies ?: pageCookies)?.let { put("Cookie", it) }
            }
            return NormalizedMediaSelection.Playable(
                sourceId = "youtube-streaming-data",
                uri = selectedUrl,
                mimeType = selectedMimeType,
                selectedKind = selectedKind,
                headers = headers,
            )
        }
        val missingFields = buildList {
            if (!snapshot.playerResponseAvailable) add("playerResponse")
            if (!snapshot.streamingDataAvailable) add("streamingData")
            if (snapshot.hlsManifestUrl.isNullOrBlank()) add("hlsManifestUrl")
            if (snapshot.dashManifestUrl.isNullOrBlank()) add("dashManifestUrl")
            if (snapshot.directFormatUrl.isNullOrBlank()) add("directFormatUrl")
        }.joinToString(separator = ",").ifBlank { "none" }
        Logger.i(
            TAG,
            "youtube extraction missing field=$missingFields playerResponseSource=${snapshot.playerResponseSource} pageKind=${session.pageKind} url=${session.pageUrl}"
        )
        val reason = if (!snapshot.adaptiveDirectVideoUrl.isNullOrBlank() && !snapshot.adaptiveDirectAudioUrl.isNullOrBlank()) {
            "playability=${snapshot.playability} playerResponseAvailable=${snapshot.playerResponseAvailable} playerResponseSource=${snapshot.playerResponseSource} streamingDataAvailable=${snapshot.streamingDataAvailable} missingFields=$missingFields dash=${!snapshot.dashManifestUrl.isNullOrBlank()} adaptiveVideo=${!snapshot.adaptiveDirectVideoUrl.isNullOrBlank()} adaptiveAudio=${!snapshot.adaptiveDirectAudioUrl.isNullOrBlank()} directMuxedCount=${snapshot.directMuxedCount} adaptiveDirectVideoCount=${snapshot.adaptiveDirectVideoCount} adaptiveDirectAudioCount=${snapshot.adaptiveDirectAudioCount} adaptiveVideoMime=${snapshot.adaptiveDirectVideoMimeType ?: "unknown"} adaptiveAudioMime=${snapshot.adaptiveDirectAudioMimeType ?: "unknown"}"
        } else if (snapshot.cipheredMuxedCount > 0 || snapshot.cipheredAdaptiveVideoCount > 0 || snapshot.cipheredAdaptiveAudioCount > 0) {
            "playability=${snapshot.playability} playerResponseAvailable=${snapshot.playerResponseAvailable} playerResponseSource=${snapshot.playerResponseSource} streamingDataAvailable=${snapshot.streamingDataAvailable} missingFields=$missingFields cipheredMuxedCount=${snapshot.cipheredMuxedCount} cipheredAdaptiveVideoCount=${snapshot.cipheredAdaptiveVideoCount} cipheredAdaptiveAudioCount=${snapshot.cipheredAdaptiveAudioCount}"
        } else {
            "playability=${snapshot.playability} playerResponseAvailable=${snapshot.playerResponseAvailable} playerResponseSource=${snapshot.playerResponseSource} streamingDataAvailable=${snapshot.streamingDataAvailable} missingFields=$missingFields directMuxedCount=${snapshot.directMuxedCount} adaptiveDirectVideoCount=${snapshot.adaptiveDirectVideoCount} adaptiveDirectAudioCount=${snapshot.adaptiveDirectAudioCount}"
        }
        return if (!snapshot.adaptiveDirectVideoUrl.isNullOrBlank() && !snapshot.adaptiveDirectAudioUrl.isNullOrBlank()) {
            NormalizedMediaSelection.PlayerLimited(
                kind = "split-adaptive-streams",
                detail = reason,
            )
        } else if (snapshot.cipheredMuxedCount > 0 || snapshot.cipheredAdaptiveVideoCount > 0 || snapshot.cipheredAdaptiveAudioCount > 0) {
            NormalizedMediaSelection.PlayerLimited(
                kind = "ciphered-streams",
                detail = reason,
            )
        } else {
            NormalizedMediaSelection.NoPlayableSource(
                detail = reason,
            )
        }
    }

    private fun attemptCipheredMuxedResolution(
        html: String,
        snapshot: YouTubeStreamingSnapshot,
        session: PromotedMediaSession,
        referer: String?,
        userAgent: String?,
        pageCookies: String?,
    ): PromotedMediaSiteAdapter.SourceResult? {
        Logger.i(
            TAG,
            "youtube cipher decipher attempted playerResponseSource=${snapshot.playerResponseSource} pageKind=${session.pageKind} url=${session.pageUrl}"
        )
        val playerScriptUrl = extractPlayerScriptUrl(html, session.pageUrl)
        if (playerScriptUrl.isNullOrBlank()) {
            Logger.i(TAG, "youtube cipher decipher failed reason=no-player-script-url url=${session.pageUrl}")
            return null
        }
        Logger.i(
            TAG,
            "youtube cipher decipher stage=player-script-fetch-start playerScriptUrl=$playerScriptUrl"
        )
        val playerScript = fetchText(
            url = playerScriptUrl,
            referer = referer,
            userAgent = userAgent,
            cookies = pageCookies,
        ) ?: run {
            Logger.i(TAG, "youtube cipher decipher failed reason=player-script-fetch-null playerScriptUrl=$playerScriptUrl")
            return null
        }
        Logger.i(
            TAG,
            "youtube cipher decipher stage=player-script-fetch-complete playerScriptUrl=$playerScriptUrl scriptLength=${playerScript.length}"
        )
        Logger.i(
            TAG,
            "youtube cipher decipher stage=signature-parse-start playerScriptUrl=$playerScriptUrl"
        )
        val operations = synchronized(signatureOpCache) {
            if (signatureOpCache.containsKey(playerScriptUrl)) {
                signatureOpCache[playerScriptUrl]
            } else {
                extractSignatureOperations(playerScript).also { signatureOpCache[playerScriptUrl] = it }
            }
        }
        Logger.i(
            TAG,
            "youtube cipher decipher stage=signature-parse-complete playerScriptUrl=$playerScriptUrl parsed=${operations != null}"
        )
        if (operations.isNullOrEmpty()) {
            Logger.i(TAG, "youtube cipher decipher failed reason=no-signature-operations playerScriptUrl=$playerScriptUrl")
            return null
        }
        Logger.i(
            TAG,
            "youtube cipher decipher operations-count=${operations.size} playerScriptUrl=$playerScriptUrl"
        )
        val resolvedCipher = resolveCipherUrlWithDecipher(snapshot.cipheredMuxedCipher, operations)
        if (resolvedCipher == null) {
            Logger.i(TAG, "youtube cipher decipher failed reason=decipher-unresolved playerScriptUrl=$playerScriptUrl")
            return null
        }
        val originHeader = runCatching {
            val url = URL(referer ?: session.pageUrl)
            "${url.protocol}://${url.host}"
        }.getOrNull()
        val headers = buildMap {
            referer?.let { put("Referer", it) }
            originHeader?.let { put("Origin", it) }
            userAgent?.let { put("User-Agent", it) }
            pageCookies?.let { put("Cookie", it) }
        }
        Logger.i(
            TAG,
            "youtube cipher decipher resolved playerScriptUrl=$playerScriptUrl mimeType=${resolvedCipher.mimeType ?: "unknown"} url=${session.pageUrl}"
        )
        return NormalizedMediaSelection.Playable(
            sourceId = "youtube-streaming-data",
            uri = resolvedCipher.url,
            mimeType = resolvedCipher.mimeType,
            selectedKind = "muxed-direct-format-deciphered",
            headers = headers,
        ).toYouTubeSourceResult(snapshot)
    }

    private fun NormalizedMediaSelection.toYouTubeSourceResult(
        snapshot: YouTubeStreamingSnapshot,
    ): PromotedMediaSiteAdapter.SourceResult {
        return when (this) {
            is NormalizedMediaSelection.Playable -> this.toSourceResult().copy(
                reason = "youtube-streaming-data-resolved selectedKind=$selectedKind playability=${snapshot.playability} playerResponseAvailable=${snapshot.playerResponseAvailable} playerResponseSource=${snapshot.playerResponseSource} streamingDataAvailable=${snapshot.streamingDataAvailable} title=${snapshot.title.ifBlank { "unknown" }} mimeType=${mimeType ?: "unknown"} directMuxedCount=${snapshot.directMuxedCount} adaptiveDirectVideoCount=${snapshot.adaptiveDirectVideoCount} adaptiveDirectAudioCount=${snapshot.adaptiveDirectAudioCount}",
            )

            is NormalizedMediaSelection.PlayerLimited -> PromotedMediaSiteAdapter.SourceResult(
                source = null,
                reason = "youtube-streaming-data-player-limited kind=$kind $detail",
            )

            is NormalizedMediaSelection.NoPlayableSource -> PromotedMediaSiteAdapter.SourceResult(
                source = null,
                reason = "youtube-streaming-data-no-playable-url $detail",
            )
        }
    }

    private fun fetchText(
        url: String,
        referer: String?,
        userAgent: String?,
        cookies: String?,
    ): String? {
        return runCatching {
            val connection = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                instanceFollowRedirects = true
                connectTimeout = 8000
                readTimeout = 8000
                setRequestProperty("Accept", "*/*")
                setRequestProperty("Accept-Language", "en-GB,en-US;q=0.9,en;q=0.8")
                setRequestProperty("Accept-Encoding", "gzip")
                userAgent?.let { setRequestProperty("User-Agent", it) }
                referer?.let { setRequestProperty("Referer", it) }
                cookies?.let { setRequestProperty("Cookie", it) }
            }
            val responseCode = connection.responseCode
            val contentEncoding = connection.contentEncoding.orEmpty()
            val inputStream = when {
                responseCode in 200..299 -> connection.inputStream
                else -> connection.errorStream ?: throw RuntimeException("http-$responseCode")
            }
            val decodedStream = if (contentEncoding.contains("gzip", ignoreCase = true)) {
                GZIPInputStream(inputStream)
            } else {
                inputStream
            }
            decodedStream.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }.also {
                connection.disconnect()
            }
        }.getOrNull()
    }

    private fun extractPlayerScriptUrl(html: String, pageUrl: String): String? {
        val patterns = listOf(
            Regex("""["']jsUrl["']\s*:\s*["']([^"']+)["']"""),
            Regex("""["']PLAYER_JS_URL["']\s*:\s*["']([^"']+)["']"""),
            Regex("""<script\s+src=["']([^"']*?/s/player/[^"']+?/base\.js)["']"""),
        )
        val raw = patterns.firstNotNullOfOrNull { regex ->
            regex.find(html)?.groupValues?.getOrNull(1)
        } ?: return null
        val cleaned = raw
            .replace("\\/", "/")
            .replace("\\u0026", "&")
            .replace("\\u003d", "=")
        return when {
            cleaned.startsWith("http://") || cleaned.startsWith("https://") -> cleaned
            cleaned.startsWith("//") -> "https:$cleaned"
            cleaned.startsWith("/") -> runCatching {
                val page = URL(pageUrl)
                "${page.protocol}://${page.host}$cleaned"
            }.getOrDefault("https://www.youtube.com$cleaned")
            else -> "https://www.youtube.com/$cleaned"
        }
    }

    private fun extractSignatureOperations(playerScript: String): List<SignatureOp>? {
        findCandidateSignatureFunctions(playerScript).forEach { candidate ->
            extractOperationsFromFunctionBody(
                playerScript = playerScript,
                body = candidate.body,
                argName = candidate.argName,
            )?.let { return it }
        }
        return null
    }

    private fun findCandidateSignatureFunctions(playerScript: String): List<SignatureFunctionCandidate> {
        val candidates = mutableListOf<SignatureFunctionCandidate>()
        var searchIndex = 0
        var inspected = 0
        while (searchIndex >= 0 && inspected < 24) {
            val splitIndex = playerScript.indexOf(".split(", startIndex = searchIndex)
            if (splitIndex < 0) break
            searchIndex = splitIndex + 7
            inspected += 1
            val assignmentStart = playerScript.lastIndexOf("=", startIndex = splitIndex)
            val functionIndex = playerScript.lastIndexOf("function(", startIndex = splitIndex)
            val namedFunctionIndex = playerScript.lastIndexOf("function ", startIndex = splitIndex)
            val startIndex = maxOf(assignmentStart, functionIndex, namedFunctionIndex)
            if (startIndex < 0 || splitIndex - startIndex > 240) continue
            val bodyStart = playerScript.indexOf('{', startIndex)
            if (bodyStart < 0 || bodyStart > splitIndex) continue
            val bodyEnd = findMatchingBrace(playerScript, bodyStart) ?: continue
            if (bodyEnd <= bodyStart) continue
            val body = playerScript.substring(bodyStart + 1, bodyEnd)
            val argName =
                extractFunctionArg(playerScript.substring(startIndex, minOf(bodyStart + 1, playerScript.length)))
                    ?: continue
            if (!body.contains("$argName=$argName.split(") || !body.contains("return $argName.join(")) continue
            candidates += SignatureFunctionCandidate(argName = argName, body = body)
        }
        return candidates
    }

    private fun extractOperationsFromFunctionBody(
        playerScript: String,
        body: String,
        argName: String,
    ): List<SignatureOp>? {
        val directOps = extractDirectOperations(body, argName)
        if (!directOps.isNullOrEmpty()) {
            return directOps
        }
        val objectName =
            Regex("""([$\w]+)\.([$\w]+)\($argName(?:,(\d+))?\)""")
                .find(body)
                ?.groupValues
                ?.getOrNull(1)
                ?: Regex("""([$\w]+)\[\s*["']([$\w]+)["']\s*]\($argName(?:,(\d+))?\)""")
                    .find(body)
                    ?.groupValues
                    ?.getOrNull(1)
                ?: return null
        val objectBody = extractObjectBody(playerScript, objectName) ?: return null
        val opMap = mutableMapOf<String, SignatureTransform>()
        Regex("""["']?([$\w]+)["']?\s*:\s*function\([^\)]*\)\s*\{(.*?)\}""", setOf(DOT_MATCHES_ALL))
            .findAll(objectBody)
            .forEach { methodMatch ->
                val methodName = methodMatch.groupValues[1]
                val methodBody = methodMatch.groupValues[2]
                detectTransform(methodBody)?.let { opMap[methodName] = it }
            }
        if (opMap.isEmpty()) return null
        val operations = mutableListOf<SignatureOp>()
        Regex("""${Regex.escape(objectName)}\.([$\w]+)\($argName(?:,(\d+))?\)""")
            .findAll(body)
            .forEach { callMatch ->
                val methodName = callMatch.groupValues[1]
                val amount = callMatch.groupValues.getOrNull(2)?.toIntOrNull() ?: 0
                val transform = opMap[methodName] ?: return@forEach
                operations += SignatureOp(transform, amount)
            }
        Regex("""${Regex.escape(objectName)}\[\s*["']([$\w]+)["']\s*]\($argName(?:,(\d+))?\)""")
            .findAll(body)
            .forEach { callMatch ->
                val methodName = callMatch.groupValues[1]
                val amount = callMatch.groupValues.getOrNull(2)?.toIntOrNull() ?: 0
                val transform = opMap[methodName] ?: return@forEach
                operations += SignatureOp(transform, amount)
        }
        return operations.ifEmpty { null }
    }

    private fun extractObjectBody(playerScript: String, objectName: String): String? {
        val markers = listOf("$objectName={", "var $objectName={", "const $objectName={", "let $objectName={")
        val markerIndex = markers.firstNotNullOfOrNull { marker ->
            playerScript.indexOf(marker).takeIf { it >= 0 }?.let { it + marker.length - 1 }
        } ?: return null
        val bodyEnd = findMatchingBrace(playerScript, markerIndex) ?: return null
        return playerScript.substring(markerIndex + 1, bodyEnd)
    }

    private fun findMatchingBrace(text: String, openBraceIndex: Int): Int? {
        var depth = 0
        var inString = false
        var quote = '\u0000'
        var escaped = false
        for (i in openBraceIndex until text.length) {
            val ch = text[i]
            if (inString) {
                if (escaped) {
                    escaped = false
                } else if (ch == '\\') {
                    escaped = true
                } else if (ch == quote) {
                    inString = false
                    quote = '\u0000'
                }
                continue
            }
            if (ch == '"' || ch == '\'') {
                inString = true
                quote = ch
                continue
            }
            if (ch == '{') {
                depth += 1
            } else if (ch == '}') {
                depth -= 1
                if (depth == 0) return i
            }
        }
        return null
    }

    private fun extractFunctionArg(header: String): String? {
        val start = header.lastIndexOf('(')
        val end = header.indexOf(')', startIndex = start + 1)
        if (start < 0 || end <= start) return null
        return header.substring(start + 1, end).split(',').firstOrNull()?.trim()?.takeIf { it.isNotBlank() }
    }

    private fun extractDirectOperations(body: String, argName: String): List<SignatureOp>? {
        val operations = mutableListOf<SignatureOp>()
        Regex("""$argName\.reverse\([^)]*\)""")
            .findAll(body)
            .forEach { operations += SignatureOp(SignatureTransform.REVERSE, 0) }
        Regex("""$argName\.splice\(0,(\d+)\)""")
            .findAll(body)
            .forEach { match ->
                operations += SignatureOp(SignatureTransform.SPLICE, match.groupValues[1].toIntOrNull() ?: 0)
            }
        Regex("""var\s+([$\w]+)\s*=\s*$argName\[0];\s*$argName\[0]\s*=\s*$argName\[([$\w]+)\s*%\s*$argName\.length];\s*$argName\[\2]\s*=\s*\1""")
            .findAll(body)
            .forEach { operations += SignatureOp(SignatureTransform.SWAP, 0) }
        return operations.ifEmpty { null }
    }

    private fun detectTransform(methodBody: String): SignatureTransform? {
        return when {
            methodBody.contains(".reverse(") -> SignatureTransform.REVERSE
            methodBody.contains(".splice(0,") -> SignatureTransform.SPLICE
            methodBody.contains("[0]") && methodBody.contains("%") && methodBody.contains(".length") && methodBody.contains("=") -> SignatureTransform.SWAP
            else -> null
        }
    }

    private fun resolveCipherUrlWithDecipher(cipher: String?, operations: List<SignatureOp>): CipherResolution? {
        val rawCipher = cipher.orEmpty().ifBlank { return null }
        val params = rawCipher
            .split("&")
            .mapNotNull { part ->
                val idx = part.indexOf('=')
                if (idx <= 0) return@mapNotNull null
                val key = part.substring(0, idx)
                val value = part.substring(idx + 1)
                key to runCatching { URLDecoder.decode(value, "UTF-8") }.getOrDefault(value)
            }
            .toMap()
        val baseUrl = params["url"]?.takeIf { it.startsWith("http", ignoreCase = true) } ?: return null
        val signatureParam = params["sp"].orEmpty().ifBlank { "signature" }
        val resolvedSignature = when {
            !params["sig"].isNullOrBlank() -> params["sig"].orEmpty()
            !params["signature"].isNullOrBlank() -> params["signature"].orEmpty()
            !params["s"].isNullOrBlank() -> decipherSignature(params["s"].orEmpty(), operations)
            else -> ""
        }.ifBlank { return null }
        val resolvedUrl = appendQueryParam(baseUrl, signatureParam, resolvedSignature)
        return CipherResolution(
            url = resolvedUrl,
            mimeType = null,
        )
    }

    private fun decipherSignature(signature: String, operations: List<SignatureOp>): String {
        val chars = signature.toMutableList()
        operations.forEach { op ->
            when (op.transform) {
                SignatureTransform.REVERSE -> chars.reverse()
                SignatureTransform.SPLICE -> {
                    repeat(op.argument.coerceAtMost(chars.size)) {
                        if (chars.isNotEmpty()) chars.removeAt(0)
                    }
                }
                SignatureTransform.SWAP -> {
                    if (chars.isNotEmpty()) {
                        val idx = op.argument % chars.size
                        val first = chars[0]
                        chars[0] = chars[idx]
                        chars[idx] = first
                    }
                }
            }
        }
        return chars.joinToString(separator = "")
    }

    private fun parseSnapshot(
        json: JSONObject,
        session: PromotedMediaSession,
        sourceOverride: String? = null,
    ): YouTubeStreamingSnapshot {
        val looksLikeFlattenedPayload =
            json.has("playerResponseAvailable") ||
                json.has("streamingDataAvailable") ||
                json.has("directFormatUrl") ||
                json.has("hlsManifestUrl") ||
                json.has("dashManifestUrl")
        val playerResponse = if (looksLikeFlattenedPayload) json else json
        val streamingData = if (looksLikeFlattenedPayload) {
            json.optJSONObject("streamingData")
        } else {
            playerResponse.optJSONObject("streamingData")
        }
        val formats = mutableListOf<JSONObject>()
        val adaptiveFormats = mutableListOf<JSONObject>()
        val formatArray = streamingData?.optJSONArray("formats")
        val adaptiveArray = streamingData?.optJSONArray("adaptiveFormats")
        for (i in 0 until (formatArray?.length() ?: 0)) {
            formatArray?.optJSONObject(i)?.let { formats += it }
        }
        for (i in 0 until (adaptiveArray?.length() ?: 0)) {
            adaptiveArray?.optJSONObject(i)?.let { adaptiveFormats += it }
        }
        val muxed = formats.firstOrNull { format ->
            format.optString("url").startsWith("http", ignoreCase = true)
        }
        val signedMuxed = if (muxed == null) {
            formats.firstNotNullOfOrNull { resolveCipherUrl(it) }
        } else {
            null
        }
        val adaptiveVideo = adaptiveFormats.firstOrNull { format ->
            format.optString("url").startsWith("http", ignoreCase = true) &&
                format.optString("mimeType").startsWith("video/", ignoreCase = true)
        }
        val signedAdaptiveVideo = if (adaptiveVideo == null) {
            adaptiveFormats.firstNotNullOfOrNull { format ->
                if (format.optString("mimeType").startsWith("video/", ignoreCase = true)) resolveCipherUrl(format) else null
            }
        } else {
            null
        }
        val adaptiveAudio = adaptiveFormats.firstOrNull { format ->
            format.optString("url").startsWith("http", ignoreCase = true) &&
                format.optString("mimeType").startsWith("audio/", ignoreCase = true)
        }
        val signedAdaptiveAudio = if (adaptiveAudio == null) {
            adaptiveFormats.firstNotNullOfOrNull { format ->
                if (format.optString("mimeType").startsWith("audio/", ignoreCase = true)) resolveCipherUrl(format) else null
            }
        } else {
            null
        }
        val cipheredMuxedCount = formats.count { hasCipherWithoutDirectUrl(it) }
        val cipheredAdaptiveVideoCount = adaptiveFormats.count {
            it.optString("mimeType").startsWith("video/", ignoreCase = true) && hasCipherWithoutDirectUrl(it)
        }
        val cipheredAdaptiveAudioCount = adaptiveFormats.count {
            it.optString("mimeType").startsWith("audio/", ignoreCase = true) && hasCipherWithoutDirectUrl(it)
        }
        val cipheredMuxedFormat = formats.firstOrNull { hasCipherWithoutDirectUrl(it) }
        val cipheredMuxedCipher =
            cipheredMuxedFormat?.optString("signatureCipher")
                .orEmpty()
                .ifBlank { cipheredMuxedFormat?.optString("cipher").orEmpty() }
                .ifBlank { null }
        return YouTubeStreamingSnapshot(
            playability = if (looksLikeFlattenedPayload) {
                json.optString("playabilityStatus").ifBlank { "unknown" }
            } else {
                playerResponse.optJSONObject("playabilityStatus")?.optString("status").orEmpty().ifBlank { "unknown" }
            },
            title = if (looksLikeFlattenedPayload) {
                json.optString("videoTitle").ifBlank { session.mediaTitle.orEmpty() }
            } else {
                playerResponse.optJSONObject("videoDetails")?.optString("title").orEmpty().ifBlank { session.mediaTitle.orEmpty() }
            },
            playerResponseAvailable = if (looksLikeFlattenedPayload) {
                json.optBoolean("playerResponseAvailable", true)
            } else {
                true
            },
            streamingDataAvailable = if (looksLikeFlattenedPayload) {
                json.optBoolean("streamingDataAvailable", streamingData != null)
            } else {
                streamingData != null
            },
            playerResponseSource = sourceOverride?.let { "$it:${json.optString("playerResponseSource").ifBlank { "embedded" }}" }
                ?: json.optString("playerResponseSource").ifBlank { "none" },
            hlsManifestUrl = if (looksLikeFlattenedPayload) {
                json.optString("hlsManifestUrl").takeIf { it.isNotBlank() }
            } else {
                streamingData?.optString("hlsManifestUrl")?.takeIf { it.isNotBlank() }
            },
            dashManifestUrl = if (looksLikeFlattenedPayload) {
                json.optString("dashManifestUrl").takeIf { it.isNotBlank() }
            } else {
                streamingData?.optString("dashManifestUrl")?.takeIf { it.isNotBlank() }
            },
            directFormatUrl = if (looksLikeFlattenedPayload) {
                json.optString("directFormatUrl").takeIf { it.isNotBlank() }
            } else {
                muxed?.optString("url")?.takeIf { it.isNotBlank() } ?: signedMuxed?.url
            },
            directMimeType = if (looksLikeFlattenedPayload) {
                json.optString("directFormatMimeType").takeIf { it.isNotBlank() }
            } else {
                muxed?.optString("mimeType")?.takeIf { it.isNotBlank() } ?: signedMuxed?.mimeType
            },
            adaptiveDirectVideoUrl = if (looksLikeFlattenedPayload) {
                json.optString("adaptiveDirectVideoUrl").takeIf { it.isNotBlank() }
            } else {
                adaptiveVideo?.optString("url")?.takeIf { it.isNotBlank() } ?: signedAdaptiveVideo?.url
            },
            adaptiveDirectVideoMimeType = if (looksLikeFlattenedPayload) {
                json.optString("adaptiveDirectVideoMimeType").takeIf { it.isNotBlank() }
            } else {
                adaptiveVideo?.optString("mimeType")?.takeIf { it.isNotBlank() } ?: signedAdaptiveVideo?.mimeType
            },
            adaptiveDirectAudioUrl = if (looksLikeFlattenedPayload) {
                json.optString("adaptiveDirectAudioUrl").takeIf { it.isNotBlank() }
            } else {
                adaptiveAudio?.optString("url")?.takeIf { it.isNotBlank() } ?: signedAdaptiveAudio?.url
            },
            adaptiveDirectAudioMimeType = if (looksLikeFlattenedPayload) {
                json.optString("adaptiveDirectAudioMimeType").takeIf { it.isNotBlank() }
            } else {
                adaptiveAudio?.optString("mimeType")?.takeIf { it.isNotBlank() } ?: signedAdaptiveAudio?.mimeType
            },
            formatCount = if (looksLikeFlattenedPayload) json.optInt("formatCount", formats.size) else formats.size,
            adaptiveFormatCount = if (looksLikeFlattenedPayload) json.optInt("adaptiveFormatCount", adaptiveFormats.size) else adaptiveFormats.size,
            directMuxedCount = if (looksLikeFlattenedPayload) {
                json.optInt("directMuxedCount", if (muxed != null) 1 else 0)
            } else {
                formats.count { it.optString("url").startsWith("http", ignoreCase = true) }
            },
            adaptiveDirectVideoCount = if (looksLikeFlattenedPayload) {
                json.optInt("adaptiveDirectVideoCount", if (adaptiveVideo != null) 1 else 0)
            } else {
                adaptiveFormats.count {
                    it.optString("url").startsWith("http", ignoreCase = true) &&
                        it.optString("mimeType").startsWith("video/", ignoreCase = true)
                }
            },
            adaptiveDirectAudioCount = if (looksLikeFlattenedPayload) {
                json.optInt("adaptiveDirectAudioCount", if (adaptiveAudio != null) 1 else 0)
            } else {
                adaptiveFormats.count {
                    it.optString("url").startsWith("http", ignoreCase = true) &&
                        it.optString("mimeType").startsWith("audio/", ignoreCase = true)
                }
            },
            cipheredMuxedCount = if (looksLikeFlattenedPayload) {
                json.optInt("cipheredMuxedCount", cipheredMuxedCount)
            } else {
                cipheredMuxedCount
            },
            cipheredAdaptiveVideoCount = if (looksLikeFlattenedPayload) {
                json.optInt("cipheredAdaptiveVideoCount", cipheredAdaptiveVideoCount)
            } else {
                cipheredAdaptiveVideoCount
            },
            cipheredAdaptiveAudioCount = if (looksLikeFlattenedPayload) {
                json.optInt("cipheredAdaptiveAudioCount", cipheredAdaptiveAudioCount)
            } else {
                cipheredAdaptiveAudioCount
            },
            cipheredMuxedCipher = if (looksLikeFlattenedPayload) {
                json.optString("cipheredMuxedCipher").ifBlank { cipheredMuxedCipher.orEmpty() }.ifBlank { null }
            } else {
                cipheredMuxedCipher
            },
        )
    }

    private fun hasCipherWithoutDirectUrl(format: JSONObject): Boolean {
        if (format.optString("url").startsWith("http", ignoreCase = true)) return false
        return format.optString("signatureCipher").isNotBlank() || format.optString("cipher").isNotBlank()
    }

    private fun resolveCipherUrl(format: JSONObject): CipherResolution? {
        val cipher = format.optString("signatureCipher").ifBlank { format.optString("cipher") }.ifBlank { return null }
        val params = cipher
            .split("&")
            .mapNotNull { part ->
                val idx = part.indexOf('=')
                if (idx <= 0) return@mapNotNull null
                val key = part.substring(0, idx)
                val value = part.substring(idx + 1)
                key to runCatching { URLDecoder.decode(value, "UTF-8") }.getOrDefault(value)
            }
            .toMap()
        val baseUrl = params["url"]?.takeIf { it.startsWith("http", ignoreCase = true) } ?: return null
        val sig = params["sig"] ?: params["signature"]
        val s = params["s"]
        if (sig.isNullOrBlank() && !s.isNullOrBlank()) return null
        val resolvedUrl = if (!sig.isNullOrBlank()) {
            val signatureParam = params["sp"].orEmpty().ifBlank { "signature" }
            appendQueryParam(baseUrl, signatureParam, sig)
        } else {
            baseUrl
        }
        return CipherResolution(
            url = resolvedUrl,
            mimeType = format.optString("mimeType").takeIf { it.isNotBlank() },
        )
    }

    private fun appendQueryParam(url: String, key: String, value: String): String {
        val separator = if (url.contains("?")) "&" else "?"
        return url + separator + key + "=" + URLEncoder.encode(value, "UTF-8")
    }

    private fun extractHtmlPlayerResponse(html: String): String? {
        val markers = listOf(
            "ytInitialPlayerResponse =",
            "var ytInitialPlayerResponse =",
            "window[\"ytInitialPlayerResponse\"] =",
        )
        for (marker in markers) {
            extractObjectLiteral(html, marker)?.let { return it }
        }
        return null
    }

    private fun extractObjectLiteral(text: String, marker: String): String? {
        val markerIndex = text.indexOf(marker)
        if (markerIndex < 0) return null
        val start = text.indexOf('{', markerIndex + marker.length)
        if (start < 0) return null
        var depth = 0
        var inString = false
        var stringQuote = '\u0000'
        var escaped = false
        for (i in start until text.length) {
            val ch = text[i]
            if (inString) {
                if (escaped) {
                    escaped = false
                } else if (ch == '\\') {
                    escaped = true
                } else if (ch == stringQuote) {
                    inString = false
                    stringQuote = '\u0000'
                }
                continue
            }
            if (ch == '"' || ch == '\'') {
                inString = true
                stringQuote = ch
                continue
            }
            if (ch == '{') {
                depth += 1
            } else if (ch == '}') {
                depth -= 1
                if (depth == 0) {
                    return text.substring(start, i + 1)
                }
            }
        }
        return null
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
        private data class YouTubeStreamingSnapshot(
            val playability: String,
            val title: String,
            val playerResponseAvailable: Boolean,
            val streamingDataAvailable: Boolean,
            val playerResponseSource: String,
            val hlsManifestUrl: String?,
            val dashManifestUrl: String?,
            val directFormatUrl: String?,
            val directMimeType: String?,
            val adaptiveDirectVideoUrl: String?,
            val adaptiveDirectVideoMimeType: String?,
            val adaptiveDirectAudioUrl: String?,
            val adaptiveDirectAudioMimeType: String?,
            val formatCount: Int,
            val adaptiveFormatCount: Int,
            val directMuxedCount: Int,
            val adaptiveDirectVideoCount: Int,
            val adaptiveDirectAudioCount: Int,
            val cipheredMuxedCount: Int,
            val cipheredAdaptiveVideoCount: Int,
            val cipheredAdaptiveAudioCount: Int,
            val cipheredMuxedCipher: String?,
        )
        private data class CipherResolution(
            val url: String,
            val mimeType: String?,
        )
        private data class SignatureOp(
            val transform: SignatureTransform,
            val argument: Int,
        )
        private data class SignatureFunctionCandidate(
            val argName: String,
            val body: String,
        )
        private enum class SignatureTransform {
            REVERSE,
            SPLICE,
            SWAP,
        }
        private val YOUTUBE_STREAMING_DATA_SCRIPT =
            """
            (() => {
              const toObject = (value) => {
                if (!value) return null;
                if (typeof value === 'object') return value;
                if (typeof value === 'string') {
                  try {
                    return JSON.parse(value);
                  } catch (error) {
                    return null;
                  }
                }
                return null;
              };
              const extractObjectLiteral = (text, marker) => {
                if (!text || !marker) return null;
                const markerIndex = text.indexOf(marker);
                if (markerIndex < 0) return null;
                const start = text.indexOf('{', markerIndex + marker.length);
                if (start < 0) return null;
                let depth = 0;
                let inString = false;
                let stringQuote = '';
                let escaped = false;
                for (let i = start; i < text.length; i += 1) {
                  const ch = text[i];
                  if (inString) {
                    if (escaped) {
                      escaped = false;
                    } else if (ch === '\\\\') {
                      escaped = true;
                    } else if (ch === stringQuote) {
                      inString = false;
                      stringQuote = '';
                    }
                    continue;
                  }
                  if (ch === '"' || ch === "'") {
                    inString = true;
                    stringQuote = ch;
                    continue;
                  }
                  if (ch === '{') {
                    depth += 1;
                  } else if (ch === '}') {
                    depth -= 1;
                    if (depth === 0) {
                      return text.slice(start, i + 1);
                    }
                  }
                }
                return null;
              };
              const readPlayerResponse = () => {
                const direct = toObject(window.ytInitialPlayerResponse);
                if (direct) return { response: direct, source: 'window.ytInitialPlayerResponse' };

                const ytConfig = toObject(
                  window.ytplayer &&
                  window.ytplayer.config &&
                  window.ytplayer.config.args &&
                  window.ytplayer.config.args.player_response
                );
                if (ytConfig) return { response: ytConfig, source: 'window.ytplayer.config.args.player_response' };

                const moviePlayer = document.querySelector('#movie_player');
                const moviePlayerResponse =
                  moviePlayer &&
                  typeof moviePlayer.getPlayerResponse === 'function'
                    ? toObject(moviePlayer.getPlayerResponse())
                    : null;
                if (moviePlayerResponse) return { response: moviePlayerResponse, source: '#movie_player.getPlayerResponse' };

                const ytdPlayer = document.querySelector('ytd-player');
                const ytdPlayerSources = [
                  ytdPlayer && ytdPlayer.player_,
                  ytdPlayer && ytdPlayer.playerApi,
                  ytdPlayer && ytdPlayer.playerApi_,
                  ytdPlayer && ytdPlayer.wrappedPlayer,
                  window.player,
                ];
                for (const candidate of ytdPlayerSources) {
                  if (candidate && typeof candidate.getPlayerResponse === 'function') {
                    const candidateResponse = toObject(candidate.getPlayerResponse());
                    if (candidateResponse) {
                      return { response: candidateResponse, source: 'ytd-player.getPlayerResponse' };
                    }
                  }
                }

                const bootstrapVars = toObject(
                  window.ytplayer &&
                  window.ytplayer.bootstrapWebPlayerContextConfig &&
                  window.ytplayer.bootstrapWebPlayerContextConfig.jsConfig &&
                  window.ytplayer.bootstrapWebPlayerContextConfig.jsConfig.PLAYER_VARS &&
                  window.ytplayer.bootstrapWebPlayerContextConfig.jsConfig.PLAYER_VARS.player_response
                );
                if (bootstrapVars) {
                  return { response: bootstrapVars, source: 'window.ytplayer.bootstrapWebPlayerContextConfig' };
                }

                const scripts = Array.from(document.scripts || []);
                for (const script of scripts) {
                  const text = script && typeof script.textContent === 'string' ? script.textContent : '';
                  if (!text) continue;
                  if (text.indexOf('ytInitialPlayerResponse') >= 0) {
                    const objectLiteral = extractObjectLiteral(text, 'ytInitialPlayerResponse =');
                    const parsed = toObject(objectLiteral);
                    if (parsed) return { response: parsed, source: 'script:ytInitialPlayerResponse' };
                  }
                  if (text.indexOf('player_response') >= 0) {
                    const objectLiteral = extractObjectLiteral(text, 'player_response =');
                    const parsed = toObject(objectLiteral);
                    if (parsed) return { response: parsed, source: 'script:player_response' };
                  }
                }

                return { response: null, source: 'none' };
              };
              const playerResponseResult = readPlayerResponse();
              const playerResponse = playerResponseResult && playerResponseResult.response ? playerResponseResult.response : null;
              const playerResponseSource = playerResponseResult && playerResponseResult.source ? playerResponseResult.source : 'none';
              const streamingData = playerResponse && playerResponse.streamingData ? playerResponse.streamingData : null;
              const formats = streamingData && Array.isArray(streamingData.formats) ? streamingData.formats : [];
              const adaptiveFormats = streamingData && Array.isArray(streamingData.adaptiveFormats) ? streamingData.adaptiveFormats : [];
              const muxed = formats.find((format) => format && typeof format.url === 'string' && /^https?:/i.test(format.url));
              const cipheredMuxed = formats.find((format) =>
                format &&
                !(typeof format.url === 'string' && /^https?:/i.test(format.url)) &&
                (typeof format.signatureCipher === 'string' || typeof format.cipher === 'string')
              );
              const adaptiveDirectVideo = adaptiveFormats.find((format) =>
                format &&
                typeof format.url === 'string' &&
                /^https?:/i.test(format.url) &&
                typeof format.mimeType === 'string' &&
                format.mimeType.indexOf('video/') === 0
              );
              const adaptiveDirectAudio = adaptiveFormats.find((format) =>
                format &&
                typeof format.url === 'string' &&
                /^https?:/i.test(format.url) &&
                typeof format.mimeType === 'string' &&
                format.mimeType.indexOf('audio/') === 0
              );
              return JSON.stringify({
                playerResponseAvailable: !!playerResponse,
                playerResponseSource,
                streamingDataAvailable: !!streamingData,
                playabilityStatus: playerResponse && playerResponse.playabilityStatus ? playerResponse.playabilityStatus.status : '',
                videoTitle: playerResponse && playerResponse.videoDetails ? playerResponse.videoDetails.title : '',
                hlsManifestUrl: streamingData ? (streamingData.hlsManifestUrl || '') : '',
                dashManifestUrl: streamingData ? (streamingData.dashManifestUrl || '') : '',
                directFormatUrl: muxed ? (muxed.url || '') : '',
                directFormatMimeType: muxed ? (muxed.mimeType || '') : '',
                adaptiveDirectVideoUrl: adaptiveDirectVideo ? (adaptiveDirectVideo.url || '') : '',
                adaptiveDirectVideoMimeType: adaptiveDirectVideo ? (adaptiveDirectVideo.mimeType || '') : '',
                adaptiveDirectAudioUrl: adaptiveDirectAudio ? (adaptiveDirectAudio.url || '') : '',
                adaptiveDirectAudioMimeType: adaptiveDirectAudio ? (adaptiveDirectAudio.mimeType || '') : '',
                formatCount: formats.length,
                adaptiveFormatCount: adaptiveFormats.length,
                directMuxedCount: formats.filter((format) => format && typeof format.url === 'string' && /^https?:/i.test(format.url)).length,
                adaptiveDirectVideoCount: adaptiveFormats.filter((format) =>
                  format &&
                  typeof format.url === 'string' &&
                  /^https?:/i.test(format.url) &&
                  typeof format.mimeType === 'string' &&
                  format.mimeType.indexOf('video/') === 0
                ).length,
                adaptiveDirectAudioCount: adaptiveFormats.filter((format) =>
                  format &&
                  typeof format.url === 'string' &&
                  /^https?:/i.test(format.url) &&
                  typeof format.mimeType === 'string' &&
                  format.mimeType.indexOf('audio/') === 0
                ).length,
                cipheredMuxedCount: formats.filter((format) =>
                  format &&
                  !(typeof format.url === 'string' && /^https?:/i.test(format.url)) &&
                  (typeof format.signatureCipher === 'string' || typeof format.cipher === 'string')
                ).length,
                cipheredAdaptiveVideoCount: adaptiveFormats.filter((format) =>
                  format &&
                  !(typeof format.url === 'string' && /^https?:/i.test(format.url)) &&
                  typeof format.mimeType === 'string' &&
                  format.mimeType.indexOf('video/') === 0 &&
                  (typeof format.signatureCipher === 'string' || typeof format.cipher === 'string')
                ).length,
                cipheredAdaptiveAudioCount: adaptiveFormats.filter((format) =>
                  format &&
                  !(typeof format.url === 'string' && /^https?:/i.test(format.url)) &&
                  typeof format.mimeType === 'string' &&
                  format.mimeType.indexOf('audio/') === 0 &&
                  (typeof format.signatureCipher === 'string' || typeof format.cipher === 'string')
                ).length,
                cipheredMuxedCipher: cipheredMuxed ? (cipheredMuxed.signatureCipher || cipheredMuxed.cipher || '') : ''
              });
            })();
            """.trimIndent()
    }
}
