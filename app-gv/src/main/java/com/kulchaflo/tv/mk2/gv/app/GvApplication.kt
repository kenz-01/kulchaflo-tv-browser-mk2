package com.kulchaflo.tv.mk2.gv.app

import android.app.Application
import com.kulchaflo.tv.mk2.gv.BuildConfig
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
                .cookieBannerHandlingMode(ContentBlocking.CookieBannerMode.COOKIE_BANNER_MODE_REJECT_OR_ACCEPT)
                .cookieBannerGlobalRulesEnabled(true)
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
                .build()

        return runCatching {
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
    }
}
