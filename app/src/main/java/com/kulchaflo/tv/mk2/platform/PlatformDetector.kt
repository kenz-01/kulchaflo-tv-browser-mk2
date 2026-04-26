package com.kulchaflo.tv.mk2.platform

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

class PlatformDetector {
    fun detect(context: Context): PlatformCapabilities {
        val supportsLeanback = context.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
        return PlatformCapabilities(
            manufacturer = Build.MANUFACTURER.orEmpty(),
            brand = Build.BRAND.orEmpty(),
            model = Build.MODEL.orEmpty(),
            isAndroidTvLike = supportsLeanback,
            supportsLeanback = supportsLeanback,
        )
    }
}
