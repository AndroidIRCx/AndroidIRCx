@file:Suppress("DEPRECATION")
package com.androidircx

import android.app.Application
import android.util.Log
import java.io.File
import java.io.FileInputStream
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
        private const val SOLOADER_BACKUP_DIR = "lib-main"
        private const val ELF_MACHINE_ARM = 40
        private const val ELF_MACHINE_AARCH64 = 183
        private const val ELF_MACHINE_X86 = 3
        private const val ELF_MACHINE_X86_64 = 62
    }

  // Temporary ReactNativeHost for PackageList initialization
  private val tempReactNativeHost = object : ReactNativeHost(this@MainApplication) {
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
      } catch (e: Throwable) {
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
          } catch (e: Throwable) {
              Log.e(TAG, "Failed to add IRCForegroundServicePackage: ${e.message}", e)
              // Don't fail completely if custom package fails
          }

          // Add our custom package for Play Integrity API
          try {
              packages.add(PlayIntegrityPackage())
              Log.d(TAG, "Added PlayIntegrityPackage")
          } catch (e: Throwable) {
              Log.e(TAG, "Failed to add PlayIntegrityPackage: ${e.message}", e)
              // Don't fail completely if custom package fails
          }

          // Add our custom package for Play Age Signals API
          try {
              packages.add(PlayAgeSignalsPackage())
              Log.d(TAG, "Added PlayAgeSignalsPackage")
          } catch (e: Throwable) {
              Log.e(TAG, "Failed to add PlayAgeSignalsPackage: ${e.message}", e)
              // Don't fail completely if custom package fails
          }

          // Add our custom package for HTTP POST requests
          try {
              packages.add(HttpPostPackage())
              Log.d(TAG, "Added HttpPostPackage")
          } catch (e: Throwable) {
              Log.e(TAG, "Failed to add HttpPostPackage: ${e.message}", e)
              // Don't fail completely if custom package fails
          }

          // Add our custom package for HTTP PUT requests
          try {
              packages.add(HttpPutPackage())
              Log.d(TAG, "Added HttpPutPackage")
          } catch (e: Throwable) {
              Log.e(TAG, "Failed to add HttpPutPackage: ${e.message}", e)
              // Don't fail completely if custom package fails
          }

          // Add our custom package for Audio Focus management
          try {
              packages.add(AudioFocusPackage())
              Log.d(TAG, "Added AudioFocusPackage")
          } catch (e: Throwable) {
              Log.e(TAG, "Failed to add AudioFocusPackage: ${e.message}", e)
              // Don't fail completely if custom package fails
          }

          // Add our custom package for runtime screenshot protection toggle
          try {
              packages.add(ScreenshotProtectionPackage())
              Log.d(TAG, "Added ScreenshotProtectionPackage")
          } catch (e: Throwable) {
              Log.e(TAG, "Failed to add ScreenshotProtectionPackage: ${e.message}", e)
              // Don't fail completely if custom package fails
          }

          Log.d(TAG, "Creating ReactHost with ${packages.size} packages...")
          val host = getDefaultReactHost(
              context = applicationContext,
              packageList = packages,
          )
          Log.d(TAG, "ReactHost created successfully")
          host
      } catch (e: Throwable) {
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
                } catch (e: Throwable) {
                    // Any other error reporting to Crashlytics - don't fail
                    Log.w(TAG, "Failed to report to Crashlytics: ${e.message}")
                }
            } else {
                Log.d(TAG, "Firebase not initialized, skipping Crashlytics report")
            }
        } catch (e: Throwable) {
            // Even checking Firebase can fail - don't propagate
            Log.w(TAG, "Failed to check Firebase status: ${e.message}")
        }
    }

    private fun logNativeDiagnostics(stage: String) {
        try {
            val abis = android.os.Build.SUPPORTED_ABIS.joinToString(", ")
            Log.d(TAG, "[$stage] Device ABIs: $abis")
        } catch (e: Throwable) {
            Log.w(TAG, "[$stage] Failed to read supported ABIs: ${e.message}")
        }

        try {
            val nativeDir = applicationInfo?.nativeLibraryDir ?: "unknown"
            val nativeDirFile = File(nativeDir)
            val nativeFiles = nativeDirFile.listFiles()
            val nativeList = nativeFiles?.joinToString(", ") { it.name } ?: "none"
            Log.d(TAG, "[$stage] nativeLibraryDir=$nativeDir (exists=${nativeDirFile.exists()})")
            Log.d(TAG, "[$stage] native libs: $nativeList")
        } catch (e: Throwable) {
            Log.w(TAG, "[$stage] Failed to list native libs: ${e.message}")
        }
    }

    private fun logReactNativeClassDiagnostics(stage: String, includeNative: Boolean = false) {
        val classNames = mutableListOf(
            "com.facebook.react.PackageList",
            "com.facebook.react.ReactNativeApplicationEntryPoint",
            "com.facebook.react.defaults.DefaultReactHost"
        )
        if (includeNative) {
            classNames.add("com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsCxxInterop")
        }
        classNames.forEach { className ->
            try {
                Class.forName(className)
                Log.d(TAG, "[$stage] Class OK: $className")
            } catch (e: Throwable) {
                Log.e(TAG, "[$stage] Class check failed: $className (${e.message})", e)
                // Do not send these diagnostic probes to Crashlytics. Some Android/RN
                // startup paths can throw a stackless NoClassDefFoundError while the
                // runtime is still loading classes, and recording that probe creates a
                // misleading production issue even when startup continues successfully.
            }
        }
    }

    private fun recordCrashlyticsKeys() {
        try {
            val crashlytics = com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance()
            crashlytics.setCustomKey("app_version", BuildConfig.VERSION_NAME)
            crashlytics.setCustomKey("build_number", BuildConfig.VERSION_CODE)
            crashlytics.setCustomKey(
                "device_abis",
                android.os.Build.SUPPORTED_ABIS.joinToString(", ")
            )
            crashlytics.setCustomKey(
                "native_lib_dir",
                applicationInfo?.nativeLibraryDir ?: "unknown"
            )
            crashlytics.setCustomKey("new_arch_enabled", true)
        } catch (e: Throwable) {
            Log.w(TAG, "Failed to set Crashlytics diagnostic keys: ${e.message}")
        }
    }

    private fun expectedElfMachineForRuntime(): Pair<String, Int>? {
        val nativeDir = try {
            applicationInfo?.nativeLibraryDir.orEmpty()
        } catch (e: Throwable) {
            ""
        }

        val abi = when {
            nativeDir.contains("arm64-v8a") -> "arm64-v8a"
            nativeDir.contains("armeabi-v7a") -> "armeabi-v7a"
            nativeDir.contains("x86_64") -> "x86_64"
            nativeDir.contains("x86") -> "x86"
            else -> try {
                android.os.Build.SUPPORTED_ABIS.firstOrNull()
            } catch (e: Throwable) {
                null
            }
        } ?: return null

        val machine = when (abi) {
            "armeabi-v7a" -> ELF_MACHINE_ARM
            "arm64-v8a" -> ELF_MACHINE_AARCH64
            "x86" -> ELF_MACHINE_X86
            "x86_64" -> ELF_MACHINE_X86_64
            else -> return null
        }
        return abi to machine
    }

    private fun readElfMachine(file: File): Int? {
        return try {
            val header = ByteArray(20)
            FileInputStream(file).use { stream ->
                val read = stream.read(header)
                if (read < header.size) {
                    return null
                }
            }

            if (
                header[0] != 0x7f.toByte() ||
                header[1] != 'E'.code.toByte() ||
                header[2] != 'L'.code.toByte() ||
                header[3] != 'F'.code.toByte()
            ) {
                return null
            }

            val littleEndian = header[5].toInt() == 1
            val first = header[18].toInt() and 0xff
            val second = header[19].toInt() and 0xff
            if (littleEndian) {
                first or (second shl 8)
            } else {
                (first shl 8) or second
            }
        } catch (e: Throwable) {
            Log.w(TAG, "Failed to read ELF header for ${file.name}: ${e.message}")
            null
        }
    }

    private fun machineName(machine: Int?): String {
        return when (machine) {
            ELF_MACHINE_ARM -> "armeabi-v7a"
            ELF_MACHINE_AARCH64 -> "arm64-v8a"
            ELF_MACHINE_X86 -> "x86"
            ELF_MACHINE_X86_64 -> "x86_64"
            null -> "unknown"
            else -> "machine-$machine"
        }
    }

    private fun clearSoLoaderBackupCache(reason: String): Boolean {
        val dataDir = try {
            applicationInfo?.dataDir
        } catch (e: Throwable) {
            null
        } ?: return false

        val backupDir = File(dataDir, SOLOADER_BACKUP_DIR)
        if (!backupDir.exists()) {
            return false
        }

        return try {
            val deleted = backupDir.deleteRecursively()
            Log.w(TAG, "Cleared SoLoader backup cache ($reason): deleted=$deleted")
            deleted
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to clear SoLoader backup cache ($reason): ${e.message}", e)
            false
        }
    }

    private fun clearStaleSoLoaderCacheIfNeeded(stage: String) {
        val expected = expectedElfMachineForRuntime() ?: return
        val dataDir = try {
            applicationInfo?.dataDir
        } catch (e: Throwable) {
            null
        } ?: return

        val backupDir = File(dataDir, SOLOADER_BACKUP_DIR)
        if (!backupDir.exists()) {
            return
        }

        val criticalLibraries = listOf(
            "libc++_shared.so",
            "libreactnative.so",
            "libhermesvm.so",
            "libfbjni.so",
            "libjsi.so"
        )

        for (library in criticalLibraries) {
            val cachedLibrary = File(backupDir, library)
            if (!cachedLibrary.exists()) {
                continue
            }

            val actualMachine = readElfMachine(cachedLibrary)
            if (actualMachine != null && actualMachine != expected.second) {
                clearSoLoaderBackupCache(
                    "$stage: $library is ${machineName(actualMachine)}; expected ${expected.first}"
                )
                return
            }
        }
    }

    private fun isNativeLoadFailure(error: Throwable): Boolean {
        var current: Throwable? = error
        while (current != null) {
            if (
                current is com.facebook.soloader.SoLoaderDSONotFoundError ||
                current is UnsatisfiedLinkError
            ) {
                return true
            }

            val className = current.javaClass.name
            val message = current.message.orEmpty()
            if (
                className.startsWith("com.facebook.soloader.") ||
                message.contains("couldn't find DSO to load", ignoreCase = true) ||
                message.contains("dlopen failed", ignoreCase = true) ||
                message.contains(SOLOADER_BACKUP_DIR, ignoreCase = true) ||
                message.contains("Native library", ignoreCase = true)
            ) {
                return true
            }

            current = current.cause
        }
        return false
    }

    private fun loadReactNativeWithNativeCacheRecovery() {
        clearStaleSoLoaderCacheIfNeeded("before React Native load")

        try {
            loadReactNative(this)
            return
        } catch (e: Throwable) {
            if (!isNativeLoadFailure(e)) {
                throw e
            }

            Log.e(TAG, "Native load failed; clearing SoLoader cache before one retry", e)
            reportToCrashlyticsSafely(e)
            val cleared = clearSoLoaderBackupCache("React Native native load failure")
            if (!cleared) {
                throw e
            }

            try {
                loadReactNative(this)
                Log.d(TAG, "React Native loaded after clearing SoLoader backup cache")
                return
            } catch (retryError: Throwable) {
                retryError.addSuppressed(e)
                throw retryError
            }
        }
    }

  override fun onCreate() {
    super.onCreate()
      Log.d(TAG, "Application onCreate started")
      logNativeDiagnostics("onCreate:begin")
      logReactNativeClassDiagnostics("onCreate:begin", includeNative = false)

      try {
          // Initialize Firebase first (before React Native)
          Log.d(TAG, "Initializing Firebase...")
          FirebaseApp.initializeApp(this)
          Log.d(TAG, "Firebase initialized successfully")

          // Enable Crashlytics collection (disabled by default in debug builds)
          try {
              val crashlytics = com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance()
              // Set custom keys for better crash reporting
              recordCrashlyticsKeys()
              Log.d(TAG, "Crashlytics configured successfully")
          } catch (e: Throwable) {
              Log.w(TAG, "Failed to configure Crashlytics: ${e.message}", e)
              // Don't fail - Crashlytics is optional
          }
      } catch (e: Throwable) {
          Log.e(TAG, "Failed to initialize Firebase: ${e.message}", e)
          // Don't fail completely - Firebase is optional for basic functionality
          // Don't try to report to Crashlytics here as it might not be initialized yet
      }

      try {
          // Initialize React Native
          Log.d(TAG, "Loading React Native...")
          loadReactNativeWithNativeCacheRecovery()
          Log.d(TAG, "React Native loaded successfully")
          logNativeDiagnostics("onCreate:afterRN")
          logReactNativeClassDiagnostics("onCreate:afterRN", includeNative = true)
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
      } catch (e: Throwable) {
          Log.e(TAG, "CRITICAL: Failed to load React Native: ${e.message}", e)
          // Report to Crashlytics safely
          reportToCrashlyticsSafely(e)
          // Re-throw - app cannot function without React Native
          throw RuntimeException("Failed to load React Native", e)
      }

      Log.d(TAG, "Application onCreate completed")
  }
}
