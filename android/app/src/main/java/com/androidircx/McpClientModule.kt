package com.androidircx

import android.net.http.X509TrustManagerExtensions
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.sse.SSE
import io.modelcontextprotocol.kotlin.sdk.client.Client
import io.modelcontextprotocol.kotlin.sdk.client.mcpSse
import io.modelcontextprotocol.kotlin.sdk.client.mcpStreamableHttp
import io.modelcontextprotocol.kotlin.sdk.types.TextContent
import java.net.URI
import java.security.KeyStore
import java.security.cert.X509Certificate
import java.util.concurrent.ConcurrentHashMap
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import kotlinx.coroutines.CancellationException
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
 * **HTTP transports only.** MCP's other transport is stdio, which means
 * launching the server as a subprocess. That is possible on Android (W^X
 * exempts `nativeLibraryDir`), but only for a binary shipped inside our own
 * APK — a stock device has no Node or Python, so the servers people actually
 * want to run cannot be launched this way. A local server is reached over
 * HTTP instead: run it in Termux and point this at 127.0.0.1.
 *
 * Both HTTP transports are spoken: Streamable HTTP (the current spec) and the
 * older HTTP+SSE pair of a `GET /sse` stream plus `POST /messages`. The Python
 * and TypeScript SDKs still serve the old one by default, which is what a
 * Termux server usually is, and asking Streamable HTTP of it only ever got a
 * 405 — so the app reported no tools at all.
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

    /**
     * The platform's trust manager, asked the hostname-aware way.
     *
     * CIO checks a certificate chain with the two-argument
     * `checkServerTrusted(chain, authType)` and verifies the host name itself
     * afterwards. Android refuses that call outright whenever the network
     * security config has a `<domain-config>` — ours does, for localhost — with
     * "Domain specific configurations require that hostname aware
     * checkServerTrusted(X509Certificate[], String, String) is used". So every
     * https MCP server failed, while plain http to 127.0.0.1 worked.
     *
     * The client is built per connection, so the host is known here and can
     * be handed to `X509TrustManagerExtensions`, which applies the full
     * network security config for it. Trust itself is unchanged: the same
     * system anchors decide, and CIO still checks the name on the certificate.
     */
    private fun hostnameAwareTrustManager(url: String): X509TrustManager {
        val factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        factory.init(null as KeyStore?)
        val platform = factory.trustManagers.filterIsInstance<X509TrustManager>().first()
        val extensions = X509TrustManagerExtensions(platform)
        val host = runCatching { URI(url).host }.getOrNull().orEmpty()

        return object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) =
                platform.checkClientTrusted(chain, authType)

            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
                extensions.checkServerTrusted(chain, authType, host)
            }

            override fun getAcceptedIssuers(): Array<X509Certificate> = platform.acceptedIssuers
        }
    }

    /**
     * Connect with whichever HTTP transport the server actually speaks.
     *
     * A URL ending in `/sse` is the older HTTP+SSE transport by convention, so
     * that one is tried first there and second everywhere else. Both are tried
     * either way: the convention is only a hint, and the cost of guessing wrong
     * is one failed request against a server that is about to work.
     */
    private suspend fun open(http: HttpClient, url: String, token: String?): Client {
        val sseFirst = url.trimEnd('/').endsWith("/sse", ignoreCase = true)
        var failure: Throwable? = null
        for (sse in listOf(sseFirst, !sseFirst)) {
            try {
                return if (sse) {
                    http.mcpSse(url) {
                        if (!token.isNullOrBlank()) {
                            headers.append("Authorization", "Bearer $token")
                        }
                    }
                } else {
                    http.mcpStreamableHttp(url) {
                        if (!token.isNullOrBlank()) {
                            headers.append("Authorization", "Bearer $token")
                        }
                    }
                }
            } catch (e: CancellationException) {
                // The connect timeout expired; trying the other transport would
                // run on past it.
                throw e
            } catch (e: Throwable) {
                Log.w(TAG, "MCP ${if (sse) "SSE" else "streamable HTTP"} failed: ${e.message}")
                // Keep the first failure: against a server that speaks neither,
                // it is the one for the transport the URL pointed at.
                if (failure == null) failure = e
            }
        }
        throw failure ?: IllegalStateException("The server did not answer.")
    }

    @ReactMethod
    fun connect(id: String, url: String, token: String?, promise: Promise) {
        scope.launch {
            var http: HttpClient? = null
            try {
                clients.remove(id)?.let { (stale, _) -> stale.close() }
                val opened = HttpClient(CIO) {
                    // SseClientTransport opens the stream through this plugin;
                    // without it the SSE transport fails before it starts.
                    install(SSE)
                    engine {
                        // An SSE stream is idle between events by design, and
                        // CIO's fifteen-second request timeout would tear down
                        // a perfectly healthy connection. Zero means no limit;
                        // the connect timeout still applies, and connectAll()
                        // has its own.
                        requestTimeout = 0
                        https { trustManager = hostnameAwareTrustManager(url) }
                    }
                }
                http = opened
                val client = withTimeout(CONNECT_TIMEOUT_MS) { open(opened, url, token) }
                clients[id] = opened to client

                val tools = Arguments.createArray()
                val listed = withTimeout(CONNECT_TIMEOUT_MS) { client.listTools() }
                for (tool in listed?.tools.orEmpty()) {
                    // Rebuild a plain JSON Schema for the JS side: the SDK
                    // keeps properties, required and $defs apart, the providers
                    // want them together.
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
                        // $defs has to come along or every $ref in the
                        // properties points at nothing. A server built on
                        // FastMCP - which MemPalace is - emits $defs for any
                        // parameter that is not a plain scalar, so dropping it
                        // is not an edge case.
                        tool.inputSchema.defs?.takeIf { it.isNotEmpty() }?.let {
                            put("\$defs", it)
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
                // Close by id when the connection got that far, and otherwise
                // close the client that never made it into the map — it holds
                // a connection pool and a dispatcher either way.
                clients.remove(id)?.let { (stale, _) -> stale.close() } ?: http?.close()
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
