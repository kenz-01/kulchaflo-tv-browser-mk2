package com.kulchaflo.tv.mk2.gv.ui.pointer

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import kotlin.math.roundToInt

class PointerOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 0.85f * resources.displayMetrics.density
        color = 0xFFF3F4F6.toInt()
    }

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = 0xFF11161A.toInt()
    }

    private val accentPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = 0xFFD9B15F.toInt()
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

    fun isPointerVisible(): Boolean = pointerVisible

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (!pointerVisible) return

        val density = resources.displayMetrics.density
        val outerRadius = 11f * density
        val innerRadius = 3f * density
        val accentRadius = if (pointerPressed) 5.5f * density else 0f

        canvas.drawCircle(pointerX, pointerY, outerRadius, ringPaint)
        canvas.drawCircle(pointerX, pointerY, innerRadius, fillPaint)
        if (pointerPressed) {
            accentPaint.alpha = 125
            canvas.drawCircle(pointerX, pointerY, accentRadius, accentPaint)
            accentPaint.alpha = 255
        }
    }

    override fun hasOverlappingRendering(): Boolean = false

    override fun toString(): String {
        return "PointerOverlayView(x=${pointerX.roundToInt()}, y=${pointerY.roundToInt()}, visible=$pointerVisible)"
    }
}
