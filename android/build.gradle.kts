// React Native library module for mirror-avatar-sdk.
//
// Consumed by autolinking from a React Native app's Gradle build (see
// react-native.config.js → dependency.platforms.android.sourceDir). It is a standalone
// library module: the `com.facebook.react:react-android` dependency and the Android/Kotlin
// plugin versions resolve from the consuming app's buildscript classpath.

plugins {
  id("com.android.library")
  id("org.jetbrains.kotlin.android")
}

/** SDK levels come from the consuming app's `buildscript { ext { … } }` when present. */
fun appInt(name: String, fallback: Int): Int {
  val ext = rootProject.extensions.extraProperties
  return if (ext.has(name)) ext.get(name).toString().toInt() else fallback
}

android {
  namespace = "com.mirror.avatar"
  compileSdk = appInt("compileSdkVersion", 36)

  defaultConfig {
    minSdk = appInt("minSdkVersion", 24)
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }
}

repositories {
  google()
  mavenCentral()
}

dependencies {
  // Version supplied by the app's React Native Gradle plugin.
  implementation("com.facebook.react:react-android")

  testImplementation("junit:junit:4.13.2")
}
