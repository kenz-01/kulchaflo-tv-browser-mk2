package com.kulchaflo.tv.mk2.gv.app

import android.app.Application
import com.kulchaflo.tv.mk2.gv.BuildConfig
import com.kulchaflo.tv.mk2.gv.extensions.GvBuiltInExtension
import com.kulchaflo.tv.mk2.gv.util.GvLogger
import org.mozilla.geckoview.ContentBlocking
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoRuntimeSettings

class GvApplication : Application() {
    lateinit var geckoRuntime: GeckoRuntime
        private set

    override fun onCreate() {
        super.onCreate()
        val processName = Application.getProcessName()
        if (processName != packageName) {
            GvLogger.i("GvRuntime", "skipping runtime init process=$processName")
            return
        }
        geckoRuntime = createRuntime()
        GvLogger.i(
            "GvRuntime",
            "runtime created process=$processName",
        )
    }

    private fun createRuntime(): GeckoRuntime {
        fun buildContentBlockingSettings(): ContentBlocking.Settings =
            ContentBlocking.Settings.Builder()
                .cookieBannerHandlingMode(ContentBlocking.CookieBannerMode.COOKIE_BANNER_MODE_DISABLED)
                .cookieBannerGlobalRulesEnabled(false)
                .cookieBannerHandlingDetectOnlyMode(false)
                .build()

        fun buildSettings(): GeckoRuntimeSettings =
            GeckoRuntimeSettings.Builder()
                .aboutConfigEnabled(false)
                .appZygoteProcessEnabled(false)
                .contentBlocking(buildContentBlockingSettings())
                .extensionsProcessEnabled(false)
                .fissionEnabled(false)
                .isolatedProcessEnabled(false)
                .loginAutofillEnabled(false)
                .lowMemoryDetection(false)
                .consoleOutput(BuildConfig.DEBUG)
                .apply {
                    if (GvRuntimeExperimentConfig.ENABLE_TV_VIEWPORT_POLICY) {
                        displayDensityOverride(GvRuntimeExperimentConfig.TV_VIEWPORT_POLICY_DENSITY)
                    }
                }
                .build()

        val displayMetrics = resources.displayMetrics
        GvLogger.i(
            "GvRuntime",
            "tv viewport policy startup enabled=${GvRuntimeExperimentConfig.ENABLE_TV_VIEWPORT_POLICY} " +
                "requestedDisplayDensityOverride=${GvRuntimeExperimentConfig.TV_VIEWPORT_POLICY_DENSITY} " +
                "androidDensity=${displayMetrics.density} densityDpi=${displayMetrics.densityDpi}"
        )

        val runtime = runCatching {
            GeckoRuntime.create(this, buildSettings())
        }.getOrElse { throwable ->
            if (throwable is IllegalStateException &&
                throwable.message?.contains("Only one GeckoRuntime instance is allowed") == true
            ) {
                GvLogger.e("GvRuntime", "runtime already exists; using default runtime", throwable)
                GeckoRuntime.getDefault(this)
            } else {
                throw throwable
            }
        }
        val runtimeSettings = runtime.settings
        GvLogger.i(
            "GvRuntime",
            "tv viewport policy runtime enabled=${GvRuntimeExperimentConfig.ENABLE_TV_VIEWPORT_POLICY} " +
                "requestedDisplayDensityOverride=${GvRuntimeExperimentConfig.TV_VIEWPORT_POLICY_DENSITY} " +
                "runtimeDisplayDensityOverride=${runtimeSettings.displayDensityOverride} " +
                "runtimeDisplayDpiOverride=${runtimeSettings.displayDpiOverride} " +
                "runtimeScreenSizeOverride=${runtimeSettings.screenSizeOverride}"
        )
        runtime.getWebExtensionController()
            .ensureBuiltIn(GvBuiltInExtension.LOCATION, GvBuiltInExtension.ID)
            .accept(
                { extension ->
                    GvLogger.i(
                        "GvRuntime",
                        "built-in extension ready id=${extension?.id ?: GvBuiltInExtension.ID} version=${GvBuiltInExtension.VERSION}"
                    )
                },
                { throwable ->
                    GvLogger.e("GvRuntime", "built-in extension install failed", throwable)
                },
            )
        return runtime
    }
}
