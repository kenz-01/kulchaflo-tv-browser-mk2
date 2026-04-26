package com.kulchaflo.tv.mk2.util

import android.net.Uri

object HostPolicyRegistry {
    private val trustedOutboundPopupHosts = setOf(
        "youtube.com",
        "m.youtube.com",
        "youtu.be",
        "facebook.com",
        "m.facebook.com",
        "fb.watch",
        "instagram.com",
        "tiktok.com",
        "vm.tiktok.com",
        "vimeo.com",
        "player.vimeo.com",
        "twitch.tv",
        "m.twitch.tv",
        "clips.twitch.tv",
        "dailymotion.com",
        "dai.ly",
        "x.com",
        "twitter.com",
        "mobile.twitter.com",
        "soundcloud.com",
        "m.soundcloud.com",
        "mixcloud.com",
        "audiomack.com",
        "open.spotify.com",
        "music.apple.com",
        "livestream.com",
        "video.ibm.com",
        "ustream.tv",
    )

    private val knownMediaHosts = setOf(
        "youtube.com",
        "m.youtube.com",
        "youtu.be",
        "vimeo.com",
        "player.vimeo.com",
        "twitch.tv",
        "m.twitch.tv",
        "clips.twitch.tv",
        "dailymotion.com",
        "dai.ly",
        "soundcloud.com",
        "m.soundcloud.com",
        "mixcloud.com",
        "audiomack.com",
        "open.spotify.com",
        "music.apple.com",
        "livestream.com",
        "video.ibm.com",
        "ustream.tv",
        "facebook.com",
        "m.facebook.com",
        "fb.watch",
        "instagram.com",
        "tiktok.com",
        "vm.tiktok.com",
        "x.com",
        "twitter.com",
        "mobile.twitter.com",
    )

    private val knownSocialHosts = setOf(
        "facebook.com",
        "m.facebook.com",
        "fb.watch",
        "instagram.com",
        "tiktok.com",
        "vm.tiktok.com",
        "x.com",
        "twitter.com",
        "mobile.twitter.com",
        "youtube.com",
        "m.youtube.com",
        "youtu.be",
    )

    private val likelyLiveStreamHosts = setOf(
        "youtube.com",
        "m.youtube.com",
        "youtu.be",
        "twitch.tv",
        "m.twitch.tv",
        "clips.twitch.tv",
        "livestream.com",
        "video.ibm.com",
        "ustream.tv",
        "fb.watch",
    )

    fun normalizedHost(url: String?): String? {
        if (url.isNullOrBlank()) return null
        val host = runCatching { Uri.parse(url).host }.getOrNull()
        return normalizedHostFromHost(host)
    }

    fun normalizedHostFromHost(host: String?): String? {
        return host
            ?.trim()
            ?.lowercase()
            ?.removePrefix("www.")
            ?.takeIf { it.isNotBlank() }
    }

    fun isTrustedOutboundPopupHost(host: String?): Boolean {
        val normalized = normalizedHostFromHost(host) ?: return false
        return trustedOutboundPopupHosts.contains(normalized)
    }

    fun isKnownMediaHost(host: String?): Boolean {
        val normalized = normalizedHostFromHost(host) ?: return false
        return knownMediaHosts.contains(normalized)
    }

    fun isKnownSocialHost(host: String?): Boolean {
        val normalized = normalizedHostFromHost(host) ?: return false
        return knownSocialHosts.contains(normalized)
    }

    fun isLikelyLiveStreamHost(host: String?): Boolean {
        val normalized = normalizedHostFromHost(host) ?: return false
        return likelyLiveStreamHosts.contains(normalized)
    }

    fun isYouTubeHost(host: String?): Boolean {
        val normalized = normalizedHostFromHost(host) ?: return false
        return normalized == "youtube.com" || normalized == "m.youtube.com" || normalized == "youtu.be"
    }

    fun isFacebookHost(host: String?): Boolean {
        val normalized = normalizedHostFromHost(host) ?: return false
        return normalized == "facebook.com" || normalized == "m.facebook.com" || normalized == "fb.watch"
    }
}
