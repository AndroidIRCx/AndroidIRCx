package com.androidircx

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.ReactPackage
import com.google.firebase.FirebaseApp

class MainApplication : Application(), ReactApplication {

  // Temporary ReactNativeHost for PackageList initialization
  private val tempReactNativeHost = object : ReactNativeHost(this) {
    override fun getPackages(): List<ReactPackage> = emptyList()
    override fun getJSMainModuleName(): String = "index"
    override fun getUseDeveloperSupport(): Boolean = false
  }

  override val reactHost: ReactHost by lazy {
      val packages: MutableList<ReactPackage> = try {
      // Try to get packages using PackageList with temporary ReactNativeHost
          PackageList(tempReactNativeHost).getPackages().toMutableList()
    } catch (e: Exception) {
      android.util.Log.e("MainApplication", "Failed to get packages from PackageList: ${e.message}", e)
      // Fallback: return empty list - autolinking via Gradle should handle packages
          mutableListOf()
    }

      // Add our custom package for IRC foreground service
      packages.add(IRCForegroundServicePackage())

    getDefaultReactHost(
      context = applicationContext,
      packageList = packages,
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Initialize Firebase
    FirebaseApp.initializeApp(this)
    loadReactNative(this)
  }
}
