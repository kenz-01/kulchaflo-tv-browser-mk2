package com.kulchaflo.tv.mk2.gv.youtube

object YouTubeUrlPolicy {
    fun isYouTubePageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty()
        return isYouTubeSurfaceHost(host)
    }

    fun isYouTubeConsentPageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty()
        if (host.startsWith("consent.youtube.com")) {
            return true
        }
        return host.startsWith("consent.google.")
    }

    fun isYouTubeWatchOrLivePageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty()
        if (!isYouTubeSurfaceHost(host)) {
            return false
        }
        val path = uri.path?.lowercase().orEmpty()
        return path == "/watch" ||
            path.startsWith("/watch/") ||
            path == "/live" ||
            path.startsWith("/live/")
    }

    private fun isYouTubeSurfaceHost(host: String): Boolean {
        return host == "youtube.com" ||
            host.endsWith(".youtube.com") ||
            host == "youtu.be" ||
            host == "youtube-nocookie.com" ||
            host.endsWith(".youtube-nocookie.com") ||
            host == "googlevideo.com" ||
            host.endsWith(".googlevideo.com")
    }
}
