plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "com.kulchaflo.tv.mk2.gv"
  compileSdk = 36

  flavorDimensions += "device"

  defaultConfig {
    applicationId = "com.kulchaflo.tv.mk2.gv"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "1.0"
    buildConfigField("String", "DEFAULT_START_URL", "\"https://www.kulchaflo.com\"")
  }

  productFlavors {
    create("universal") {
      dimension = "device"
      // Keep emulator/dev flavor behavior aligned with Bravia flavor.
      ndk {
        abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86_64")
      }
    }

    create("bravia") {
      dimension = "device"
      // Bravia is now the source-of-truth flavor config shared with emulator.
      ndk {
        abiFilters += "armeabi-v7a"
      }
    }
  }

  buildTypes {
    debug {
      isMinifyEnabled = false
      isShrinkResources = false
    }

    release {
      isMinifyEnabled = true
      isShrinkResources = true
      signingConfig = signingConfigs.getByName("debug")
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  buildFeatures {
    buildConfig = true
  }

  packaging {
    jniLibs {
      useLegacyPackaging = false
    }
  }

  sourceSets {
    getByName("main") {
      res.srcDirs("src/main/res", "../app/src/main/res")
    }
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.activity:activity-ktx:1.9.2")
  implementation("androidx.media3:media3-exoplayer:1.4.1")
  implementation("androidx.media3:media3-exoplayer-hls:1.4.1")
  implementation("androidx.media3:media3-exoplayer-dash:1.4.1")
  implementation("androidx.media3:media3-ui:1.4.1")
  implementation("org.mozilla.geckoview:geckoview:149.0.20260403140140")
}
