package com.kulchaflo.tv.mk2.platform

data class PlatformCapabilities(
    val manufacturer: String,
    val brand: String,
    val model: String,
    val isAndroidTvLike: Boolean,
    val supportsLeanback: Boolean,
    val supportsVendorOsdHooks: Boolean = false,
    val supportsVendorVideoSurfaceHooks: Boolean = false
)
