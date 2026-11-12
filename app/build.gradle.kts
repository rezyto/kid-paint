plugins {
    id("com.android.application")
}

// Cada compilação no GitHub tem um número novo -> a app sabe quando há uma versão mais recente.
val buildNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
val updateRepo = System.getenv("GITHUB_REPOSITORY") ?: "rezyto/kid-paint"

android {
    namespace = "pt.pintacomigo.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "pt.pintacomigo.app"
        minSdk = 24
        targetSdk = 34
        versionCode = buildNumber
        versionName = "1.$buildNumber"
        buildConfigField("String", "UPDATE_REPO", "\"$updateRepo\"")
    }

    // A mesma chave em todas as versões: é isto que permite atualizar sem desinstalar (e sem perder os desenhos).
    signingConfigs {
        create("release") {
            storeFile = file("pintacomigo.keystore")
            storePassword = "pintacomigo"
            keyAlias = "pintacomigo"
            keyPassword = "pintacomigo"
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("release")
        }
    }
    buildFeatures { buildConfig = true }
    sourceSets["main"].assets.srcDirs("../web")
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    lint { abortOnError = false; checkReleaseBuilds = false }
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.core:core:1.13.1")
}
