package com.kulchaflo.tv.mk2.policy

data class MediaPolicy(
    val allowAutoplayWithoutGesture: Boolean = true,
    val useStandardWebChromeFullscreenPath: Boolean = true,
)
