package com.kulchaflo.tv.mk2.input

import android.os.SystemClock
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.InputMethodManager
import com.kulchaflo.tv.mk2.util.Logger

class ImeHandoffController(
    private val recentlyHiddenGuardMs: Long = 600L,
    private val pendingTextEntryGuardMs: Long = 500L,
    private val editableFocusGuardMs: Long = 1200L,
) {
    enum class VisibilityChange {
        UNCHANGED,
        SHOWN,
        HIDDEN,
    }

    private var imeVisible: Boolean = false
    private var awaitingWebViewFocusRestore: Boolean = false
    private var lastImeHiddenAt: Long = 0L
    private var pendingTextEntryAt: Long = 0L
    private var editableFocusLikelyUntil: Long = 0L

    fun updateImeVisible(visible: Boolean): VisibilityChange {
        if (imeVisible == visible) {
            return VisibilityChange.UNCHANGED
        }
        imeVisible = visible
        return if (visible) {
            awaitingWebViewFocusRestore = false
            lastImeHiddenAt = 0L
            pendingTextEntryAt = 0L
            editableFocusLikelyUntil = 0L
            Logger.d(DEBUG_TAG, "ime shown awaitingFocusRestore=false")
            VisibilityChange.SHOWN
        } else {
            awaitingWebViewFocusRestore = true
            lastImeHiddenAt = SystemClock.uptimeMillis()
            Logger.d(DEBUG_TAG, "ime hidden awaitingFocusRestore=true guardMs=$recentlyHiddenGuardMs")
            VisibilityChange.HIDDEN
        }
    }

    fun isImeVisible(): Boolean = imeVisible

    fun isAwaitingFocusRestore(): Boolean = awaitingWebViewFocusRestore

    fun isEditableFocusLikelyPending(): Boolean {
        return editableFocusLikelyUntil != 0L && SystemClock.uptimeMillis() <= editableFocusLikelyUntil
    }

    fun onWebViewFocusRestored() {
        awaitingWebViewFocusRestore = false
        pendingTextEntryAt = 0L
        editableFocusLikelyUntil = 0L
        Logger.d(DEBUG_TAG, "webview focus restored awaitingFocusRestore=false")
    }

    fun onPointerClickObserved() {
        Logger.d(DEBUG_TAG, "pointer click observed pendingTextEntry=false reason=awaiting-editable-confirmation")
    }

    fun onEditableFocusConfirmed(reason: String) {
        pendingTextEntryAt = SystemClock.uptimeMillis()
        editableFocusLikelyUntil = SystemClock.uptimeMillis() + editableFocusGuardMs
        Logger.d(
            DEBUG_TAG,
            "pendingTextEntry=true reason=$reason guardMs=$pendingTextEntryGuardMs editableGuardUntil=$editableFocusLikelyUntil"
        )
    }

    fun onEditableFocusNotConfirmed(reason: String) {
        pendingTextEntryAt = 0L
        editableFocusLikelyUntil = 0L
        Logger.d(DEBUG_TAG, "pendingTextEntry=false reason=$reason")
    }

    fun shouldConsumeDirectionalDuringHandoff(event: KeyEvent): Boolean {
        if (!isDirectionalKey(event.keyCode)) {
            return false
        }
        val now = SystemClock.uptimeMillis()
        val withinImeDismissGuard = awaitingWebViewFocusRestore &&
            now - lastImeHiddenAt <= recentlyHiddenGuardMs
        val withinPendingTextEntryGuard = pendingTextEntryAt != 0L &&
            now - pendingTextEntryAt <= pendingTextEntryGuardMs
        val withinEditableFocusGuard = now <= editableFocusLikelyUntil
        val shouldConsume = withinImeDismissGuard || withinPendingTextEntryGuard || withinEditableFocusGuard
        if (shouldConsume) {
            val reason = when {
                withinImeDismissGuard -> "recent-ime-dismiss"
                withinPendingTextEntryGuard -> "pending-text-entry-confirmed"
                withinEditableFocusGuard -> "editable-focus-confirmed"
                else -> "post-ime-guard"
            }
            Logger.d(DEBUG_TAG, "consume directional keyCode=${event.keyCode} reason=$reason")
        }
        return shouldConsume
    }

    fun onBackPressed(targetView: View?): Boolean {
        if (imeVisible) {
            hideIme(targetView)
            awaitingWebViewFocusRestore = true
            lastImeHiddenAt = SystemClock.uptimeMillis()
            pendingTextEntryAt = 0L
            editableFocusLikelyUntil = 0L
            Logger.d(DEBUG_TAG, "back handled reason=ime-visible")
            return true
        }
        if (awaitingWebViewFocusRestore &&
            SystemClock.uptimeMillis() - lastImeHiddenAt <= recentlyHiddenGuardMs
        ) {
            awaitingWebViewFocusRestore = false
            pendingTextEntryAt = 0L
            editableFocusLikelyUntil = 0L
            Logger.d(DEBUG_TAG, "back handled reason=recent-ime-dismiss")
            return true
        }
        if (pendingTextEntryAt != 0L &&
            SystemClock.uptimeMillis() - pendingTextEntryAt <= pendingTextEntryGuardMs
        ) {
            pendingTextEntryAt = 0L
            editableFocusLikelyUntil = 0L
            Logger.d(DEBUG_TAG, "back handled reason=pending-text-entry")
            return true
        }
        if (editableFocusLikelyUntil != 0L &&
            SystemClock.uptimeMillis() <= editableFocusLikelyUntil
        ) {
            editableFocusLikelyUntil = 0L
            Logger.d(DEBUG_TAG, "back handled reason=editable-focus-likely")
            return true
        }
        return false
    }

    private fun hideIme(targetView: View?) {
        val inputMethodManager = targetView?.context?.getSystemService(InputMethodManager::class.java)
        val targetWindowToken = targetView?.windowToken ?: targetView?.rootView?.windowToken
        if (inputMethodManager != null && targetWindowToken != null) {
            inputMethodManager.hideSoftInputFromWindow(targetWindowToken, 0)
        }
    }

    private fun isDirectionalKey(keyCode: Int): Boolean {
        return keyCode == KeyEvent.KEYCODE_DPAD_UP ||
            keyCode == KeyEvent.KEYCODE_DPAD_DOWN ||
            keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
            keyCode == KeyEvent.KEYCODE_DPAD_RIGHT
    }

    private companion object {
        private const val DEBUG_TAG = "KfInputDebug"
    }
}
