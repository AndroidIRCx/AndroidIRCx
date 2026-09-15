package com.androidircx

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class HttpPostModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "HttpPostModule"
    }

    override fun getName(): String = "HttpPost"

    @ReactMethod
    fun postRequest(
        urlString: String,
        body: String,
        headers: ReadableMap?,
        promise: Promise
    ) {
        try {
            Log.d(TAG, "POST request to: $urlString")
            Log.d(TAG, "Body length: ${body.length}")
            Log.d(TAG, "Request body: $body")

            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection

            // Set method to POST - CRITICAL
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.doInput = true

            // Explicitly disable redirects to prevent method change
            connection.setInstanceFollowRedirects(false)

            // Additional connection properties to ensure proper POST behavior
            connection.useCaches = false
            connection.defaultUseCaches = false
            connection.setRequestProperty("Connection", "keep-alive")
            connection.setRequestProperty("Upgrade-Insecure-Requests", "1")
            connection.setRequestProperty("Origin", "https://androidircx.com")
            connection.setRequestProperty("Referer", "https://androidircx.com/")
            connection.setRequestProperty("Sec-Fetch-Dest", "empty")
            connection.setRequestProperty("Sec-Fetch-Mode", "cors")
            connection.setRequestProperty("Sec-Fetch-Site", "same-site")

            // Disable automatic redirect following to preserve POST method
            // We'll handle redirects manually if needed
            connection.instanceFollowRedirects = false

            // Set default headers required by Cloudflare and standard APIs
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            )
            connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9")
            connection.setRequestProperty("Accept-Encoding", "identity")
            connection.setRequestProperty("Cache-Control", "no-cache")
            connection.setRequestProperty("Pragma", "no-cache")

            // Additional headers that may be required by Cloudflare
            connection.setRequestProperty("Connection", "keep-alive")
            connection.setRequestProperty("Upgrade-Insecure-Requests", "1")
            connection.setRequestProperty("Origin", "https://www.androidircx.com")
            connection.setRequestProperty("Referer", "https://www.androidircx.com/")
            connection.setRequestProperty("Sec-Fetch-Dest", "empty")
            connection.setRequestProperty("Sec-Fetch-Mode", "cors")
            connection.setRequestProperty("Sec-Fetch-Site", "same-site")
            connection.setRequestProperty("DNT", "1") // Do Not Track
            connection.setRequestProperty("TE", "Trailers") // Transfer Encoding

            // Add custom headers if provided (these will override defaults if same key)
            headers?.let {
                val iterator = it.keySetIterator()
                while (iterator.hasNextKey()) {
                    val key = iterator.nextKey()
                    val value = it.getString(key)
                    if (value != null) {
                        connection.setRequestProperty(key, value)
                        Log.d(TAG, "Custom Header: $key = $value")
                    }
                }
            }

            // Write body and set Content-Length explicitly
            val bodyBytes = body.toByteArray(Charsets.UTF_8)
            connection.setRequestProperty("Content-Length", bodyBytes.size.toString())

            val outputStream = connection.outputStream
            outputStream.write(bodyBytes)
            outputStream.flush()
            outputStream.close()

            Log.d(TAG, "Body written, getting response code...")
            Log.d(TAG, "Request method before getResponseCode: ${connection.requestMethod}")
            Log.d(TAG, "Request URL: ${connection.url}")

            // Get response code (this actually sends the request)
            val initialResponseCode = connection.responseCode
            Log.d(TAG, "Initial response code: $initialResponseCode")
            Log.d(TAG, "Request method after getResponseCode: ${connection.requestMethod}")
            Log.d(TAG, "Response headers: ${connection.headerFields}")

            // Handle redirects manually to preserve POST method
            var responseCode = initialResponseCode
            var redirectCount = 0
            val maxRedirects = 5
            var currentConnection = connection

            // Check if we got a redirect response
            while ((responseCode == HttpURLConnection.HTTP_MOVED_PERM ||
                        responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
                        responseCode == HttpURLConnection.HTTP_SEE_OTHER ||
                        responseCode == 307 ||  // Temporary Redirect (preserve method)
                        responseCode == 308) &&  // Permanent Redirect (preserve method)
                redirectCount < maxRedirects
            ) {

                redirectCount++
                val redirectUrl = currentConnection.getHeaderField("Location")
                Log.d(TAG, "Redirect $redirectCount: $redirectUrl")

                if (redirectUrl == null) {
                    Log.d(TAG, "No redirect location found, breaking redirect loop")
                    break
                }

                // Store headers before disconnecting
                val headerMap = mutableMapOf<String, String>()
                var headerIndex = 0
                while (true) {
                    val headerKey = currentConnection.getHeaderFieldKey(headerIndex)
                    val headerValue = currentConnection.getHeaderField(headerIndex)
                    if (headerKey == null && headerValue == null) break
                    if (headerKey != null && headerValue != null) {
                        headerMap[headerKey] = headerValue
                    }
                    headerIndex++
                }

                currentConnection.disconnect()

                // Create new connection for redirect
                val redirectUrlObj = URL(redirectUrl)
                val redirectConnection = redirectUrlObj.openConnection() as HttpURLConnection

                // For 307/308 redirects, method should be preserved automatically
                // For 301/302/303, we need to explicitly set POST
                val isPreserveMethodRedirect = (responseCode == 307 || responseCode == 308)
                val redirectMethod = if (isPreserveMethodRedirect) {
                    // 307 and 308 should preserve the original method, but let's be explicit
                    "POST"
                } else {
                    // For 301, 302, 303, we force POST to maintain the original intent
                    "POST"
                }

                redirectConnection.requestMethod = redirectMethod
                redirectConnection.doOutput = true
                redirectConnection.doInput = true
                redirectConnection.instanceFollowRedirects = false

                // Copy headers (except Content-Length which will be set automatically)
                headerMap.forEach { (key, value) ->
                    if (key != "Content-Length") {
                        redirectConnection.setRequestProperty(key, value)
                    }
                }

                // Set required headers for redirect request
                redirectConnection.setRequestProperty(
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                )
                redirectConnection.setRequestProperty("Accept-Language", "en-US,en;q=0.9")
                redirectConnection.setRequestProperty("Accept-Encoding", "identity")
                redirectConnection.setRequestProperty("Cache-Control", "no-cache")
                redirectConnection.setRequestProperty("Pragma", "no-cache")

                // Additional headers that may be required by Cloudflare for redirects
                redirectConnection.setRequestProperty("Connection", "keep-alive")
                redirectConnection.setRequestProperty("Upgrade-Insecure-Requests", "1")
                redirectConnection.setRequestProperty("Origin", "https://www.androidircx.com")
                redirectConnection.setRequestProperty("Referer", "https://www.androidircx.com/")
                redirectConnection.setRequestProperty("Sec-Fetch-Dest", "empty")
                redirectConnection.setRequestProperty("Sec-Fetch-Mode", "cors")
                redirectConnection.setRequestProperty("Sec-Fetch-Site", "same-site")
                redirectConnection.setRequestProperty("DNT", "1") // Do Not Track
                redirectConnection.setRequestProperty("TE", "Trailers") // Transfer Encoding

                // Re-write body for POST requests and set Content-Length
                if (redirectMethod == "POST" || redirectMethod == "PUT") {
                    val bodyBytes = body.toByteArray(Charsets.UTF_8)
                    redirectConnection.setRequestProperty(
                        "Content-Length",
                        bodyBytes.size.toString()
                    )

                    val redirectOutputStream = redirectConnection.outputStream
                    redirectOutputStream.write(bodyBytes)
                    redirectOutputStream.flush()
                    redirectOutputStream.close()
                }

                responseCode = redirectConnection.responseCode
                Log.d(TAG, "Redirect response code: $responseCode")
                Log.d(TAG, "Redirect request method: ${redirectConnection.requestMethod}")

                currentConnection = redirectConnection
            }

            // Read response
            val inputStream = if (responseCode >= 200 && responseCode < 300) {
                currentConnection.inputStream
            } else {
                currentConnection.errorStream
            }

            // Check if response is gzipped
            val responseInputStream = if (
                currentConnection.getContentEncoding()?.equals("gzip", ignoreCase = true) == true
            ) {
                java.util.zip.GZIPInputStream(inputStream)
            } else {
                inputStream
            }

            // Read response as byte array to handle encoding properly
            val responseBytes = responseInputStream.readBytes()
            responseInputStream.close()
            currentConnection.disconnect()

            val responseBody = String(responseBytes, Charsets.UTF_8)
            Log.d(TAG, "Response code: $responseCode, body length: ${responseBody.length}")
            Log.d(
                TAG,
                "Response body preview: ${responseBody.take(200)}"
            ) // Log first 200 chars for debugging

            if (responseCode >= 200 && responseCode < 300) {
                promise.resolve(responseBody)
            } else {
                promise.reject(
                    "HTTP_ERROR",
                    "HTTP $responseCode: $responseBody",
                    Exception("HTTP $responseCode")
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "POST request failed: ${e.message}", e)
            // Reject with proper error code to avoid null pointer exception
            val errorCode =
                if (e.message != null && e.message!!.isNotBlank()) e.message!! else "REQUEST_ERROR"
            val errorMessage =
                if (e.message != null && e.message!!.isNotBlank()) e.message!! else "Unknown error occurred"
            promise.reject(
                errorCode,
                errorMessage,
                e
            )
        }
    }
}
