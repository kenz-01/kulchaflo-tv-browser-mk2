package com.kulchaflo.tv.mk2.policy

import com.kulchaflo.tv.mk2.platform.PlatformCapabilities

data class BrowserPolicy(
    val startUrl: String,
    val supportsMultipleTabs: Boolean = true,
    val keepChromeHiddenByDefault: Boolean = true,
    val platformCapabilities: PlatformCapabilities
)
