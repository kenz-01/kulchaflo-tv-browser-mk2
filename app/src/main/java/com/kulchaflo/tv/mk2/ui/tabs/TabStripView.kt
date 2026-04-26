package com.kulchaflo.tv.mk2.ui.tabs

import android.content.Context
import android.util.AttributeSet
import android.view.KeyEvent
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.kulchaflo.tv.mk2.R
import com.kulchaflo.tv.mk2.tabs.BrowserTab

class TabStripView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : HorizontalScrollView(context, attrs) {
    interface Listener {
        fun onTabActivated(tabId: String)
        fun onTabCloseRequested(tabId: String)
    }

    private val content = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
    }

    private val row = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        setPadding(24, 20, 24, 20)
        showDividers = LinearLayout.SHOW_DIVIDER_MIDDLE
    }

    private val footer = TextView(context).apply {
        setPadding(28, 0, 28, 20)
        setTextColor(ContextCompat.getColor(context, R.color.kf_text_secondary))
        textSize = 12f
        text = context.getString(R.string.tabs_overlay_hint)
    }

    private var listener: Listener? = null
    private var lastFocusedTabId: String? = null

    init {
        isHorizontalScrollBarEnabled = false
        isFillViewport = true
        background = ContextCompat.getDrawable(context, R.drawable.tabs_overlay_bg)
        content.addView(
            row,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        content.addView(
            footer,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        addView(
            content,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
    }

    fun setListener(listener: Listener) {
        this.listener = listener
    }

    fun renderTabs(tabs: List<BrowserTab>, activeTabId: String?) {
        row.removeAllViews()
        val preferredFocusTabId = lastFocusedTabId ?: activeTabId
        tabs.forEach { tab ->
            val chip = TabChipView(context).apply {
                id = ViewGroup.generateViewId()
                tag = tab.id
                bind(title = tab.title ?: tab.initialUrl, isActive = tab.id == activeTabId)
                setOnClickListener {
                    listener?.onTabActivated(tab.id)
                }
                setOnFocusChangeListener { view, hasFocus ->
                    if (hasFocus) {
                        lastFocusedTabId = tab.id
                        smoothScrollTo(view.left - paddingLeft, 0)
                    }
                }
                setOnKeyListener { _, keyCode, event ->
                    if (event.action != KeyEvent.ACTION_DOWN) {
                        return@setOnKeyListener false
                    }
                    if (keyCode == KeyEvent.KEYCODE_MENU ||
                        keyCode == KeyEvent.KEYCODE_DEL ||
                        keyCode == KeyEvent.KEYCODE_FORWARD_DEL
                    ) {
                        listener?.onTabCloseRequested(tab.id)
                        return@setOnKeyListener true
                    }
                    false
                }
            }
            row.addView(chip)
            if (tab.id == preferredFocusTabId) {
                lastFocusedTabId = tab.id
            }
        }
    }

    fun requestPrimaryFocus(): Boolean {
        val preferred = row.findViewWithTag<TabChipView>(lastFocusedTabId)
        return preferred?.requestFocus() ?: row.getChildAt(0)?.requestFocus() ?: requestFocus()
    }
}
