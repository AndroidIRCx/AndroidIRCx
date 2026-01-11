package com.androidircx

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL

class HttpPutModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "HttpPutModule"
    }

    override fun getName(): String = "HttpPut"

    @ReactMethod
    fun putFile(
        urlString: String,
        filePath: String,
        headers: ReadableMap?,
        uploadId: String?,
        promise: Promise
    ) {
        try {
            Log.d(TAG, "PUT request to: $urlString")
            Log.d(TAG, "File path: $filePath")

            // Read file
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File does not exist: $filePath")
                return
            }

            val fileSize = file.length()
            Log.d(TAG, "File size: $fileSize bytes")

            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection

            // Set method to PUT
            connection.requestMethod = "PUT"
            connection.doOutput = true
            connection.doInput = true
            connection.setInstanceFollowRedirects(false)
            connection.useCaches = false
            connection.defaultUseCaches = false

            // Set default headers
            connection.setRequestProperty("Content-Type", "application/octet-stream")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Content-Length", fileSize.toString())
            connection.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            )
            connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9")
            connection.setRequestProperty("Cache-Control", "no-cache")
            connection.setRequestProperty("Pragma", "no-cache")
            connection.setRequestProperty("Connection", "keep-alive")
            connection.setRequestProperty("Origin", "https://www.androidircx.com")
            connection.setRequestProperty("Referer", "https://www.androidircx.com/")
            connection.setRequestProperty("Sec-Fetch-Dest", "empty")
            connection.setRequestProperty("Sec-Fetch-Mode", "cors")
            connection.setRequestProperty("Sec-Fetch-Site", "same-site")
            connection.setRequestProperty("DNT", "1")

            // Add custom headers if provided
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

            // Write file to output stream
            val outputStream = connection.outputStream
            val inputStream = FileInputStream(file)
            val buffer = ByteArray(8192)
            var bytesRead: Int
            var totalBytesWritten = 0L
            var lastEmittedBytes = 0L
            val emitThreshold = 256 * 1024 // 256KB

            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                outputStream.write(buffer, 0, bytesRead)
                totalBytesWritten += bytesRead
                if (totalBytesWritten - lastEmittedBytes >= emitThreshold) {
                    emitProgress(uploadId, totalBytesWritten, fileSize)
                    lastEmittedBytes = totalBytesWritten
                }
            }

            inputStream.close()
            outputStream.flush()
            outputStream.close()

            Log.d(TAG, "File uploaded, bytes written: $totalBytesWritten")
            emitProgress(uploadId, totalBytesWritten, fileSize)

            // Get response
            val responseCode = connection.responseCode
            Log.d(TAG, "Response code: $responseCode")

            // Read response
            val inputStream2 = if (responseCode >= 200 && responseCode < 300) {
                connection.inputStream
            } else {
                connection.errorStream
            }

            // Check if response is gzipped
            val responseInputStream = if ("gzip" == connection.getContentEncoding()) {
                java.util.zip.GZIPInputStream(inputStream2)
            } else {
                inputStream2
            }

            // Read response as byte array
            val responseBytes = responseInputStream.readBytes()
            responseInputStream.close()
            connection.disconnect()

            val responseBody = String(responseBytes, Charsets.UTF_8)
            Log.d(TAG, "Response body length: ${responseBody.length}")
            Log.d(TAG, "Response body preview: ${responseBody.take(200)}")

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
            Log.e(TAG, "PUT request failed: ${e.message}", e)
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

    private fun emitProgress(uploadId: String?, bytesWritten: Long, totalBytes: Long) {
        val emitter = reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        val payload = Arguments.createMap().apply {
            putString("uploadId", uploadId)
            putDouble("bytesWritten", bytesWritten.toDouble())
            putDouble("totalBytes", totalBytes.toDouble())
            putDouble(
                "percentage",
                if (totalBytes > 0) (bytesWritten.toDouble() / totalBytes.toDouble()) * 100.0 else 0.0
            )
        }
        emitter.emit("HttpPutProgress", payload)
    }
}
