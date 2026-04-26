package com.kulchaflo.tv.mk2.app

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import com.kulchaflo.tv.mk2.util.Logger

class KfApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
        Logger.i("App", "Kulcha Flo TV MkII application created")
    }
}
