import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Optional release signing: provide keystore.properties (storeFile, storePassword,
// keyAlias, keyPassword) or the OSH_KEYSTORE_* environment variables. Without
// them the release build is signed with the debug key so it can still be sideloaded.
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
// CI passes unset secrets as empty strings, so blank counts as "not provided"
fun signingValue(key: String, env: String): String? =
    (keystoreProps.getProperty(key) ?: System.getenv(env))?.takeIf { it.isNotBlank() }

android {
    namespace = "com.openspookyhouse.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.openspookyhouse.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "CAST_APP_ID", "\"${providers.gradleProperty("oshCastAppId").getOrElse("")}\"")
    }

    signingConfigs {
        val storeFile = signingValue("storeFile", "OSH_KEYSTORE_FILE")
        if (storeFile != null) {
            create("release") {
                this.storeFile = file(storeFile)
                storePassword = signingValue("storePassword", "OSH_KEYSTORE_PASSWORD")
                keyAlias = signingValue("keyAlias", "OSH_KEY_ALIAS")
                keyPassword = signingValue("keyPassword", "OSH_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    // Only 64-bit ARM phones are targeted, but the app has no native code,
    // so it runs on every ABI anyway.
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
    lint {
        // Report problems (uploaded by CI) without failing the build
        abortOnError = false
        checkReleaseBuilds = false
    }
    androidResources {
        // The web assets are already compressed where it matters
        noCompress += listOf("png")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.mediarouter:mediarouter:1.7.0")
    implementation("com.google.android.gms:play-services-cast-framework:22.1.0")
}
