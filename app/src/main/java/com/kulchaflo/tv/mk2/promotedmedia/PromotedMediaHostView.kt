package com.kulchaflo.tv.mk2.promotedmedia

import android.content.Context
import android.util.AttributeSet
import android.view.View
import android.widget.FrameLayout
import androidx.core.content.ContextCompat
import com.kulchaflo.tv.mk2.R
import com.kulchaflo.tv.mk2.util.Logger

class PromotedMediaHostView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : FrameLayout(context, attrs) {

    private val surfaceContainer = FrameLayout(context).apply {
        layoutParams = LayoutParams(
            LayoutParams.MATCH_PARENT,
            LayoutParams.MATCH_PARENT,
        )
    }

    init {
        setBackgroundColor(ContextCompat.getColor(context, R.color.kf_background))
        visibility = GONE
        isFocusable = true
        isFocusableInTouchMode = true
        addView(surfaceContainer)
    }

    fun attachRenderView(view: View) {
        surfaceContainer.removeAllViews()
        surfaceContainer.addView(
            view,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT,
            ),
        )
        bringToFront()
        requestFocus()
        Logger.i(TAG, "player attached renderView=${view.javaClass.simpleName} childCount=${surfaceContainer.childCount}")
    }

    fun detachRenderView() {
        surfaceContainer.removeAllViews()
        Logger.i(TAG, "player detached childCount=${surfaceContainer.childCount}")
    }

    private companion object {
        private const val TAG = "KfPromotedMedia"
    }
}
