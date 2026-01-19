@file:Suppress("DEPRECATION")
package com.androidircx

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.ReactPackage
import com.google.firebase.FirebaseApp

class MainApplication : Application(), ReactApplication {

    companion object {
        private const val TAG = "MainApplication"
    }

  // Temporary ReactNativeHost for PackageList initialization
  private val tempReactNativeHost = object : ReactNativeHost(this) {
    override fun getPackages(): List<ReactPackage> = emptyList()
    override fun getJSMainModuleName(): String = "index"
    override fun getUseDeveloperSupport(): Boolean = false
  }

  override val reactHost: ReactHost by lazy {
      try {
          Log.d(TAG, "Initializing ReactHost...")

          // Pre-check: Verify critical classes are available before proceeding
          try {
              Class.forName("com.facebook.react.PackageList")
              Class.forName("com.facebook.react.defaults.DefaultReactHost")
              Log.d(TAG, "Critical React Native classes verified")
          } catch (e: ClassNotFoundException) {
              Log.e(TAG, "CRITICAL: Required React Native class not found: ${e.message}", e)
              // Report to Crashlytics if available (safely)
              reportToCrashlyticsSafely(e)
              throw RuntimeException("React Native classes not available", e)
          }

      val packages: MutableList<ReactPackage> = try {
          Log.d(TAG, "Loading packages from PackageList...")
          // Try to get packages using PackageList with temporary ReactNativeHost
          val packageList = PackageList(tempReactNativeHost)
          val loadedPackages = packageList.getPackages().toMutableList()
          Log.d(TAG, "Successfully loaded ${loadedPackages.size} packages from PackageList")
          loadedPackages
      } catch (e: NoClassDefFoundError) {
          Log.e(TAG, "CRITICAL: NoClassDefFoundError loading PackageList: ${e.message}", e)
          // Report to Crashlytics safely
          reportToCrashlyticsSafely(e)
          // Fallback: return empty list - autolinking via Gradle should handle packages
          Log.w(TAG, "Falling back to empty package list - autolinking should handle packages")
          mutableListOf()
      } catch (e: Exception) {
          Log.e(TAG, "Failed to get packages from PackageList: ${e.message}", e)
          // Report to Crashlytics safely
          reportToCrashlyticsSafely(e)
          // Fallback: return empty list - autolinking via Gradle should handle packages
          mutableListOf()
      }

      // Add our custom package for IRC foreground service
          try {
              packages.add(IRCForegroundServicePackage())
              Log.d(TAG, "Added IRCForegroundServicePackage")
          } catch (e: Exception) {
              Log.e(TAG, "Failed to add IRCForegroundServicePackage: ${e.message}", e)
              // Don't fail completely if custom package fails
          }

          // Add our custom package for Play Integrity API
          try {
              packages.add(PlayIntegrityPackage())
              Log.d(TAG, "Added PlayIntegrityPackage")
          } catch (e: Exception) {
              Log.e(TAG, "Failed to add PlayIntegrityPackage: ${e.message}", e)
              // Don't fail completely if custom package fails
          }

          // Add our custom package for HTTP POST requests
          try {
              packages.add(HttpPostPackage())
              Log.d(TAG, "Added HttpPostPackage")
          } catch (e: Exception) {
              Log.e(TAG, "Failed to add HttpPostPackage: ${e.message}", e)
              // Don't fail completely if custom package fails
          }

          // Add our custom package for HTTP PUT requests
          try {
              packages.add(HttpPutPackage())
              Log.d(TAG, "Added HttpPutPackage")
          } catch (e: Exception) {
              Log.e(TAG, "Failed to add HttpPutPackage: ${e.message}", e)
              // Don't fail completely if custom package fails
          }

          Log.d(TAG, "Creating ReactHost with ${packages.size} packages...")
          val host = getDefaultReactHost(
              context = applicationContext,
              packageList = packages,
          )
          Log.d(TAG, "ReactHost created successfully")
          host
      } catch (e: Exception) {
          Log.e(TAG, "CRITICAL: Failed to initialize ReactHost: ${e.message}", e)
          // Report to Crashlytics safely
          reportToCrashlyticsSafely(e)
          // Re-throw to prevent app from starting in broken state
          throw RuntimeException("Failed to initialize React Native", e)
      }
  }

    /**
     * Safely report exception to Crashlytics.
     * This method handles all possible exceptions to prevent secondary crashes.
     */
    private fun reportToCrashlyticsSafely(exception: Throwable) {
        try {
            // Check if Firebase is initialized
            if (!FirebaseApp.getApps(this).isEmpty()) {
                try {
                    val crashlytics =
                        com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance()
                    crashlytics.recordException(exception)
                    Log.d(TAG, "Exception reported to Crashlytics")
                } catch (e: NoClassDefFoundError) {
                    // Crashlytics classes not available - likely ProGuard issue
                    Log.w(TAG, "Crashlytics classes not found (ProGuard issue?): ${e.message}")
                } catch (e: Exception) {
                    // Any other error reporting to Crashlytics - don't fail
                    Log.w(TAG, "Failed to report to Crashlytics: ${e.message}")
                }
            } else {
                Log.d(TAG, "Firebase not initialized, skipping Crashlytics report")
            }
        } catch (e: Exception) {
            // Even checking Firebase can fail - don't propagate
            Log.w(TAG, "Failed to check Firebase status: ${e.message}")
        }
    }

  override fun onCreate() {
    super.onCreate()
      Log.d(TAG, "Application onCreate started")

      try {
          // Initialize Firebase first (before React Native)
          Log.d(TAG, "Initializing Firebase...")
          FirebaseApp.initializeApp(this)
          Log.d(TAG, "Firebase initialized successfully")

          // Enable Crashlytics collection (disabled by default in debug builds)
          try {
              val crashlytics = com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance()
              // Set custom keys for better crash reporting
              crashlytics.setCustomKey("app_version", "1.6.0")
              crashlytics.setCustomKey("build_number", "61")
              Log.d(TAG, "Crashlytics configured successfully")
          } catch (e: Exception) {
              Log.w(TAG, "Failed to configure Crashlytics: ${e.message}", e)
              // Don't fail - Crashlytics is optional
          }
      } catch (e: Exception) {
          Log.e(TAG, "Failed to initialize Firebase: ${e.message}", e)
          // Don't fail completely - Firebase is optional for basic functionality
          // Don't try to report to Crashlytics here as it might not be initialized yet
      }

      try {
          // Initialize React Native
          Log.d(TAG, "Loading React Native...")
          loadReactNative(this)
          Log.d(TAG, "React Native loaded successfully")
      } catch (e: com.facebook.soloader.SoLoaderDSONotFoundError) {
          Log.e(TAG, "CRITICAL: Native library not found: ${e.message}", e)
          reportToCrashlyticsSafely(e)
          // Try to provide more context about the ABI
          try {
              val abi = android.os.Build.SUPPORTED_ABIS.joinToString(", ")
              Log.e(TAG, "Device supported ABIs: $abi")
          } catch (ignored: Exception) {
          }
          // Re-throw - app cannot function without native libraries
          throw RuntimeException("Native library not found - please reinstall the app", e)
      } catch (e: UnsatisfiedLinkError) {
          Log.e(TAG, "CRITICAL: Failed to link native library: ${e.message}", e)
          reportToCrashlyticsSafely(e)
          throw RuntimeException("Native library linking failed - please reinstall the app", e)
      } catch (e: Exception) {
          Log.e(TAG, "CRITICAL: Failed to load React Native: ${e.message}", e)
          // Report to Crashlytics safely
          reportToCrashlyticsSafely(e)
          // Re-throw - app cannot function without React Native
          throw RuntimeException("Failed to load React Native", e)
      }

      Log.d(TAG, "Application onCreate completed")
  }
}
