package com.kulchaflo.tv.mk2.ui.chrome

import android.view.View
import android.widget.TextView

class BrowserChromeController(
    private val chromeView: View,
    private val titleView: TextView,
) {
    fun updateTitle(title: String?) {
        titleView.text = title?.takeIf { it.isNotBlank() } ?: "Kulcha Flo TV MkII"
    }

    fun setVisible(visible: Boolean) {
        chromeView.visibility = if (visible) View.VISIBLE else View.GONE
    }
}
