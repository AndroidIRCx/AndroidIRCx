package com.androidircx

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import io.ktor.server.application.install
import io.ktor.server.cio.CIO
import io.ktor.server.engine.EmbeddedServer
import io.ktor.server.engine.embeddedServer
import io.ktor.server.sse.SSE
import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.server.ServerOptions
import io.modelcontextprotocol.kotlin.sdk.server.mcpStreamableHttp
import io.modelcontextprotocol.kotlin.sdk.types.CallToolRequest
import io.modelcontextprotocol.kotlin.sdk.types.CallToolResult
import io.modelcontextprotocol.kotlin.sdk.types.Implementation
import io.modelcontextprotocol.kotlin.sdk.types.ServerCapabilities
import io.modelcontextprotocol.kotlin.sdk.types.TextContent
import io.modelcontextprotocol.kotlin.sdk.types.Tool
import io.modelcontextprotocol.kotlin.sdk.types.ToolSchema
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Exposes AndroidIRCX to other agents over MCP.
 *
 * Division of labour, decided in phase 11: **Kotlin owns the protocol and the
 * HTTP transport; JavaScript owns the tools.** All the IRC state lives on the
 * JS side, so every tool call is forwarded across the bridge to the same
 * executors the in-app agent uses, and the answer comes back through
 * [resolveToolCall]. That way the MCP protocol is not written twice, and the
 * tools are not implemented twice either.
 *
 * Transport is Streamable HTTP. MCP's other transport is stdio, which needs a
 * subprocess talking over pipes — possible on Android only for a binary
 * shipped inside the APK, which is not what anyone wants to connect to.
 */
class McpServerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "McpServerModule"
        private const val EVENT_TOOL_CALL = "McpToolCall"
        /** How long a JS tool call may take before the caller gets an error. */
        private const val TOOL_TIMEOUT_MS = 30_000L
        private const val DEFAULT_PORT = 8765
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val pending = ConcurrentHashMap<String, CompletableDeferred<ToolReply>>()
    private var engine: EmbeddedServer<*, *>? = null
    private var token: String = ""
    private var port: Int = DEFAULT_PORT
    private var bindLan: Boolean = false

    private data class ToolReply(val content: String, val isError: Boolean)

    override fun getName(): String = "McpServer"

    private fun newToken(): String {
        val bytes = ByteArray(24)
        SecureRandom().nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Ask JavaScript to run a tool and wait for the answer.
     *
     * A timeout is not optional here: the JS side can be paused by Android at
     * any moment, and without one a stuck call would hold an MCP request open
     * until the remote client gave up.
     */
    private suspend fun callJs(name: String, argumentsJson: String): ToolReply {
        val id = java.util.UUID.randomUUID().toString()
        val deferred = CompletableDeferred<ToolReply>()
        pending[id] = deferred

        val payload = Arguments.createMap().apply {
            putString("id", id)
            putString("name", name)
            putString("input", argumentsJson)
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_TOOL_CALL, payload)

        val reply = withTimeoutOrNull(TOOL_TIMEOUT_MS) { deferred.await() }
        pending.remove(id)
        return reply ?: ToolReply("The app did not answer in time.", true)
    }

    private fun buildServer(tools: ReadableArray, allowWrites: Boolean): Server {
        val server = Server(
            Implementation(name = "androidircx", version = "1.0.0"),
            ServerOptions(capabilities = ServerCapabilities()),
        )

        for (index in 0 until tools.size()) {
            val entry = tools.getMap(index) ?: continue
            val name = entry.getString("name") ?: continue
            val description = entry.getString("description") ?: ""
            val mutates = entry.getBoolean("mutates")
            // A remote agent has no human watching it the way the in-app one
            // does, so write tools are only exposed when the user opts in.
            if (mutates && !allowWrites) continue

            // ToolSchema takes `properties` and `required` separately, so the
            // JSON Schema has to be taken apart rather than handed over whole
            // — passing the whole thing as `properties` would advertise
            // "type" and "required" to clients as if they were parameters.
            val schemaJson = entry.getString("inputSchema") ?: "{}"
            val parsed = json.parseToJsonElement(schemaJson) as? JsonObject
                ?: JsonObject(emptyMap())
            val schema = ToolSchema(
                properties = parsed["properties"] as? JsonObject
                    ?: JsonObject(emptyMap()),
                required = (parsed["required"] as? JsonArray)
                    ?.mapNotNull { (it as? JsonPrimitive)?.content }
                    ?: emptyList(),
            )

            val tool = Tool(name = name, description = description, inputSchema = schema)
            // The handler's receiver is the ClientConnection; the single
            // parameter is the request.
            server.addTool(tool) { request: CallToolRequest ->
                val argumentsJson = request.arguments.toString()
                val reply = callJs(name, argumentsJson)
                CallToolResult(
                    content = listOf(TextContent(reply.content)),
                    isError = reply.isError,
                )
            }
        }
        return server
    }

    @ReactMethod
    fun start(config: ReadableMap, promise: Promise) {
        try {
            if (engine != null) {
                promise.reject("already_running", "The MCP server is already running")
                return
            }
            port = if (config.hasKey("port")) config.getInt("port") else DEFAULT_PORT
            bindLan = config.hasKey("bindLan") && config.getBoolean("bindLan")
            val allowWrites = config.hasKey("allowWrites") && config.getBoolean("allowWrites")
            val tools = config.getArray("tools")
                ?: run {
                    promise.reject("no_tools", "No tools were supplied")
                    return
                }
            token = newToken()

            // Loopback unless the user explicitly asked for the LAN: binding to
            // 0.0.0.0 puts the user's IRC session on every network they join.
            val host = if (bindLan) "0.0.0.0" else "127.0.0.1"

            val started = embeddedServer(CIO, port = port, host = host) {
                install(SSE)
                mcpStreamableHttp(path = "/mcp") { buildServer(tools, allowWrites) }
            }
            started.start(wait = false)
            engine = started

            Log.d(TAG, "MCP server listening on $host:$port")
            promise.resolve(status())
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to start MCP server: ${e.message}", e)
            engine = null
            promise.reject("start_failed", e.message, e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            engine?.stop(500, 1000)
            engine = null
            token = ""
            // Release anything still waiting, or those coroutines leak.
            pending.values.forEach { it.complete(ToolReply("Server stopped.", true)) }
            pending.clear()
            promise.resolve(status())
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to stop MCP server: ${e.message}", e)
            promise.reject("stop_failed", e.message, e)
        }
    }

    /** JavaScript hands back what a tool produced. */
    @ReactMethod
    fun resolveToolCall(id: String, content: String, isError: Boolean) {
        pending[id]?.complete(ToolReply(content, isError))
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve(status())
    }

    private fun status() = Arguments.createMap().apply {
        putBoolean("running", engine != null)
        putInt("port", port)
        putString("token", token)
        putBoolean("bindLan", bindLan)
    }

    override fun invalidate() {
        engine?.stop(0, 0)
        engine = null
        super.invalidate()
    }
}
