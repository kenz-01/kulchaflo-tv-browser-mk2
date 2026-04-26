package com.kulchaflo.tv.mk2.ui.pointer

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat
import com.kulchaflo.tv.mk2.R
import kotlin.math.roundToInt

class PointerOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2.5f * resources.displayMetrics.density
        color = ContextCompat.getColor(context, R.color.kf_pointer_ring)
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = ContextCompat.getColor(context, R.color.kf_pointer_fill)
    }
    private val accentPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = ContextCompat.getColor(context, R.color.kf_pointer_accent)
    }

    private var pointerX = 0f
    private var pointerY = 0f
    private var pointerVisible = false
    private var pointerPressed = false

    fun showAt(x: Float, y: Float) {
        pointerVisible = true
        pointerX = x
        pointerY = y
        invalidate()
    }

    fun updatePosition(x: Float, y: Float) {
        pointerX = x
        pointerY = y
        invalidate()
    }

    fun setPointerPressed(pressed: Boolean) {
        if (pointerPressed == pressed) return
        pointerPressed = pressed
        invalidate()
    }

    fun hidePointer() {
        if (!pointerVisible) return
        pointerVisible = false
        pointerPressed = false
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (!pointerVisible) return

        val density = resources.displayMetrics.density
        val outerRadius = 11f * density
        val innerRadius = 3.5f * density
        val accentRadius = if (pointerPressed) 6.5f * density else 0f

        canvas.drawCircle(pointerX, pointerY, outerRadius, ringPaint)
        canvas.drawCircle(pointerX, pointerY, innerRadius, fillPaint)
        if (pointerPressed) {
            accentPaint.alpha = 115
            canvas.drawCircle(pointerX, pointerY, accentRadius, accentPaint)
            accentPaint.alpha = 255
        }
    }

    override fun hasOverlappingRendering(): Boolean = false

    fun isPointerVisible(): Boolean = pointerVisible

    override fun toString(): String {
        return "PointerOverlayView(x=${pointerX.roundToInt()}, y=${pointerY.roundToInt()}, visible=$pointerVisible)"
    }
}
