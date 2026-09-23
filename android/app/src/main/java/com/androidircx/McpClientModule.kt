package com.androidircx

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.modelcontextprotocol.kotlin.sdk.client.Client
import io.modelcontextprotocol.kotlin.sdk.client.mcpStreamableHttp
import io.modelcontextprotocol.kotlin.sdk.types.TextContent
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.put

/**
 * Connects AndroidIRCX to remote MCP servers, so tools from elsewhere become
 * available to whichever AI provider the user configured — not only to the one
 * provider that offers server-side MCP.
 *
 * **Streamable HTTP only.** MCP's other transport is stdio, which means
 * launching the server as a subprocess. That is possible on Android (W^X
 * exempts `nativeLibraryDir`), but only for a binary shipped inside our own
 * APK — a stock device has no Node or Python, so the servers people actually
 * want to run cannot be launched this way. A local server is reached over
 * HTTP instead: run it in Termux and point this at 127.0.0.1.
 */
class McpClientModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "McpClientModule"
        private const val CONNECT_TIMEOUT_MS = 20_000L
        private const val CALL_TIMEOUT_MS = 60_000L
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val json = Json { ignoreUnknownKeys = true }
    private val clients = ConcurrentHashMap<String, Pair<HttpClient, Client>>()

    override fun getName(): String = "McpClient"

    @ReactMethod
    fun connect(id: String, url: String, token: String?, promise: Promise) {
        scope.launch {
            try {
                clients.remove(id)?.let { (http, _) -> http.close() }
                val http = HttpClient(OkHttp)
                val client = withTimeout(CONNECT_TIMEOUT_MS) {
                    http.mcpStreamableHttp(url) {
                        if (!token.isNullOrBlank()) {
                            headers.append("Authorization", "Bearer $token")
                        }
                    }
                }
                clients[id] = http to client

                val tools = Arguments.createArray()
                val listed = withTimeout(CONNECT_TIMEOUT_MS) { client.listTools() }
                for (tool in listed?.tools.orEmpty()) {
                    // Rebuild a plain JSON Schema for the JS side: the SDK
                    // keeps properties and required apart, the providers want
                    // them together.
                    val schema = buildJsonObject {
                        put("type", JsonPrimitive("object"))
                        put(
                            "properties",
                            tool.inputSchema.properties ?: JsonObject(emptyMap()),
                        )
                        putJsonArray("required") {
                            tool.inputSchema.required?.forEach {
                                add(JsonPrimitive(it))
                            }
                        }
                    }
                    tools.pushMap(
                        Arguments.createMap().apply {
                            putString("name", tool.name)
                            putString("description", tool.description ?: "")
                            putString("inputSchema", schema.toString())
                            // The server's own claim about itself. Treated as a
                            // hint on the JS side, never as a guarantee.
                            putBoolean(
                                "readOnly",
                                tool.annotations?.readOnlyHint == true,
                            )
                        },
                    )
                }

                promise.resolve(
                    Arguments.createMap().apply {
                        putString("id", id)
                        putArray("tools", tools)
                    },
                )
            } catch (e: Throwable) {
                Log.e(TAG, "Connect to $url failed: ${e.message}", e)
                clients.remove(id)?.let { (http, _) -> http.close() }
                promise.reject("connect_failed", e.message, e)
            }
        }
    }

    @ReactMethod
    fun callTool(id: String, name: String, argumentsJson: String, promise: Promise) {
        scope.launch {
            try {
                val entry = clients[id]
                if (entry == null) {
                    promise.reject("not_connected", "No connection for $id")
                    return@launch
                }
                val parsed = json.parseToJsonElement(argumentsJson) as? JsonObject
                    ?: JsonObject(emptyMap())
                val result = withTimeout(CALL_TIMEOUT_MS) {
                    entry.second.callTool(name, parsed.toMap())
                }
                // Only text content crosses the bridge; anything else is
                // reported rather than silently dropped.
                val text = result?.content.orEmpty().joinToString("\n") { block ->
                    (block as? TextContent)?.text ?: "[${block::class.simpleName}]"
                }
                promise.resolve(
                    Arguments.createMap().apply {
                        putString("content", text)
                        putBoolean("isError", result?.isError == true)
                    },
                )
            } catch (e: Throwable) {
                Log.e(TAG, "Tool $name failed: ${e.message}", e)
                promise.resolve(
                    Arguments.createMap().apply {
                        putString("content", e.message ?: "The tool failed.")
                        putBoolean("isError", true)
                    },
                )
            }
        }
    }

    @ReactMethod
    fun disconnect(id: String, promise: Promise) {
        scope.launch {
            try {
                clients.remove(id)?.let { (http, client) ->
                    client.close()
                    http.close()
                }
                promise.resolve(true)
            } catch (e: Throwable) {
                Log.e(TAG, "Disconnect $id failed: ${e.message}", e)
                promise.resolve(false)
            }
        }
    }

    override fun invalidate() {
        clients.values.forEach { (http, _) -> http.close() }
        clients.clear()
        super.invalidate()
    }
}
