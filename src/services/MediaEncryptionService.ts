/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * MediaEncryptionService - Encrypt/decrypt media files using existing E2E keys
 *
 * IMPORTANT: This service REUSES existing E2E encryption keys:
 * - For DMs: Uses EncryptedDMService keys (derived from bundle exchange)
 * - For Channels: Uses ChannelEncryptionService keys (symmetric channel keys)
 *
 * NO new key generation or exchange is needed - media encryption is automatic
 * if the tab has E2E encryption enabled.
 */

import sodium from 'react-native-libsodium';
import RNFS from 'react-native-fs';
import { TextEncoder, TextDecoder } from 'text-encoding';
import { Buffer } from 'buffer';
import { encryptedDMService } from './EncryptedDMService';
import { channelEncryptionService } from './ChannelEncryptionService';

interface EncryptedMediaResult {
  success: boolean;
  encryptedUri?: string; // Path to encrypted file
  nonce?: string;        // Base64 nonce
  error?: string;
}

interface DecryptedMediaResult {
  success: boolean;
  decryptedUri?: string; // Path to decrypted file
  mimeType?: string;     // MIME type of decrypted file
  error?: string;
}

/**
 * MediaEncryptionService - Encrypt/decrypt media using existing E2E keys
 */
class MediaEncryptionService {
  private ready: Promise<void> = sodium.ready;
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();

  private async ensureReady() {
    await this.ready;
  }

  private toB64(bytes: Uint8Array): string {
    // Keep default variant for backward compatibility with stored keys
    return sodium.to_base64(bytes);
  }

  private fromB64(b64: string): Uint8Array {
    // Keep default variant for backward compatibility with stored keys
    return sodium.from_base64(b64);
  }

  // For file operations, use Buffer instead of libsodium base64
  private toB64File(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
  }

  private fromB64File(b64: string): Uint8Array {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }

  private canonicalizeNetwork(network: string): string {
    const normalized = (network || '').trim();
    if (!normalized) return normalized;
    return normalized.replace(/ \(\d+\)$/, '');
  }

  private buildMediaAAD(
    tabType: 'channel' | 'query',
    network: string,
    identifier: string,
    mediaId?: string
  ): string {
    const canonicalNetwork = this.canonicalizeNetwork(network);
    if (mediaId) {
      return `media:${tabType}:${canonicalNetwork}:${identifier}:${mediaId}`;
    }
    return `media:${tabType}:${canonicalNetwork}:${identifier}`;
  }

  /**
   * Detect MIME type from magic bytes (file signature)
   */
  private detectMimeType(bytes: Uint8Array): string {
    if (bytes.length < 4) {
      return 'application/octet-stream';
    }

    // Check magic bytes for common image formats
    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'image/jpeg';
    }

    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'image/png';
    }

    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'image/gif';
    }

    // WebP: RIFF...WEBP
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }

    // MP4: 00 00 00 ?? 66 74 79 70 (ftyp)
    if (bytes.length >= 8 &&
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return 'video/mp4';
    }

    // MP3: FF FB or FF F3 or ID3 tag
    if ((bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xF3)) ||
        (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) {
      return 'audio/mpeg';
    }

    // Default to octet-stream
    return 'application/octet-stream';
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'audio/mpeg': '.mp3',
      'application/octet-stream': '.bin',
    };

    return mimeToExt[mimeType] || '.bin';
  }

  /**
   * Check if tab has E2E encryption enabled
   * @param network - Network ID
   * @param tabId - Tab ID (format: "channel::{network}::{channel}" or "query::{network}::{nick}")
   */
  async hasEncryptionKey(network: string, tabId: string): Promise<boolean> {
    try {
      await this.ensureReady();

      console.log('[MediaEncryptionService] Checking encryption key:', { network, tabId });

      // Check if tabId is provided
      if (!tabId) {
        console.log('[MediaEncryptionService] No tabId provided, cannot determine encryption key');
        return false;
      }

      // Parse tab ID to determine type
      const tabParts = tabId.split('::');
      console.log('[MediaEncryptionService] Tab parts:', tabParts);

      if (tabParts.length < 3) {
        console.log('[MediaEncryptionService] Invalid tab ID format (less than 3 parts)');
        return false;
      }

      const [tabType, tabNetwork, identifier] = tabParts;
      console.log('[MediaEncryptionService] Parsed:', { tabType, tabNetwork, identifier });

      if (tabType === 'channel') {
        // Check if channel has encryption key
        const hasKey = await channelEncryptionService.hasChannelKey(identifier, network);
        console.log('[MediaEncryptionService] Channel encryption check:', { channel: identifier, network, hasKey });
        return hasKey;
      } else if (tabType === 'query') {
        // Check if DM has encryption (bundle exchange) - use network-aware method
        const isEncrypted = await encryptedDMService.isEncryptedForNetwork(network, identifier);
        console.log('[MediaEncryptionService] DM encryption check:', { nick: identifier, network, isEncrypted });
        return isEncrypted;
      }

      console.log('[MediaEncryptionService] Unknown tab type:', tabType);
      return false;
    } catch (error) {
      console.error('[MediaEncryptionService] hasEncryptionKey error:', error);
      return false;
    }
  }

  /**
   * Encrypt a media file using existing E2E key
   * @param fileUri - Local file URI to encrypt
   * @param network - Network ID
   * @param tabId - Tab ID (determines which E2E key to use)
   */
  async encryptMediaFile(
    fileUri: string,
    network: string,
    tabId: string,
    mediaId?: string
  ): Promise<EncryptedMediaResult> {
    try {
      await this.ensureReady();

      // Normalize file URI - remove file:// prefix for RNFS operations
      let normalizedUri = fileUri;
      let isContentUri = false;
      
      if (fileUri.startsWith('file://')) {
        normalizedUri = fileUri.replace('file://', '');
      } else if (fileUri.startsWith('content://')) {
        // Content URIs need to be handled differently - keep as is
        normalizedUri = fileUri;
        isContentUri = true;
      }

      // Check if file exists
      let fileExists = false;
      let actualUri = normalizedUri;
      
      if (isContentUri) {
        // For content URIs, try to read directly (exists check might not work)
        try {
          // Try reading a small chunk to verify file exists
          await RNFS.readFile(normalizedUri, 'base64', 0, 1);
          fileExists = true;
          actualUri = normalizedUri;
        } catch (err) {
          console.error('[MediaEncryptionService] Content URI not accessible:', err);
          return { success: false, error: 'File does not exist or cannot be accessed' };
        }
      } else {
        fileExists = await RNFS.exists(normalizedUri);
        if (!fileExists) {
          // Try with original URI (with file:// prefix)
          const originalExists = await RNFS.exists(fileUri);
          if (!originalExists) {
            console.error('[MediaEncryptionService] File does not exist:', { fileUri, normalizedUri });
            return { success: false, error: 'File does not exist' };
          }
          actualUri = fileUri.startsWith('file://') ? fileUri.replace('file://', '') : fileUri;
        } else {
          actualUri = normalizedUri;
        }
      }

      // Read file as base64 (easier for large files)
      let fileContent: string;
      try {
        fileContent = await RNFS.readFile(actualUri, 'base64');
        
        // Validate that we got content
        if (!fileContent || fileContent.length === 0) {
          return { success: false, error: 'File is empty' };
        }
        
        // Clean base64 string (remove whitespace, newlines, etc.)
        fileContent = fileContent.replace(/\s/g, '');
        
        // Ensure proper base64 padding (add = if needed)
        const padding = fileContent.length % 4;
        if (padding > 0) {
          fileContent += '='.repeat(4 - padding);
        }
        
        // Validate base64 format (basic check)
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(fileContent)) {
          console.error('[MediaEncryptionService] Invalid base64 format');
          return { success: false, error: 'Invalid file format: not valid base64' };
        }
      } catch (err: any) {
        console.error('[MediaEncryptionService] Error reading file:', err);
        // Handle RNFS errors that might have null error codes
        const errorMessage = err?.message || err?.toString() || 'Unknown error';
        return { success: false, error: `Cannot read file: ${errorMessage}` };
      }
      
      // Convert base64 string to Uint8Array
      // Use Buffer for base64 decoding as it's more reliable than libsodium's from_base64
      // for large binary files (especially images/videos)
      let fileBytes: Uint8Array;
      try {
        // Use Buffer directly - it's more reliable for binary data than libsodium's from_base64
        // Buffer handles base64 decoding correctly for all file types
        const buffer = Buffer.from(fileContent, 'base64');
        fileBytes = new Uint8Array(buffer);
        
        // Validate that conversion succeeded
        if (!fileBytes || fileBytes.length === 0) {
          return { success: false, error: 'File conversion failed: empty result' };
        }
        
        console.log('[MediaEncryptionService] File converted successfully, size:', fileBytes.length, 'bytes');
      } catch (err: any) {
        console.error('[MediaEncryptionService] Error converting base64:', err);
        console.error('[MediaEncryptionService] Base64 string length:', fileContent.length);
        console.error('[MediaEncryptionService] Base64 preview:', fileContent.substring(0, 50));
        console.error('[MediaEncryptionService] Base64 last 50 chars:', fileContent.substring(fileContent.length - 50));
        return { success: false, error: `Invalid file format: ${err.message || 'Cannot decode base64'}` };
      }

      // Check if tabId is provided
      if (!tabId) {
        return { success: false, error: 'No tabId provided for encryption' };
      }

      // Parse tab ID to determine encryption method
      const tabParts = tabId.split('::');
      if (tabParts.length < 3) {
        return { success: false, error: 'Invalid tab ID format' };
      }

      const [tabType, , identifier] = tabParts;

      let encryptedBytes: Uint8Array;
      let nonce: Uint8Array;

      if (tabType === 'channel') {
        // Encrypt with channel key
        const result = await this.encryptWithChannelKey(fileBytes, identifier, network, mediaId);
        encryptedBytes = result.encrypted;
        nonce = result.nonce;
      } else if (tabType === 'query') {
        // Encrypt with DM key
        const result = await this.encryptWithDMKey(fileBytes, identifier, network, mediaId);
        encryptedBytes = result.encrypted;
        nonce = result.nonce;
      } else {
        return { success: false, error: 'Unsupported tab type for encryption' };
      }

      // Save encrypted file to temp location
      // Ensure cache directory exists
      const cacheDir = RNFS.CachesDirectoryPath;
      const cacheExists = await RNFS.exists(cacheDir);
      if (!cacheExists) {
        throw new Error('Cache directory does not exist');
      }

      const tempPath = `${cacheDir}/encrypted_${Date.now()}.bin`;
      try {
        // Prepend nonce to encrypted data for storage/upload
        // Format: [nonce_bytes (24 bytes)][encrypted_bytes]
        // This ensures binary compatibility and proper nonce extraction
        const combinedBytes = new Uint8Array(nonce.length + encryptedBytes.length);
        combinedBytes.set(nonce, 0);
        combinedBytes.set(encryptedBytes, nonce.length);
        
        if (!combinedBytes || combinedBytes.length === 0) {
          throw new Error('Encrypted data is empty');
        }
        
        console.log('[MediaEncryptionService] Encryption details:', {
          nonceLength: nonce.length,
          encryptedLength: encryptedBytes.length,
          combinedLength: combinedBytes.length,
        });
        console.log('[MediaEncryptionService] Nonce preview (first 8 bytes):', Array.from(nonce.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('[MediaEncryptionService] Encrypted preview (first 16 bytes):', Array.from(encryptedBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        // Convert to base64 for storage
        // Write as UTF-8 text (base64 string) to avoid RNFS.writeFile base64 encoding issues
        // Use Buffer-based encoding for file data (more reliable than libsodium for large files)
        const combinedB64 = this.toB64File(combinedBytes);
        
        console.log('[MediaEncryptionService] Combined bytes length:', combinedBytes.length);
        console.log('[MediaEncryptionService] Combined base64 length:', combinedB64.length);
        
        // Write file as UTF-8 text (base64 string)
        // We'll read it back as UTF-8 and convert from base64 to binary during upload
        try {
          await RNFS.writeFile(tempPath, combinedB64, 'utf8');
        } catch (writeError: any) {
          // Handle RNFS errors - extract message safely
          let errorMsg = 'Failed to write file';
          if (writeError) {
            if (typeof writeError === 'string') {
              errorMsg = writeError;
            } else if (writeError.message) {
              errorMsg = writeError.message;
            } else if (writeError.toString && typeof writeError.toString === 'function') {
              try {
                errorMsg = writeError.toString();
              } catch {
                errorMsg = 'Unknown write error';
              }
            }
          }
          throw new Error(errorMsg);
        }
        
        // Verify file was written
        const fileExists = await RNFS.exists(tempPath);
        if (!fileExists) {
          throw new Error('File was not created after write operation');
        }
      } catch (writeError: any) {
        console.error('[MediaEncryptionService] Error writing encrypted file:', writeError);
        // Handle RNFS errors that might have null error codes
        let errorMessage = 'Failed to write encrypted file';
        if (writeError) {
          if (typeof writeError === 'string') {
            errorMessage = writeError;
          } else if (writeError.message) {
            errorMessage = writeError.message;
          } else if (writeError.toString) {
            errorMessage = writeError.toString();
          }
        }
        throw new Error(`Failed to save encrypted file: ${errorMessage}`);
      }

      console.log('[MediaEncryptionService] File encrypted successfully');

      return {
        success: true,
        encryptedUri: tempPath,
        nonce: this.toB64(nonce),
      };
    } catch (error: any) {
      console.error('[MediaEncryptionService] Encryption error:', error);
      // Extract meaningful error message, handling cases where error might be malformed
      let errorMessage = 'Encryption failed';
      if (error) {
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.toString) {
          errorMessage = error.toString();
        }
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Decrypt a media file using existing E2E key
   * @param encryptedUri - URI of encrypted file (contains nonce + encrypted data in format: nonce_base64\nencrypted_data_base64)
   * @param network - Network ID
   * @param tabId - Tab ID (determines which E2E key to use)
   */
  async decryptMediaFile(
    encryptedUri: string,
    network: string,
    tabId: string,
    mediaId?: string
  ): Promise<DecryptedMediaResult> {
    try {
      await this.ensureReady();

      // Check if file exists
      const fileExists = await RNFS.exists(encryptedUri);
      if (!fileExists) {
        return { success: false, error: 'Encrypted file does not exist' };
      }

      // Read encrypted file (format: [nonce_bytes (24 bytes)][encrypted_bytes])
      // File is stored as base64 locally, but downloaded as binary from server
      // Server may return multipart form data, so we need to parse it
      const fileContent = await RNFS.readFile(encryptedUri, 'base64');
      
      console.log('[MediaEncryptionService] Raw file content length:', fileContent.length);
      console.log('[MediaEncryptionService] Raw file content preview:', fileContent.substring(0, 100));
      
      // Clean and pad base64 string
      let cleanContent = fileContent.replace(/\s/g, '');
      const padding = cleanContent.length % 4;
      if (padding > 0) {
        cleanContent += '='.repeat(4 - padding);
      }
      
      // Convert base64 to Uint8Array to check if it's multipart
      const tempBuffer = Buffer.from(cleanContent, 'base64');
      const tempBytes = new Uint8Array(tempBuffer);
      
      // Check if file starts with multipart boundary (--*****)
      const multipartBoundary = '--*****';
      const fileStart = String.fromCharCode(...tempBytes.slice(0, Math.min(50, tempBytes.length)));
      
      let combinedBytes: Uint8Array;
      
      if (fileStart.startsWith(multipartBoundary)) {
        // Server returned multipart form data - need to extract binary file
        console.log('[MediaEncryptionService] Detected multipart form data, parsing...');
        
        // Find the boundary and extract the binary content
        // Multipart format: --boundary\nheaders\n\nbinary_content\n--boundary--
        const boundaryIndex = tempBytes.findIndex((byte, idx) => {
          if (idx + multipartBoundary.length > tempBytes.length) return false;
          const slice = tempBytes.slice(idx, idx + multipartBoundary.length);
          const str = String.fromCharCode(...slice);
          return str === multipartBoundary;
        });
        
        if (boundaryIndex === -1) {
          return { success: false, error: 'Could not find multipart boundary' };
        }
        
        // Find the start of binary data (after headers, which end with \r\n\r\n)
        let binaryStart = boundaryIndex + multipartBoundary.length;
        // Skip to end of headers (look for \r\n\r\n or \n\n)
        while (binaryStart < tempBytes.length - 1) {
          if ((tempBytes[binaryStart] === 0x0D && tempBytes[binaryStart + 1] === 0x0A && 
               tempBytes[binaryStart + 2] === 0x0D && tempBytes[binaryStart + 3] === 0x0A) ||
              (tempBytes[binaryStart] === 0x0A && tempBytes[binaryStart + 1] === 0x0A)) {
            binaryStart += (tempBytes[binaryStart] === 0x0D ? 4 : 2);
            break;
          }
          binaryStart++;
        }
        
        // Find the end of binary data (next boundary or end of file)
        let binaryEnd = tempBytes.length;
        for (let i = binaryStart; i < tempBytes.length - multipartBoundary.length; i++) {
          const slice = tempBytes.slice(i, i + multipartBoundary.length);
          const str = String.fromCharCode(...slice);
          if (str === multipartBoundary) {
            binaryEnd = i;
            break;
          }
        }
        
        // Extract binary content (skip any trailing \r\n before boundary)
        while (binaryEnd > binaryStart && (tempBytes[binaryEnd - 1] === 0x0A || tempBytes[binaryEnd - 1] === 0x0D)) {
          binaryEnd--;
        }
        
        combinedBytes = tempBytes.slice(binaryStart, binaryEnd);
        console.log('[MediaEncryptionService] Extracted binary from multipart, length:', combinedBytes.length);
      } else {
        // Direct binary file (no multipart)
        combinedBytes = tempBytes;
        console.log('[MediaEncryptionService] Direct binary file, length:', combinedBytes.length);
      }
      
      // Extract nonce (first 24 bytes) and encrypted data (rest)
      const expectedNonceLength = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
      
      if (combinedBytes.length < expectedNonceLength) {
        console.error('[MediaEncryptionService] File too short! Got:', combinedBytes.length, 'Expected at least:', expectedNonceLength);
        return { success: false, error: `File too short: got ${combinedBytes.length} bytes, expected at least ${expectedNonceLength} bytes` };
      }
      
      const nonceBytes = combinedBytes.slice(0, expectedNonceLength);
      const encryptedBytes = combinedBytes.slice(expectedNonceLength);
      
      console.log('[MediaEncryptionService] Extracted nonce length:', nonceBytes.length, 'expected:', expectedNonceLength);
      console.log('[MediaEncryptionService] Encrypted data length:', encryptedBytes.length);
      console.log('[MediaEncryptionService] Nonce preview (first 8 bytes):', Array.from(nonceBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      console.log('[MediaEncryptionService] Encrypted preview (first 16 bytes):', Array.from(encryptedBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));

      // Check if tabId is provided
      if (!tabId) {
        return { success: false, error: 'No tabId provided for decryption' };
      }

      // Parse tab ID
      const tabParts = tabId.split('::');
      if (tabParts.length < 3) {
        return { success: false, error: 'Invalid tab ID format' };
      }

      const [tabType, , identifier] = tabParts;

      console.log('[MediaEncryptionService] Decrypting with:', { tabType, identifier, network });

      let decryptedBytes: Uint8Array;

      if (tabType === 'channel') {
        // Decrypt with channel key
        console.log('[MediaEncryptionService] Calling decryptWithChannelKey...');
        decryptedBytes = await this.decryptWithChannelKey(
          encryptedBytes,
          nonceBytes,
          identifier,
          network,
          mediaId
        );
      } else if (tabType === 'query') {
        // Decrypt with DM key
        decryptedBytes = await this.decryptWithDMKey(
          encryptedBytes,
          nonceBytes,
          identifier,
          network,
          mediaId
        );
      } else {
        return { success: false, error: 'Unsupported tab type for decryption' };
      }

      // Detect MIME type from magic bytes
      const mimeType = this.detectMimeType(decryptedBytes);
      const extension = this.getExtensionFromMimeType(mimeType);

      // Save decrypted file to temp location with proper extension
      // Ensure cache directory exists
      const cacheDir = RNFS.CachesDirectoryPath;
      const cacheExists = await RNFS.exists(cacheDir);
      if (!cacheExists) {
        throw new Error('Cache directory does not exist');
      }

      const tempPath = `${cacheDir}/decrypted_${Date.now()}${extension}`;
      try {
        const base64Data = this.toB64File(decryptedBytes);
        if (!base64Data || base64Data.length === 0) {
          throw new Error('Decrypted data is empty');
        }
        
        // Wrap RNFS.writeFile in a promise that handles null error codes
        await new Promise<void>((resolve, reject) => {
          // Use a timeout to detect if the promise never resolves/rejects
          const timeout = setTimeout(() => {
            reject(new Error('Write operation timed out'));
          }, 30000); // 30 second timeout
          
          try {
            RNFS.writeFile(tempPath, base64Data, 'base64')
              .then(() => {
                clearTimeout(timeout);
                resolve();
              })
              .catch((err: any) => {
                clearTimeout(timeout);
                // Handle RNFS errors - extract message safely
                let errorMsg = 'Failed to write file';
                if (err) {
                  if (typeof err === 'string') {
                    errorMsg = err;
                  } else if (err.message) {
                    errorMsg = err.message;
                  } else if (err.toString && typeof err.toString === 'function') {
                    try {
                      errorMsg = err.toString();
                    } catch {
                      errorMsg = 'Unknown write error';
                    }
                  }
                }
                reject(new Error(errorMsg));
              });
          } catch (syncError: any) {
            clearTimeout(timeout);
            reject(new Error(`Synchronous error: ${syncError?.message || 'Unknown error'}`));
          }
        });
        
        // Verify file was written
        const fileExists = await RNFS.exists(tempPath);
        if (!fileExists) {
          throw new Error('File was not created after write operation');
        }
        
        // Verify file size matches decrypted data
        const fileInfo = await RNFS.stat(tempPath);
        if (fileInfo.size !== decryptedBytes.length) {
          console.warn('[MediaEncryptionService] File size mismatch:', {
            expected: decryptedBytes.length,
            actual: fileInfo.size,
          });
        }
        
        // Verify file starts with correct magic bytes for detected MIME type
        if (mimeType.startsWith('image/')) {
          const fileContent = await RNFS.readFile(tempPath, 'base64');
          const fileBytes = Buffer.from(fileContent, 'base64');
          const detectedMime = this.detectMimeType(new Uint8Array(fileBytes));
          if (detectedMime !== mimeType) {
            console.warn('[MediaEncryptionService] MIME type mismatch after write:', {
              expected: mimeType,
              detected: detectedMime,
            });
          }
        }
      } catch (writeError: any) {
        console.error('[MediaEncryptionService] Error writing decrypted file:', writeError);
        // Handle RNFS errors that might have null error codes
        let errorMessage = 'Failed to write decrypted file';
        if (writeError) {
          if (typeof writeError === 'string') {
            errorMessage = writeError;
          } else if (writeError.message) {
            errorMessage = writeError.message;
          } else if (writeError.toString) {
            errorMessage = writeError.toString();
          }
        }
        throw new Error(`Failed to save decrypted file: ${errorMessage}`);
      }

      console.log('[MediaEncryptionService] File decrypted successfully, MIME type:', mimeType);

      return {
        success: true,
        decryptedUri: tempPath,
        mimeType,
      };
    } catch (error: any) {
      console.error('[MediaEncryptionService] Decryption error:', error);
      // Extract meaningful error message, handling cases where error might be malformed
      let errorMessage = 'Decryption failed';
      if (error) {
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.toString) {
          errorMessage = error.toString();
        }
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Encrypt bytes with channel encryption key
   */
  private async encryptWithChannelKey(
    data: Uint8Array,
    channel: string,
    network: string,
    mediaId?: string
  ): Promise<{ encrypted: Uint8Array; nonce: Uint8Array }> {
    const channelKey = await channelEncryptionService.getChannelKey(channel, network);
    if (!channelKey) {
      throw new Error('No channel encryption key found');
    }

    const key = this.fromB64(channelKey.key);
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

    const aad = this.buildMediaAAD('channel', network, channel, mediaId);
    const encrypted = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      data,
      aad,
      null,   // nsec (not used)
      nonce,
      key
    );

    return { encrypted, nonce };
  }

  /**
   * Decrypt bytes with channel encryption key
   */
  private async decryptWithChannelKey(
    encrypted: Uint8Array,
    nonce: Uint8Array,
    channel: string,
    network: string,
    mediaId?: string
  ): Promise<Uint8Array> {
    const channelKey = await channelEncryptionService.getChannelKey(channel, network);
    if (!channelKey) {
      throw new Error('No channel encryption key found');
    }

    const key = this.fromB64(channelKey.key);
    
    console.log('[MediaEncryptionService] decryptWithChannelKey:', {
      encryptedLength: encrypted.length,
      nonceLength: nonce.length,
      keyLength: key.length,
      channel,
      network,
    });

    const aadWithId = mediaId ? this.buildMediaAAD('channel', network, channel, mediaId) : null;
    const aad = this.buildMediaAAD('channel', network, channel);
    try {
      const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,   // nsec (not used)
        encrypted,
        aadWithId || aad,
        nonce,
        key
      );

      console.log('[MediaEncryptionService] Decryption successful, decrypted length:', decrypted.length);
      return decrypted;
    } catch (error) {
      try {
        const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
          null,
          encrypted,
          aad,
          nonce,
          key
        );

        console.log('[MediaEncryptionService] Decryption successful, decrypted length:', decrypted.length);
        return decrypted;
      } catch (error) {
        const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
          null,
          encrypted,
          '',
          nonce,
          key
        );

        console.log('[MediaEncryptionService] Decryption successful, decrypted length:', decrypted.length);
        return decrypted;
      }
    }
  }

  /**
   * Encrypt bytes with DM encryption key (derived from bundle)
   */
  private async encryptWithDMKey(
    data: Uint8Array,
    nick: string,
    network: string,
    mediaId?: string
  ): Promise<{ encrypted: Uint8Array; nonce: Uint8Array }> {
    const key = await encryptedDMService.getMessageKeyForNetwork(network, nick);
    const aad = this.buildMediaAAD('query', network, nick, mediaId);

    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

    const encrypted = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      data,
      aad,
      null,
      nonce,
      key
    );

    return { encrypted, nonce };
  }

  /**
   * Decrypt bytes with DM encryption key (derived from bundle)
   */
  private async decryptWithDMKey(
    encrypted: Uint8Array,
    nonce: Uint8Array,
    nick: string,
    network: string,
    mediaId?: string
  ): Promise<Uint8Array> {
    const key = await encryptedDMService.getMessageKeyForNetwork(network, nick);
    const aadWithId = mediaId ? this.buildMediaAAD('query', network, nick, mediaId) : null;
    const aad = this.buildMediaAAD('query', network, nick);

    try {
      return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        encrypted,
        aadWithId || aad,
        nonce,
        key
      );
    } catch (error) {
      try {
        return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
          null,
          encrypted,
          aad,
          nonce,
          key
        );
      } catch (innerError) {
        return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
          null,
          encrypted,
          '',
          nonce,
          key
        );
      }
    }
  }


  /**
   * Get encryption info for debugging/display
   */
  async getEncryptionInfo(network: string, tabId: string): Promise<{
    hasEncryption: boolean;
    type?: 'channel' | 'dm';
    identifier?: string;
  }> {
    try {
      const hasKey = await this.hasEncryptionKey(network, tabId);
      if (!hasKey) {
        return { hasEncryption: false };
      }

      // Check if tabId is provided
      if (!tabId) {
        return { hasEncryption: false };
      }

      const tabParts = tabId.split('::');
      if (tabParts.length < 3) {
        return { hasEncryption: false };
      }

      const [tabType, , identifier] = tabParts;

      return {
        hasEncryption: true,
        type: tabType === 'channel' ? 'channel' : 'dm',
        identifier,
      };
    } catch (error) {
      return { hasEncryption: false };
    }
  }
}

// Export singleton instance
export const mediaEncryptionService = new MediaEncryptionService();
