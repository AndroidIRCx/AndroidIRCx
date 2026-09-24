package com.androidircx

import com.dokar.quickjs.QuickJs
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import org.json.JSONTokener
import org.json.JSONObject

/**
 * Hosts imported addons in independent QuickJS runtimes. No React Native,
 * Android, network, filesystem, timer, or application objects are injected.
 */
class AddonRuntimeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val API_VERSION = 1
        private const val MAX_SOURCE_BYTES = 5 * 1024 * 1024
        private const val MAX_PAYLOAD_BYTES = 1024 * 1024
        private val ADDON_ID = Regex("^[a-z0-9]+(?:[.-][a-z0-9]+)*$")
        private val HOOK_NAME = Regex("^[A-Za-z_$][A-Za-z0-9_$]*$")
        private val SAFE_FILENAME = Regex("^(?!/)(?![A-Za-z]:)(?!.*(?:^|/)\\.\\.(?:/|$))[^\\u0000\\\\]{1,240}$")
    }

    private data class RuntimeEntry(
        val addonId: String,
        val quickJs: QuickJs,
        val maxQueuedHooks: Int,
        val permits: Semaphore,
        val queuedHooks: AtomicInteger = AtomicInteger(0),
    )

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Default + job)
    private val runtimes = ConcurrentHashMap<String, RuntimeEntry>()

    override fun getName(): String = "AndroidIRCXAddonRuntime"

    @ReactMethod
    fun getSecurityFeatures(promise: Promise) {
        promise.resolve(
            Arguments.createMap().apply {
                putInt("apiVersion", API_VERSION)
                putBoolean("isolatedGlobals", true)
                putBoolean("memoryLimit", true)
                putBoolean("stackLimit", true)
                putBoolean("interruptHandler", true)
            },
        )
    }

    @ReactMethod
    fun createRuntime(request: ReadableMap, promise: Promise) {
        scope.launch {
            var quickJs: QuickJs? = null
            try {
                val addonId = request.requiredString("addonId")
                val source = request.requiredString("source")
                val filename = request.requiredString("filename")
                val limits = request.getMap("limits")
                    ?: throw IllegalArgumentException("Runtime limits are required")

                require(ADDON_ID.matches(addonId)) { "Invalid addon id" }
                require(SAFE_FILENAME.matches(filename)) { "Invalid addon filename" }
                require(source.toByteArray(Charsets.UTF_8).size <= MAX_SOURCE_BYTES) {
                    "Addon source is too large"
                }

                val memoryBytes = limits.boundedLong("memoryBytes", 1024 * 1024L, 64 * 1024 * 1024L)
                val stackBytes = limits.boundedLong("stackBytes", 64 * 1024L, 2 * 1024 * 1024L)
                val deadlineMs = limits.boundedLong("hookDeadlineMs", 10L, 5_000L)
                val maxQueuedHooks = limits.boundedInt("maxQueuedHooks", 1, 256)
                limits.boundedInt("maxTimers", 1, 256)
                // Promise results are deliberately disabled in API v1. Validate
                // the declared future limit, but serialize all access to the
                // single native context even if a caller queues concurrently.
                limits.boundedInt("maxConcurrentAsync", 1, 32)

                quickJs = QuickJs.create(Dispatchers.Default).apply {
                    memoryLimit = memoryBytes
                    maxStackSize = stackBytes
                    evaluationTimeoutMillis = deadlineMs
                }
                quickJs.evaluate<Unit>(wrapCommonJs(source), filename)

                val runtimeId = UUID.randomUUID().toString()
                runtimes[runtimeId] = RuntimeEntry(
                    addonId = addonId,
                    quickJs = quickJs,
                    maxQueuedHooks = maxQueuedHooks,
                    permits = Semaphore(1),
                )
                quickJs = null
                promise.resolve(runtimeId)
            } catch (error: Throwable) {
                quickJs?.close()
                promise.reject("addon_runtime_create_failed", error.message, error)
            }
        }
    }

    @ReactMethod
    fun invokeHook(runtimeId: String, request: ReadableMap, promise: Promise) {
        val entry = runtimes[runtimeId]
        if (entry == null) {
            promise.reject("addon_runtime_missing", "Unknown addon runtime")
            return
        }
        if (entry.queuedHooks.incrementAndGet() > entry.maxQueuedHooks) {
            entry.queuedHooks.decrementAndGet()
            promise.reject("addon_hook_queue_full", "Addon hook queue limit exceeded")
            return
        }

        scope.launch {
            try {
                entry.permits.withPermit {
                    val hook = request.requiredString("hook")
                    val payloadJson = request.requiredString("payloadJson")
                    require(HOOK_NAME.matches(hook)) { "Invalid addon hook name" }
                    require(payloadJson.toByteArray(Charsets.UTF_8).size <= MAX_PAYLOAD_BYTES) {
                        "Addon hook payload is too large"
                    }
                    val payloadParser = JSONTokener(payloadJson)
                    payloadParser.nextValue()
                    require(payloadParser.nextClean().code == 0) {
                        "Addon hook payload contains trailing content"
                    }
                    val result = entry.quickJs.evaluate<String?>(
                        hookInvocation(hook, payloadJson),
                        "androidircx-hook.js",
                    )
                    require(
                        result == null ||
                            result.toByteArray(Charsets.UTF_8).size <= MAX_PAYLOAD_BYTES,
                    ) { "Addon hook result is too large" }
                    promise.resolve(
                        Arguments.createMap().apply {
                            if (result != null) putString("resultJson", result)
                        },
                    )
                }
            } catch (error: Throwable) {
                promise.reject("addon_hook_failed", error.message, error)
            } finally {
                entry.queuedHooks.decrementAndGet()
            }
        }
    }

    @ReactMethod
    fun disposeRuntime(runtimeId: String, promise: Promise) {
        scope.launch {
            try {
                runtimes.remove(runtimeId)?.quickJs?.let { quickJs ->
                    runCatching { quickJs.interruptEvaluation() }
                    quickJs.close()
                }
                promise.resolve(null)
            } catch (error: Throwable) {
                promise.reject("addon_runtime_dispose_failed", error.message, error)
            }
        }
    }

    override fun invalidate() {
        super.invalidate()
        runtimes.values.forEach { entry ->
            runCatching { entry.quickJs.interruptEvaluation() }
            runCatching { entry.quickJs.close() }
        }
        runtimes.clear()
        scope.cancel()
    }

    private fun wrapCommonJs(source: String): String = """
        "use strict";
        const __androidircxEventHandlers = Object.create(null);
        const __androidircxSubscriptions = [];
        const api = Object.freeze({
          events: Object.freeze({
            on(filter, handler) {
              if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
                throw new Error("Event filter must be an object");
              }
              if (typeof handler !== "function") {
                throw new Error("Event handler must be a function");
              }
              if (__androidircxSubscriptions.length >= 32) {
                throw new Error("Event subscription limit exceeded");
              }
              const serialized = JSON.stringify(filter);
              if (serialized.length > 16384) {
                throw new Error("Event filter is too large");
              }
              const safeFilter = JSON.parse(serialized);
              const hook = "__event" + __androidircxSubscriptions.length;
              __androidircxEventHandlers[hook] = handler;
              __androidircxSubscriptions.push({ hook, filter: safeFilter });
              return hook;
            },
          }),
        });
        const module = { exports: Object.create(null) };
        const exports = module.exports;
        (function(module, exports, api) {
        $source
        })(module, exports, api);
        globalThis.__androidircxAddon =
          module.exports && module.exports.default !== undefined
            ? module.exports.default
            : module.exports;
        globalThis.__androidircxEventHandlers = __androidircxEventHandlers;
        globalThis.__androidircxSubscriptions = __androidircxSubscriptions;
    """.trimIndent()

    private fun hookInvocation(hook: String, payloadJson: String): String = """
        (() => {
          "use strict";
          const addon = globalThis.__androidircxAddon;
          if (${JSONObject.quote(hook)} === "__androidircxSubscriptions") {
            return JSON.stringify(globalThis.__androidircxSubscriptions || []);
          }
          const fn =
            (globalThis.__androidircxEventHandlers &&
              globalThis.__androidircxEventHandlers[${JSONObject.quote(hook)}]) ||
            (addon && addon[${JSONObject.quote(hook)}]);
          if (typeof fn !== "function") return undefined;
          const value = fn(JSON.parse(${JSONObject.quote(payloadJson)}));
          if (value && typeof value.then === "function") {
            throw new Error("Async hook results are not enabled");
          }
          return value === undefined ? undefined : JSON.stringify(value);
        })()
    """.trimIndent()

    private fun ReadableMap.requiredString(name: String): String =
        getString(name)?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("$name is required")

    private fun ReadableMap.boundedLong(name: String, minimum: Long, maximum: Long): Long {
        val value = getDouble(name)
        require(value.isFinite() && value % 1.0 == 0.0) { "$name must be an integer" }
        val converted = value.toLong()
        require(converted in minimum..maximum) { "$name is outside the allowed range" }
        return converted
    }

    private fun ReadableMap.boundedInt(name: String, minimum: Int, maximum: Int): Int =
        boundedLong(name, minimum.toLong(), maximum.toLong()).toInt()
}
