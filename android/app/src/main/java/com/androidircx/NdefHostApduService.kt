/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * NdefHostApduService - Emulates an NFC Forum Type 4 Tag via Host Card
 * Emulation (HCE) so two phones held back-to-back can exchange an encryption
 * key. One phone runs this service (share) and serves a read-only NDEF Text
 * record; the other phone reads it in normal NFC reader mode (receive).
 *
 * Android Beam (phone-to-phone NDEF push) was removed in Android 10, so HCE is
 * the only supported way to move data between two phones over NFC. The reader
 * side keeps using NfcManager.requestTechnology(Ndef) + getTag(), which reads a
 * Type 4 tag - including this emulated one - transparently.
 *
 * The Type 4 Tag command set we answer (NFC Forum T4T Operation spec):
 *   1. SELECT by AID   (NDEF Tag Application D2760000850101)
 *   2. SELECT by file  (Capability Container E103, NDEF file E104)
 *   3. READ_BINARY     (arbitrary offset/length into the selected file)
 * Writes are refused (the CC advertises the NDEF file as read-only).
 */
package com.androidircx

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log
import java.io.ByteArrayOutputStream

class NdefHostApduService : HostApduService() {

    companion object {
        private const val TAG = "NdefHostApduService"

        // NDEF Tag Application ID (NFC Forum well-known AID).
        private val NDEF_APP_AID = byteArrayOf(
            0xD2.toByte(), 0x76, 0x00, 0x00, 0x85.toByte(), 0x01, 0x01
        )

        // File identifiers.
        private const val FILE_NONE = 0
        private const val FILE_CC = 1
        private const val FILE_NDEF = 2
        private val CC_FILE_ID = byteArrayOf(0xE1.toByte(), 0x03)
        private val NDEF_FILE_ID = byteArrayOf(0xE1.toByte(), 0x04)

        // ISO 7816-4 status words.
        private val SW_OK = byteArrayOf(0x90.toByte(), 0x00)
        private val SW_FILE_NOT_FOUND = byteArrayOf(0x6A.toByte(), 0x82.toByte())
        private val SW_WRONG_LENGTH = byteArrayOf(0x67, 0x00)
        private val SW_INS_NOT_SUPPORTED = byteArrayOf(0x6D.toByte(), 0x00)
        private val SW_CLA_NOT_SUPPORTED = byteArrayOf(0x6E.toByte(), 0x00)

        // Capability Container (15 bytes): advertises a single read-only NDEF
        // file (E104) up to 0x7FFF bytes, with conservative Le/Lc limits.
        private val CAPABILITY_CONTAINER = byteArrayOf(
            0x00, 0x0F,             // CCLEN = 15
            0x20,                   // Mapping version 2.0
            0x00, 0xFB.toByte(),    // MLe  (max R-APDU data = 251)
            0x00, 0xFF.toByte(),    // MLc  (max C-APDU data = 255)
            0x04, 0x06,             // NDEF File Control TLV: T=04, L=06
            0xE1.toByte(), 0x04,    // NDEF file ID = E104
            0x7F, 0xFF.toByte(),    // Max NDEF file size = 32767
            0x00,                   // Read access granted
            0xFF.toByte()           // Write access denied (read-only)
        )

        // Shared, volatile NDEF file content: NLEN(2 bytes) + NDEF message.
        // Empty (NLEN = 0) unless the user is actively sharing.
        @Volatile
        private var ndefFile: ByteArray = byteArrayOf(0x00, 0x00)

        // Invoked once the reader has read the full NDEF message.
        @Volatile
        var onNdefRead: (() -> Unit)? = null

        /** Set the key payload to serve, encoded as an NDEF Text record. */
        fun setPayload(text: String) {
            val message = buildNdefTextMessage(text)
            val len = message.size
            val file = ByteArray(2 + len)
            file[0] = ((len shr 8) and 0xFF).toByte()
            file[1] = (len and 0xFF).toByte()
            System.arraycopy(message, 0, file, 2, len)
            ndefFile = file
            Log.d(TAG, "Payload armed, NDEF message size=$len")
        }

        /** Stop sharing: serve an empty NDEF file again. */
        fun clearPayload() {
            ndefFile = byteArrayOf(0x00, 0x00)
            onNdefRead = null
            Log.d(TAG, "Payload cleared")
        }

        /** True when a real payload is currently armed. */
        fun isSharing(): Boolean = ndefFile.size > 2

        /**
         * Build a single NDEF Text record (RTD 'T', UTF-8, language "en").
         * Supports both short and normal record layouts so large key bundles
         * (> 255 bytes) are handled correctly.
         */
        private fun buildNdefTextMessage(text: String): ByteArray {
            val lang = "en".toByteArray(Charsets.US_ASCII)
            val textBytes = text.toByteArray(Charsets.UTF_8)
            val payload = ByteArray(1 + lang.size + textBytes.size)
            payload[0] = (lang.size and 0x3F).toByte() // UTF-8 (bit7=0) + lang length
            System.arraycopy(lang, 0, payload, 1, lang.size)
            System.arraycopy(textBytes, 0, payload, 1 + lang.size, textBytes.size)

            val out = ByteArrayOutputStream()
            val shortRecord = payload.size < 256
            // MB=1, ME=1, CF=0, SR=shortRecord, IL=0, TNF=001 (Well Known)
            var header = 0x80 or 0x40 or 0x01
            if (shortRecord) header = header or 0x10
            out.write(header)
            out.write(0x01) // Type length ('T')
            if (shortRecord) {
                out.write(payload.size and 0xFF)
            } else {
                out.write((payload.size shr 24) and 0xFF)
                out.write((payload.size shr 16) and 0xFF)
                out.write((payload.size shr 8) and 0xFF)
                out.write(payload.size and 0xFF)
            }
            out.write('T'.code) // Type
            out.write(payload)
            return out.toByteArray()
        }
    }

    private var selectedFile = FILE_NONE

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        if (commandApdu == null || commandApdu.size < 4) {
            return SW_WRONG_LENGTH
        }

        val cla = commandApdu[0].toInt() and 0xFF
        val ins = commandApdu[1].toInt() and 0xFF
        val p1 = commandApdu[2].toInt() and 0xFF
        val p2 = commandApdu[3].toInt() and 0xFF

        if (cla != 0x00) {
            return SW_CLA_NOT_SUPPORTED
        }

        return when (ins) {
            0xA4 -> handleSelect(commandApdu, p1, p2)
            0xB0 -> handleReadBinary(p1, p2, commandApdu)
            else -> SW_INS_NOT_SUPPORTED
        }
    }

    private fun handleSelect(apdu: ByteArray, p1: Int, p2: Int): ByteArray {
        if (apdu.size < 5) return SW_WRONG_LENGTH
        val lc = apdu[4].toInt() and 0xFF
        if (apdu.size < 5 + lc) return SW_WRONG_LENGTH
        val data = apdu.copyOfRange(5, 5 + lc)

        // SELECT by name (application / AID).
        if (p1 == 0x04) {
            selectedFile = FILE_NONE
            return if (data.contentEquals(NDEF_APP_AID)) SW_OK else SW_FILE_NOT_FOUND
        }

        // SELECT by file identifier.
        if (p1 == 0x00 && p2 == 0x0C && lc == 0x02) {
            return when {
                data.contentEquals(CC_FILE_ID) -> {
                    selectedFile = FILE_CC
                    SW_OK
                }
                data.contentEquals(NDEF_FILE_ID) -> {
                    selectedFile = FILE_NDEF
                    SW_OK
                }
                else -> {
                    selectedFile = FILE_NONE
                    SW_FILE_NOT_FOUND
                }
            }
        }

        return SW_FILE_NOT_FOUND
    }

    private fun handleReadBinary(p1: Int, p2: Int, apdu: ByteArray): ByteArray {
        val source = when (selectedFile) {
            FILE_CC -> CAPABILITY_CONTAINER
            FILE_NDEF -> ndefFile
            else -> return SW_FILE_NOT_FOUND
        }

        val offset = (p1 shl 8) or p2
        // Le is the last byte of the C-APDU (0x00 means "up to 256").
        var le = if (apdu.size >= 5) apdu[apdu.size - 1].toInt() and 0xFF else 0
        if (le == 0) le = 256

        if (offset > source.size) {
            return SW_WRONG_LENGTH
        }
        val end = minOf(offset + le, source.size)
        val slice = source.copyOfRange(offset, end)

        val response = ByteArray(slice.size + 2)
        System.arraycopy(slice, 0, response, 0, slice.size)
        response[slice.size] = SW_OK[0]
        response[slice.size + 1] = SW_OK[1]

        // Signal completion once the reader has consumed the whole NDEF message.
        if (selectedFile == FILE_NDEF && end >= source.size && source.size > 2) {
            onNdefRead?.invoke()
        }

        return response
    }

    override fun onDeactivated(reason: Int) {
        Log.d(TAG, "Deactivated, reason=$reason")
        selectedFile = FILE_NONE
    }
}
