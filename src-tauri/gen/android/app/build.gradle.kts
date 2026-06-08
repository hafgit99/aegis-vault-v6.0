import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}
val releaseKeystoreProperties = Properties().apply {
    val configuredPath = System.getenv("AEGISVAULT_ANDROID_SIGNING_PROPERTIES")?.takeIf { it.isNotBlank() }
    if (configuredPath != null) {
        val propFile = file(configuredPath)
        if (propFile.exists()) {
            propFile.inputStream().use { load(it) }
        }
    }
}

fun releaseSigningValue(name: String): String? =
    System.getenv(name)?.takeIf { it.isNotBlank() }
        ?: releaseKeystoreProperties.getProperty(name)?.takeIf { it.isNotBlank() }

val releaseStoreFileValue = releaseSigningValue("RELEASE_STORE_FILE")
val releaseStoreFile = releaseStoreFileValue?.let { value ->
    val explicitFile = file(value)
    if (explicitFile.isAbsolute || explicitFile.exists()) {
        explicitFile
    } else {
        val propertiesPath = System.getenv("AEGISVAULT_ANDROID_SIGNING_PROPERTIES")?.takeIf { it.isNotBlank() }
        val propertiesDir = propertiesPath?.let { file(it).parentFile }
        if (propertiesDir != null) propertiesDir.resolve(value) else explicitFile
    }
}
val hasReleaseSigningConfig = releaseStoreFile?.exists() == true &&
    releaseSigningValue("RELEASE_STORE_PASSWORD") != null &&
    releaseSigningValue("RELEASE_KEY_ALIAS") != null &&
    releaseSigningValue("RELEASE_KEY_PASSWORD") != null

android {
    compileSdk = 36
    namespace = "com.aegisvault.desktop"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "com.aegisvault.desktop"
        minSdk = 28
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    signingConfigs {
        if (hasReleaseSigningConfig) {
            create("release") {
                storeFile = releaseStoreFile
                storePassword = releaseSigningValue("RELEASE_STORE_PASSWORD")
                keyAlias = releaseSigningValue("RELEASE_KEY_ALIAS")
                keyPassword = releaseSigningValue("RELEASE_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            if (hasReleaseSigningConfig) {
                signingConfig = signingConfigs.getByName("release")
            }
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")
