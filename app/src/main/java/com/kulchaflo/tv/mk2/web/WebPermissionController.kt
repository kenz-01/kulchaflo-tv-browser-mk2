package com.kulchaflo.tv.mk2.web

import android.webkit.PermissionRequest

class WebPermissionController {
    fun handle(request: PermissionRequest?) {
        // TODO: Gate camera/mic/file permissions deliberately when needed.
        request?.deny()
    }
}
