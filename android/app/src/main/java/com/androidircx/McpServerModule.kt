package com.androidircx

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.ApplicationCallPipeline
import io.ktor.server.application.call
import io.ktor.server.cio.CIO
import io.ktor.server.engine.EmbeddedServer
import io.ktor.server.engine.embeddedServer
import io.ktor.server.request.header
import io.ktor.server.response.respondText
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
import java.security.MessageDigest
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

        /** Only this phone. */
        const val BIND_LOOPBACK = "loopback"
        /** This phone's address on the network it is on — one interface. */
        const val BIND_LAN = "lan"
        /** Every interface, including mobile data, tethering and any VPN. */
        const val BIND_ANY = "any"
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val pending = ConcurrentHashMap<String, CompletableDeferred<ToolReply>>()
    private var engine: EmbeddedServer<*, *>? = null
    private var token: String = ""
    private var port: Int = DEFAULT_PORT
    private var bindMode: String = BIND_LOOPBACK
    /** The address the running server is actually bound to. */
    private var boundHost: String = ""

    private data class ToolReply(val content: String, val isError: Boolean)

    override fun getName(): String = "McpServer"

    /**
     * Whether a request presented the token this server was started with.
     *
     * Compared with [MessageDigest.isEqual], which does not return early on the
     * first differing byte. A plain `==` on a secret is timing-observable, and
     * on a LAN an attacker can take as many samples as they like.
     */
    private fun isAuthorized(call: ApplicationCall): Boolean {
        val expected = token
        // An empty token means the server is not properly started; refuse
        // rather than accepting everything, which is what an empty comparison
        // would otherwise do.
        if (expected.isEmpty()) return false
        val header = call.request.header("Authorization") ?: return false
        val presented = header.removePrefix("Bearer ").trim()
        return MessageDigest.isEqual(
            presented.toByteArray(Charsets.UTF_8),
            expected.toByteArray(Charsets.UTF_8),
        )
    }

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
        // Security pass 2026-10-05: the emit had no try/catch. With the React
        // instance gone or reloading it throws inside the tool handler, and
        // the pending entry was never removed. Now the remote caller gets an
        // answer and nothing is left behind, whatever happens.
        try {
            val payload = Arguments.createMap().apply {
                putString("id", id)
                putString("name", name)
                putString("input", argumentsJson)
            }
            try {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(EVENT_TOOL_CALL, payload)
            } catch (e: Throwable) {
                Log.w(TAG, "Could not hand a tool call to the app: ${e.message}")
                return ToolReply("The app is not ready to answer right now.", true)
            }
            val reply = withTimeoutOrNull(TOOL_TIMEOUT_MS) { deferred.await() }
            return reply ?: ToolReply("The app did not answer in time.", true)
        } finally {
            pending.remove(id)
        }
    }

    private fun buildServer(tools: ReadableArray, allowWrites: Boolean): Server {
        val server = Server(
            Implementation(name = "androidircx", version = "1.0.0"),
            // The tools capability has to be declared: addTool() throws when
            // it is null, and that happened inside the per-request factory, so
            // every initialize came back as a bare 500 after the token check.
            ServerOptions(
                capabilities = ServerCapabilities(
                    tools = ServerCapabilities.Tools(listChanged = false),
                ),
            ),
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
                // Carried for the same reason the client carries it: a $ref in
                // a property is meaningless once $defs is gone. None of our
                // own tools use one today, so this only has to not be wrong
                // the day one does.
                defs = parsed["\$defs"] as? JsonObject,
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
            bindMode = when (config.getString("bindMode")) {
                BIND_LAN -> BIND_LAN
                BIND_ANY -> BIND_ANY
                // Anything unrecognised, including absent, stays on loopback.
                // Getting this wrong exposes the user's IRC session, so the
                // safe answer is the one an unknown value falls back to.
                else -> BIND_LOOPBACK
            }
            val allowWrites = config.hasKey("allowWrites") && config.getBoolean("allowWrites")
            val tools = config.getArray("tools")
                ?: run {
                    promise.reject("no_tools", "No tools were supplied")
                    return
                }
            token = newToken()

            // Loopback unless the user explicitly asked otherwise: binding to
            // 0.0.0.0 puts the user's IRC session on every network they join.
            // "lan" binds the one interface they are actually on, which leaves
            // mobile data, tethering and a VPN out of it.
            val host = when (bindMode) {
                BIND_ANY -> "0.0.0.0"
                BIND_LAN -> lanAddress() ?: run {
                    promise.reject(
                        "no_lan",
                        "This phone is not on a Wi-Fi network right now. Connect to Wi-Fi, or bind to every interface instead.",
                    )
                    return
                }
                else -> "127.0.0.1"
            }

            boundHost = host
            val started = embeddedServer(CIO, port = port, host = host) {
                // No install(SSE) here: mcpStreamableHttp() installs it itself,
                // and Ktor throws DuplicatePluginException on the second
                // install - so the server refused to start at all, with a
                // message about a conflicting plugin key that said nothing
                // about MCP.
                // Every request carries the token or it does not get in.
                //
                // The token was generated and shown to the user from the first
                // version of this, and never actually checked - so binding to
                // the LAN or to every interface put the user's IRC session on
                // the network with no credential at all, while the settings
                // screen displayed a token that did nothing.
                intercept(ApplicationCallPipeline.Plugins) {
                    if (!isAuthorized(call)) {
                        call.respondText(
                            "Unauthorized",
                            status = HttpStatusCode.Unauthorized,
                        )
                        finish()
                    }
                }
                mcpStreamableHttp(path = "/mcp") { buildServer(tools, allowWrites) }
            }
            started.start(wait = false)
            engine = started

            Log.d(TAG, "MCP server listening on $host:$port")
            promise.resolve(status())
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to start MCP server: ${e.message}", e)
            engine = null
            boundHost = ""
            promise.reject("start_failed", e.message, e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            engine?.stop(500, 1000)
            engine = null
            token = ""
            boundHost = ""
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

    /**
     * This phone's own IPv4 address on its Wi-Fi (or Ethernet) network.
     *
     * Security pass 2026-10-05: this used to take the first non-loopback
     * interface in whatever order the system listed them. On a phone with both
     * Wi-Fi and mobile data that could be the carrier interface — on a carrier
     * that hands out public IPv4, that put the user's IRC session on the
     * internet, while the screen promised "mobile data, tethering and a VPN
     * are left out". Now only a network the system itself says is Wi-Fi or
     * Ethernet is used; with none, there is no LAN address and "My network"
     * refuses to start rather than guess.
     *
     * IPv6 is skipped on purpose: the address a person has to type into an MCP
     * client is the one they can read off this screen, and a link-local IPv6
     * address with a scope id is not that.
     */
    @Suppress("DEPRECATION") // allNetworks: the one call that lists them all on API 24+.
    private fun lanAddress(): String? =
        try {
            val manager = reactContext.getSystemService(Context.CONNECTIVITY_SERVICE)
                as? ConnectivityManager ?: return null
            manager.allNetworks
                .asSequence()
                .filter { network ->
                    val capabilities = manager.getNetworkCapabilities(network)
                    capabilities != null &&
                        !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) &&
                        (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))
                }
                .mapNotNull { manager.getLinkProperties(it) }
                .flatMap { it.linkAddresses.asSequence() }
                .map { it.address }
                .filterIsInstance<java.net.Inet4Address>()
                .firstOrNull { !it.isLoopbackAddress && !it.isLinkLocalAddress }
                ?.hostAddress
        } catch (e: Throwable) {
            Log.w(TAG, "Could not read this phone's address: ${e.message}")
            null
        }

    private fun status() = Arguments.createMap().apply {
        putBoolean("running", engine != null)
        putInt("port", port)
        putString("token", token)
        putString("bindMode", bindMode)
        // The address a client should actually be pointed at. For 0.0.0.0 that
        // is not "0.0.0.0" — nobody can connect to that — it is this phone's
        // address on the network, which is what the settings screen shows.
        // For "My network" this is the address the server is bound to, not a
        // fresh lookup that may have moved on since — what is shown is what is
        // listening.
        putString(
            "host",
            when {
                bindMode == BIND_LOOPBACK -> "127.0.0.1"
                bindMode == BIND_LAN && boundHost.isNotEmpty() -> boundHost
                else -> lanAddress() ?: ""
            },
        )
    }

    override fun invalidate() {
        engine?.stop(0, 0)
        engine = null
        super.invalidate()
    }
}
