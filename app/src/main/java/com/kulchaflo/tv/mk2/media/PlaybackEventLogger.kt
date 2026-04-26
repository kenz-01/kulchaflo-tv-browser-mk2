package com.kulchaflo.tv.mk2.media

import com.kulchaflo.tv.mk2.util.Logger

class PlaybackEventLogger {
    fun log(event: String, diagnostics: PlaybackDiagnostics = PlaybackDiagnostics()) {
        Logger.d("Playback", "$event diagnostics=$diagnostics")
    }
}
