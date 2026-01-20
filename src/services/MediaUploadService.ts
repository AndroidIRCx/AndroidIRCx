/**
 * MediaUploadService - Handle media upload to AndroidIRCx API
 *
 * Two-step upload process:
 * 1. Request upload token (POST /api/media/request-upload)
 * 2. Upload file binary (PUT /api/media/upload/{id})
 *
 * Features:
 * - HMAC token authentication (5-minute expiry)
 * - Progress tracking with callbacks
 * - Retry logic for network failures
 * - File size validation
 * - Error handling
 */

import RNFS from 'react-native-fs';
import { DeviceEventEmitter, NativeModules } from 'react-native';
import { Buffer } from 'buffer';

// Native modules for reliable HTTP requests
const { HttpPost, HttpPut } = NativeModules;

const API_BASE_URL = 'https://www.androidircx.com/api';

// Maximum file size: 50MB (configurable)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

export type MediaType = 'image' | 'video' | 'voice' | 'gif' | 'sticker' | 'file';

export interface UploadTokenResponse {
  id: string;              // UUID - media identifier
  status: 'pending' | 'ready' | 'failed';
  upload_token: string;    // HMAC-SHA256 token
  expires: number;         // Unix timestamp (5 minutes from now)
}

export interface UploadResult {
  success: boolean;
  mediaId?: string;        // UUID for use in !enc-media tag
  size?: number;           // File size in bytes
  sha256?: string;         // SHA-256 checksum
  status?: 'ready' | 'failed';
  error?: string;
  ircTag?: string;         // Ready-to-use IRC tag: !enc-media [uuid]
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;      // 0-100
}

type ProgressCallback = (progress: UploadProgress) => void;

/**
 * MediaUploadService - Singleton service for media uploads
 */
class MediaUploadService {
  private activeUploads = new Map<string, boolean>(); // Track active uploads
  private retryCount = 3; // Maximum retry attempts

  /**
   * Step 1: Request upload token from API
   * Uses RNFS.uploadFiles with POST method since XMLHttpRequest has issues with POST in React Native
   */
  async requestUploadToken(
    type: MediaType,
    mimeType?: string
  ): Promise<UploadTokenResponse> {
    try {
      const url = `${API_BASE_URL}/media/request-upload`;
      const requestBody = JSON.stringify({
        type,
        mime: mimeType,
      });
      
      console.log('[MediaUploadService] Requesting upload token:', { url, method: 'POST', body: requestBody });
      
      // Use native module for reliable POST requests
      if (!HttpPost) {
        throw new Error('HttpPost native module is not available');
      }

      const responseBody = await HttpPost.postRequest(
        url,
        requestBody,
        {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      );

      console.log('[MediaUploadService] Raw response body:', responseBody);

      // Check if response is HTML (error page) instead of JSON
      if (typeof responseBody === 'string' && responseBody.trim().startsWith('<')) {
        throw new Error(`Received HTML response instead of JSON: ${responseBody.substring(0, 200)}...`);
      }

      const data: UploadTokenResponse = JSON.parse(responseBody);
      console.log('[MediaUploadService] Token received successfully:', { id: data.id, status: data.status });
      return data;
    } catch (error) {
      console.error('[MediaUploadService] Request token error:', error);
      throw error;
    }
  }

  /**
   * Step 2: Upload file binary to server
   */
  async uploadFile(
    fileUri: string,
    mediaId: string,
    uploadToken: string,
    expires: number,
    onProgress?: ProgressCallback
  ): Promise<{ size: number; sha256: string; status: string }> {
    let progressSubscription: { remove: () => void } | null = null;
    let tempBinaryPath: string | null = null;
    try {
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (now >= expires) {
        throw new Error('Upload token expired');
      }

      // Get file info
      const fileInfo = await RNFS.stat(fileUri);
      if (!fileInfo.size) {
        throw new Error('File is empty or does not exist');
      }

      // Construct upload URL with token and expiry
      const uploadUrl = `${API_BASE_URL}/media/upload/${mediaId}?token=${uploadToken}&exp=${expires}`;

      // Read file as UTF-8 (base64 string) and convert to binary for upload
      // The encrypted file is stored as UTF-8 text containing base64 string
      const fileContent = await RNFS.readFile(fileUri, 'utf8');
      
      // Convert base64 string to binary (Uint8Array) using Buffer
      const binaryBuffer = Buffer.from(fileContent, 'base64');
      const bytes = new Uint8Array(binaryBuffer);

      // Write binary data to temporary file for native upload
      tempBinaryPath = `${RNFS.CachesDirectoryPath}/upload_${Date.now()}.bin`;
      const binaryB64 = Buffer.from(bytes).toString('base64');
      await RNFS.writeFile(tempBinaryPath, binaryB64, 'base64');

      // Use native module for reliable PUT requests with binary file upload
      // This ensures proper binary data transmission without multipart wrapping
      this.activeUploads.set(mediaId, true);
      console.log('[MediaUploadService] Upload started, file size:', bytes.length, 'bytes');

      if (onProgress) {
        onProgress({
          bytesUploaded: 0,
          totalBytes: bytes.length,
          percentage: 0,
        });
        progressSubscription = DeviceEventEmitter.addListener('HttpPutProgress', (payload) => {
          if (!payload || payload.uploadId !== mediaId) {
            return;
          }
          const totalBytes = payload.totalBytes || bytes.length;
          const bytesUploaded = payload.bytesWritten || 0;
          const percentage = totalBytes > 0 ? (bytesUploaded / totalBytes) * 100 : 0;
          onProgress({ bytesUploaded, totalBytes, percentage });
        });
      }

      // Use native HttpPut module for direct binary upload
      if (!HttpPut) {
        throw new Error('HttpPut native module is not available');
      }

      const responseBody = await HttpPut.putFile(
        uploadUrl,
        tempBinaryPath,
        {
          'Content-Type': 'application/octet-stream',
          'Accept': 'application/json',
        },
        mediaId
      );

      // Clean up temporary binary file
      try {
        if (tempBinaryPath) {
          await RNFS.unlink(tempBinaryPath);
          tempBinaryPath = null;
        }
      } catch (e) {
        // Ignore cleanup errors
      }

      this.activeUploads.delete(mediaId);

      // Parse response
      const responseData = JSON.parse(responseBody);

      return {
        size: responseData.size,
        sha256: responseData.sha256,
        status: responseData.status,
      };
    } catch (error) {
      this.activeUploads.delete(mediaId);
      console.error('[MediaUploadService] Upload file error:', error);
      throw error;
    } finally {
      if (progressSubscription) {
        progressSubscription.remove();
      }
      if (tempBinaryPath) {
        try {
          await RNFS.unlink(tempBinaryPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Combined upload function: Request token + Upload file
   * With retry logic and validation
   */
  async uploadMedia(
    fileUri: string,
    type: MediaType,
    mimeType?: string,
    onProgress?: ProgressCallback
  ): Promise<UploadResult> {
    let attempt = 0;
    const maxRetries = this.retryCount;

    while (attempt < maxRetries) {
      try {
        // Validate file exists and size
        const fileInfo = await RNFS.stat(fileUri);
        if (!fileInfo.isFile()) {
          return {
            success: false,
            error: 'Invalid file: Not a file',
          };
        }

        // Check file size
        if (fileInfo.size > MAX_FILE_SIZE) {
          return {
            success: false,
            error: `File too large: ${(fileInfo.size / 1024 / 1024).toFixed(2)}MB (max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
          };
        }

        console.log('[MediaUploadService] Starting upload:', {
          type,
          mimeType,
          size: fileInfo.size,
          attempt: attempt + 1,
        });

        // Step 1: Request upload token
        const tokenData = await this.requestUploadToken(type, mimeType);
        const { id: mediaId, upload_token, expires, status } = tokenData;

        if (status !== 'pending') {
          return {
            success: false,
            error: `Invalid upload status: ${status}`,
          };
        }

        console.log('[MediaUploadService] Token received:', mediaId);

        // Step 2: Upload file
        const uploadData = await this.uploadFile(
          fileUri,
          mediaId,
          upload_token,
          expires,
          onProgress
        );

        console.log('[MediaUploadService] Upload successful:', uploadData);

        // Return success result
        return {
          success: true,
          mediaId,
          size: uploadData.size,
          sha256: uploadData.sha256,
          status: uploadData.status as 'ready' | 'failed',
          ircTag: `!enc-media [${mediaId}]`,
        };
      } catch (error: any) {
        attempt++;
        console.error(`[MediaUploadService] Upload attempt ${attempt} failed:`, error);

        // Check if we should retry
        const shouldRetry = this.shouldRetry(error, attempt, maxRetries);
        if (!shouldRetry) {
          return {
            success: false,
            error: error.message || 'Upload failed',
          };
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
          console.log(`[MediaUploadService] Retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // Max retries exceeded
    return {
      success: false,
      error: `Upload failed after ${maxRetries} attempts`,
    };
  }

  /**
   * Determine if error is retryable
   */
  private shouldRetry(error: any, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) {
      return false;
    }

    const errorMessage = error.message?.toLowerCase() || '';

    // Don't retry permanent errors
    const permanentErrors = [
      'token expired',
      'upload not allowed',
      'file too large',
      'invalid file',
      'file is empty',
    ];

    for (const permError of permanentErrors) {
      if (errorMessage.includes(permError)) {
        return false;
      }
    }

    // Retry network errors and server errors
    return true;
  }

  /**
   * Cancel an active upload
   */
  cancelUpload(mediaId: string): void {
    if (this.activeUploads.has(mediaId)) {
      // RNFS doesn't provide a direct cancel method for uploadFiles
      // We'll track it and handle cleanup
      this.activeUploads.delete(mediaId);
      console.log('[MediaUploadService] Upload cancelled:', mediaId);
    }
  }

  /**
   * Check if upload is in progress
   */
  isUploading(mediaId: string): boolean {
    return this.activeUploads.has(mediaId);
  }

  /**
   * Get active uploads count
   */
  getActiveUploadsCount(): number {
    return this.activeUploads.size;
  }

  /**
   * Set maximum file size limit
   */
  setMaxFileSize(sizeInBytes: number): void {
    // This will be configurable from settings later
    console.log('[MediaUploadService] Max file size updated:', sizeInBytes);
  }

  /**
   * Validate file before upload
   */
  async validateFile(fileUri: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const fileInfo = await RNFS.stat(fileUri);

      if (!fileInfo.isFile()) {
        return { valid: false, error: 'Not a file' };
      }

      if (fileInfo.size === 0) {
        return { valid: false, error: 'File is empty' };
      }

      if (fileInfo.size > MAX_FILE_SIZE) {
        return {
          valid: false,
          error: `File too large: ${(fileInfo.size / 1024 / 1024).toFixed(2)}MB (max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'File does not exist or cannot be accessed' };
    }
  }
}

// Export singleton instance
export const mediaUploadService = new MediaUploadService();
