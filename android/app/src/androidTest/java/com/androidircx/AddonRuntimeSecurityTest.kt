package com.androidircx

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.dokar.quickjs.QuickJs
import com.dokar.quickjs.QuickJsException
import com.dokar.quickjs.QuickJsInterruptedException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AddonRuntimeSecurityTest {
    @Test
    fun infiniteLoopIsInterrupted() = runBlocking {
        withRuntime(timeoutMs = 50) { runtime ->
            expectFailure<QuickJsInterruptedException> {
                runtime.evaluate<Unit>("while (true) {}", "hostile-loop.js")
            }
        }
    }

    @Test
    fun memoryAndStackLimitsTerminateHostileCode() = runBlocking {
        withRuntime(memoryBytes = 2 * 1024 * 1024, stackBytes = 64 * 1024) { runtime ->
            expectFailure<QuickJsException> {
                runtime.evaluate<Unit>(
                    "const values = []; while (true) values.push('x'.repeat(4096));",
                    "hostile-memory.js",
                )
            }
        }
        withRuntime(stackBytes = 64 * 1024) { runtime ->
            expectFailure<QuickJsException> {
                runtime.evaluate<Unit>(
                    "function recurse() { return recurse(); } recurse();",
                    "hostile-stack.js",
                )
            }
        }
    }

    @Test
    fun runtimesDoNotShareGlobalsOrPrototypes() = runBlocking {
        withRuntime { first ->
            withRuntime { second ->
                first.evaluate<Unit>(
                    "globalThis.secret = 42; Object.prototype.polluted = true;",
                    "first.js",
                )
                assertEquals(
                    "undefined:undefined",
                    second.evaluate<String>(
                        "typeof globalThis.secret + ':' + typeof ({}).polluted",
                        "second.js",
                    ),
                )
            }
        }
    }

    @Test
    fun ambientHostApisAreAbsent() = runBlocking {
        withRuntime { runtime ->
            assertEquals(
                "undefined,undefined,undefined,undefined,undefined,undefined",
                runtime.evaluate<String>(
                    "[typeof fetch, typeof WebSocket, typeof XMLHttpRequest, " +
                        "typeof require, typeof process, typeof NativeModules].join(',')",
                    "ambient-globals.js",
                ),
            )
        }
    }

    private suspend fun <T> withRuntime(
        memoryBytes: Long = 8 * 1024 * 1024,
        stackBytes: Long = 256 * 1024,
        timeoutMs: Long = 250,
        block: suspend (QuickJs) -> T,
    ): T {
        val runtime = QuickJs.create(Dispatchers.Default).apply {
            memoryLimit = memoryBytes
            maxStackSize = stackBytes
            evaluationTimeoutMillis = timeoutMs
        }
        return try {
            block(runtime)
        } finally {
            runtime.close()
        }
    }

    private suspend inline fun <reified T : Throwable> expectFailure(
        crossinline block: suspend () -> Unit,
    ) {
        try {
            block()
            fail("Expected ${T::class.java.simpleName}")
        } catch (error: Throwable) {
            if (error !is T) throw error
        }
    }
}
