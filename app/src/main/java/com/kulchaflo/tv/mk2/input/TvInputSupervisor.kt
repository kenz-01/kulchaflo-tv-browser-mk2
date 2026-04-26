package com.kulchaflo.tv.mk2.input

import android.view.KeyEvent
import com.kulchaflo.tv.mk2.fullscreen.FullscreenController
import com.kulchaflo.tv.mk2.tabs.TabController
import com.kulchaflo.tv.mk2.ui.tabs.TabsOverlayController
import com.kulchaflo.tv.mk2.util.Logger

/**
 * Supervises key routing priority around the active WebView rather than replacing Chromium's
 * built-in focus system. It decides which layer should receive the key first, then lets the
 * framework deliver it normally.
 */
class TvInputSupervisor(
    private val fullscreenController: FullscreenController,
    private val tabsOverlayController: TabsOverlayController,
    private val imeHandoffController: ImeHandoffController,
    private val backNavigationController: BackNavigationController,
    private val tabController: TabController,
    private val pointerNavigationController: PointerNavigationController,
    private val onTabsTrigger: () -> Boolean,
    private val onPromotedMediaTrigger: (String) -> Boolean = { false },
) {
    fun route(event: KeyEvent): KeyRoutingResult {
        val shouldLog = event.action == KeyEvent.ACTION_DOWN
        if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_DOWN) {
            Logger.d(DEBUG_TAG, "route key=BACK decision=back-controller")
            backNavigationController.handleBack()
            return KeyRoutingResult.CONSUMED
        }

        if (event.action == KeyEvent.ACTION_DOWN && isPromotedMediaTriggerKey(event.keyCode)) {
            val consumed = onPromotedMediaTrigger("media-key:${keyName(event.keyCode)}")
            Logger.d(
                DEBUG_TAG,
                "route key=${keyName(event.keyCode)} decision=${if (consumed) "enter-promoted-media" else "media-key-pass-through"}"
            )
            if (consumed) {
                return KeyRoutingResult.CONSUMED
            }
        }

        // MENU is the explicit TV tabs trigger: first press opens the overlay, later presses
        // are handled by the focused tab chip to request a close action.
        if (event.keyCode == KeyEvent.KEYCODE_MENU &&
            event.action == KeyEvent.ACTION_DOWN &&
            !tabsOverlayController.isVisible()
        ) {
            Logger.d(DEBUG_TAG, "route key=MENU decision=open-tabs-overlay")
            return if (onTabsTrigger()) KeyRoutingResult.CONSUMED else KeyRoutingResult.NOT_HANDLED
        }

        if (fullscreenController.isVideoFullscreen()) {
            // Real media fullscreen should keep ordinary directional/select handling.
            if (shouldLog && isNavigationKey(event.keyCode)) {
                Logger.d(DEBUG_TAG, "route key=${keyName(event.keyCode)} decision=video-fullscreen-pass-through")
            }
            return KeyRoutingResult.NOT_HANDLED
        }

        if (tabsOverlayController.isVisible()) {
            if (event.action == KeyEvent.ACTION_DOWN && isNavigationKey(event.keyCode)) {
                Logger.d(DEBUG_TAG, "route key=${keyName(event.keyCode)} decision=tabs-overlay-focus")
                tabsOverlayController.requestPrimaryFocus()
            }
            return KeyRoutingResult.NOT_HANDLED
        }

        if (imeHandoffController.shouldConsumeDirectionalDuringHandoff(event)) {
            if (shouldLog) {
                Logger.d(DEBUG_TAG, "route key=${keyName(event.keyCode)} decision=consume-ime-guard")
            }
            return KeyRoutingResult.CONSUMED
        }

        if (imeHandoffController.isImeVisible()) {
            // While IME is open, do not let the shell force WebView focus back and accidentally
            // turn DPAD input into page scrolling.
            if (shouldLog && isNavigationKey(event.keyCode)) {
                Logger.d(DEBUG_TAG, "route key=${keyName(event.keyCode)} decision=ime-pass-through")
            }
            return KeyRoutingResult.NOT_HANDLED
        }

        try {
            if (pointerNavigationController.handleKeyEvent(event)) {
                if (shouldLog) {
                    Logger.d(DEBUG_TAG, "route key=${keyName(event.keyCode)} decision=pointer-consumed")
                }
                return KeyRoutingResult.CONSUMED
            }
        } catch (throwable: Throwable) {
            Logger.w(DEBUG_TAG, "route key=${keyName(event.keyCode)} decision=pointer-fallback", throwable)
        }

        val active = tabController.getActiveTab()?.webView
        if (active == null) {
            if (shouldLog) {
                Logger.d(DEBUG_TAG, "route key=${keyName(event.keyCode)} decision=no-active-webview")
            }
            return KeyRoutingResult.NOT_HANDLED
        }

        if (event.action == KeyEvent.ACTION_DOWN && isNavigationKey(event.keyCode) && !active.hasFocus()) {
            return if (active.requestPrimaryFocus()) {
                Logger.d(DEBUG_TAG, "route key=${keyName(event.keyCode)} decision=restore-webview-focus")
                KeyRoutingResult.CONSUMED
            } else {
                Logger.d(DEBUG_TAG, "route key=${keyName(event.keyCode)} decision=focus-restore-failed")
                KeyRoutingResult.NOT_HANDLED
            }
        }

        if (shouldLog && isNavigationKey(event.keyCode)) {
            Logger.d(DEBUG_TAG, "route key=${keyName(event.keyCode)} decision=webview-pass-through")
        }
        return KeyRoutingResult.NOT_HANDLED
    }

    private fun isNavigationKey(keyCode: Int): Boolean {
        return keyCode == KeyEvent.KEYCODE_DPAD_UP ||
            keyCode == KeyEvent.KEYCODE_DPAD_DOWN ||
            keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
            keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ||
            keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == KeyEvent.KEYCODE_ENTER
    }

    private fun isPromotedMediaTriggerKey(keyCode: Int): Boolean {
        return keyCode == KeyEvent.KEYCODE_MEDIA_PLAY ||
            keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
    }

    private fun keyName(keyCode: Int): String = KeyEvent.keyCodeToString(keyCode)

    private companion object {
        private const val DEBUG_TAG = "KfInputDebug"
    }
}
