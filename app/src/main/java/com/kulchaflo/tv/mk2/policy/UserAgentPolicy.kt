package com.kulchaflo.tv.mk2.policy

import android.webkit.WebSettings

enum class UserAgentMode {
    DEFAULT,
    DESKTOP,
    DESKTOP_SONY,
    TV,
    SONY_LIKE
}

class UserAgentPolicy(
    private val mode: UserAgentMode = UserAgentMode.SONY_LIKE
) {
    fun apply(settings: WebSettings) {
        val base = settings.userAgentString.orEmpty()
        settings.userAgentString = when (mode) {
            UserAgentMode.DEFAULT -> base
            UserAgentMode.DESKTOP -> buildDesktopUserAgent(base, appendSonyToken = false)
            UserAgentMode.DESKTOP_SONY -> buildDesktopUserAgent(base, appendSonyToken = true)
            UserAgentMode.TV -> "$base KulchaFloTVMkII/1.0"
            UserAgentMode.SONY_LIKE -> SONY_BRAVIA_USER_AGENT
        }
    }

    private fun buildDesktopUserAgent(base: String, appendSonyToken: Boolean): String {
        val desktopLike = base
            .replace("; wv", "")
            .replace(" Version/4.0", "")
            .replace(" Mobile", "")
            .replace(Regex("Linux; Android [^;\\)]+;"), "X11; Linux x86_64;")
            .replace(Regex("Android [^;\\)]+"), "X11; Linux x86_64")
        return if (appendSonyToken) {
            "$desktopLike SonyCEBrowser/1.0 KulchaFloTVMkII/2.0"
        } else {
            desktopLike
        }
    }

    private companion object {
        // Grounded in the Sony browser engine sources rather than a generic Android WebView UA.
        private const val SONY_BRAVIA_USER_AGENT =
            "Mozilla/5.0 (Linux; BRAVIA 4K 2015 Build/LMY48E.S1) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.101 " +
                "Safari/537.36 OPR/28.0.1754.0 OMI/4.4.22.20.E102586-1.115 " +
                "SonyCEBrowser/1.0 (BRAVIA; CTV/KulchaFloTVMkII; GBR);"
    }
}
