plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "com.kulchaflo.tv.mk2"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.kulchaflo.tv.mk2"
    minSdk = 24
    targetSdk = 35
    versionCode = 1
    versionName = "1.0"
    buildConfigField("String", "DEFAULT_START_URL", "\"https://kulchaflo.com\"")
  }

  buildTypes {
    release {
      isMinifyEnabled = false
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
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.activity:activity-ktx:1.9.2")
  implementation("androidx.webkit:webkit:1.11.0")
  implementation("androidx.media3:media3-exoplayer:1.4.1")
  implementation("androidx.media3:media3-exoplayer-hls:1.4.1")
  implementation("androidx.media3:media3-exoplayer-dash:1.4.1")
}
