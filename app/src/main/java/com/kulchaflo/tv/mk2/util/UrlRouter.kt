package com.kulchaflo.tv.mk2.util

import android.net.Uri

object UrlRouter {
    fun normalize(rawUrl: String): String {
        if (rawUrl.isBlank()) return "https://kulchaflo.com"
        val uri = Uri.parse(rawUrl)
        return if (uri.scheme.isNullOrBlank()) {
            "https://$rawUrl"
        } else {
            rawUrl
        }
    }
}
