package com.kulchaflo.tv.mk2.ui.tabs

import android.content.Context
import android.util.AttributeSet
import android.util.TypedValue
import android.view.Gravity
import android.text.TextUtils
import androidx.appcompat.widget.AppCompatTextView
import androidx.core.content.ContextCompat
import com.kulchaflo.tv.mk2.R

class TabChipView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : AppCompatTextView(context, attrs) {

    init {
        gravity = Gravity.CENTER_VERTICAL
        maxLines = 1
        isAllCaps = false
        isFocusable = true
        isFocusableInTouchMode = true
        setTextColor(ContextCompat.getColor(context, R.color.kf_text_primary))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        setPadding(28, 18, 28, 18)
        ellipsize = TextUtils.TruncateAt.END
        minWidth = 240
        background = ContextCompat.getDrawable(context, R.drawable.tab_chip_background)
    }

    fun bind(title: String, isActive: Boolean) {
        text = if (isActive) "$title  \u2022" else title
        isSelected = isActive
        alpha = if (isActive) 1.0f else 0.9f
    }
}
