package com.kulchaflo.tv.mk2.web

import android.content.Context
import com.kulchaflo.tv.mk2.fullscreen.FullscreenController
import com.kulchaflo.tv.mk2.input.FocusRecoveryController
import com.kulchaflo.tv.mk2.policy.MediaPolicy
import com.kulchaflo.tv.mk2.policy.UserAgentPolicy
import com.kulchaflo.tv.mk2.util.Logger

class KfWebViewFactory(
    private val context: Context,
    private val userAgentPolicy: UserAgentPolicy,
    private val mediaPolicy: MediaPolicy,
    private val focusRecoveryController: FocusRecoveryController,
    private val fullscreenController: FullscreenController,
    private val compatRegistry: WebCompatRegistry,
    private val permissionController: WebPermissionController,
    private val callbacks: Callbacks,
) {
    interface Callbacks : KfWebViewClient.Callbacks, KfWebChromeClient.Callbacks

    fun create(): KfWebView {
        return KfWebView(context).apply {
            applyTvDefaults()
            setInitialScale(KfWebView.INITIAL_SCALE_PERCENT)
            settings.mediaPlaybackRequiresUserGesture = !mediaPolicy.allowAutoplayWithoutGesture
            userAgentPolicy.apply(settings)
            Logger.i("KfWebSettings", "created ${describeSettingsSnapshot()}")
            webViewClient = KfWebViewClient(compatRegistry, focusRecoveryController, callbacks)
            webChromeClient = KfWebChromeClient(fullscreenController, permissionController, callbacks)
        }
    }
}
