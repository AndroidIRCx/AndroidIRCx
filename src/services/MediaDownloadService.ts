/**
 * MediaDownloadService - Download, decrypt, and cache encrypted media
 *
 * Features:
 * - Download encrypted media from API
 * - Decrypt with MediaEncryptionService
 * - Cache with MediaCacheService
 * - Progress tracking
 * - Automatic cleanup of temp files
 * - Retry logic
 */

import RNFS from 'react-native-fs';
import { mediaEncryptionService } from './MediaEncryptionService';
import { mediaCacheService } from './MediaCacheService';

export interface DownloadProgress {
  bytesWritten: number;
  contentLength: number;
  percentage: number;
}

export interface DownloadResult {
  success: boolean;
  uri?: string;
  mimeType?: string;
  error?: string;
}

type ProgressCallback = (progress: DownloadProgress) => void;

const API_BASE_URL = 'https://www.androidircx.com/api';
const TEMP_DIR = `${RNFS.CachesDirectoryPath}/temp_media`;

/**
 * MediaDownloadService - Download and decrypt encrypted media
 */
class MediaDownloadService {
  private downloadCache: Map<string, Promise<DownloadResult>> = new Map();

  /**
   * Initialize service (create temp directory)
   */
  async initialize(): Promise<void> {
    try {
      const exists = await RNFS.exists(TEMP_DIR);
      if (!exists) {
        await RNFS.mkdir(TEMP_DIR);
        console.log('[MediaDownloadService] Temp directory created');
      }
    } catch (error) {
      console.error('[MediaDownloadService] Initialize error:', error);
    }
  }

  /**
   * Download, decrypt, and cache media
   * @param mediaId - UUID of media to download
   * @param network - Network identifier
   * @param tabId - Tab identifier (for encryption key)
   * @param onProgress - Optional progress callback
   * @returns Download result with local URI
   */
  async downloadMedia(
    mediaId: string,
    network: string,
    tabId: string,
    onProgress?: ProgressCallback
  ): Promise<DownloadResult> {
    try {
      await this.initialize();

      // Check if tabId is provided before proceeding
      if (!tabId) {
        console.log('[MediaDownloadService] No tabId provided for media:', mediaId);
        return {
          success: false,
          error: 'No tabId provided for decryption - cannot decrypt media',
        };
      }

      // Check if already cached
      const cachedPath = await mediaCacheService.getCachedMedia(mediaId);
      if (cachedPath) {
        console.log('[MediaDownloadService] Using cached media:', mediaId);
        return {
          success: true,
          uri: cachedPath,
        };
      }

      // Check if download is already in progress for this mediaId
      const existingDownload = this.downloadCache.get(mediaId);
      if (existingDownload) {
        console.log('[MediaDownloadService] Reusing existing download:', mediaId);
        return await existingDownload;
      }

      // Start new download
      const downloadPromise = this._downloadAndDecrypt(
        mediaId,
        network,
        tabId,
        onProgress
      );
      this.downloadCache.set(mediaId, downloadPromise);

      try {
        const result = await downloadPromise;
        return result;
      } finally {
        // Remove from cache after completion (success or failure)
        this.downloadCache.delete(mediaId);
      }
    } catch (error: any) {
      console.error('[MediaDownloadService] Download error:', error);
      return {
        success: false,
        error: error.message || 'Failed to download media',
      };
    }
  }

  /**
   * Internal: Download and decrypt media
   */
  private async _downloadAndDecrypt(
    mediaId: string,
    network: string,
    tabId: string,
    onProgress?: ProgressCallback
  ): Promise<DownloadResult> {
    const tempPath = `${TEMP_DIR}/encrypted_${mediaId}`;

    try {
      // Step 1: Download encrypted media from API
      console.log('[MediaDownloadService] Downloading:', mediaId);
      const downloadUrl = `${API_BASE_URL}/media/download/${mediaId}`;

      // Use fetch to download binary file directly (avoids multipart issues)
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Download failed`);
      }

      // Get response as blob and convert to base64 for RNFS
      const blob = await response.blob();
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data URL prefix (data:application/octet-stream;base64,)
          const base64 = result.split(',')[1] || result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Write binary file to temp path
      await RNFS.writeFile(tempPath, base64Data, 'base64');
      
      // Report progress if callback provided
      if (onProgress) {
        const contentLength = blob.size;
        onProgress({
          bytesWritten: contentLength,
          contentLength: contentLength,
          percentage: 100,
        });
      }

      // Step 2: Decrypt media
      console.log('[MediaDownloadService] Decrypting:', mediaId);

      // Check if tabId is provided before attempting decryption
      if (!tabId) {
        throw new Error('No tabId provided for decryption - cannot decrypt media');
      }

      // decryptMediaFile now extracts nonce from file, so we only need encryptedUri, network, and tabId
      const decryptResult = await mediaEncryptionService.decryptMediaFile(
        tempPath,
        network,
        tabId,
        mediaId
      );

      if (!decryptResult.success || !decryptResult.decryptedUri) {
        throw new Error(decryptResult.error || 'Decryption failed');
      }

      // Step 3: Cache decrypted media
      console.log('[MediaDownloadService] Caching:', mediaId);
      const cacheResult = await mediaCacheService.cacheMedia(
        mediaId,
        decryptResult.decryptedUri,
        decryptResult.mimeType
      );

      if (!cacheResult.success) {
        console.warn('[MediaDownloadService] Cache failed:', cacheResult.error);
        // Still return success if decrypt worked (caching is optional)
      }

      // Step 4: Cleanup temp encrypted file
      try {
        await RNFS.unlink(tempPath);
      } catch (cleanupError) {
        console.warn('[MediaDownloadService] Cleanup error:', cleanupError);
        // Ignore cleanup errors
      }

      // Return cached path if available, otherwise decrypted path
      const finalUri = cacheResult.cachedPath || decryptResult.decryptedUri;

      return {
        success: true,
        uri: finalUri,
        mimeType: decryptResult.mimeType,
      };
    } catch (error: any) {
      console.error('[MediaDownloadService] Download/decrypt error:', error);

      // Cleanup temp file on error
      try {
        const exists = await RNFS.exists(tempPath);
        if (exists) {
          await RNFS.unlink(tempPath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return {
        success: false,
        error: error.message || 'Failed to download/decrypt media',
      };
    }
  }

  /**
   * Download media with retry logic
   * @param mediaId - UUID of media
   * @param network - Network identifier
   * @param tabId - Tab identifier
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param onProgress - Optional progress callback
   */
  async downloadMediaWithRetry(
    mediaId: string,
    network: string,
    tabId: string,
    maxRetries: number = 3,
    onProgress?: ProgressCallback
  ): Promise<DownloadResult> {
    // Check if tabId is provided before attempting any downloads
    if (!tabId) {
      console.log('[MediaDownloadService] No tabId provided for media:', mediaId);
      return {
        success: false,
        error: 'No tabId provided for decryption - cannot decrypt media',
      };
    }

    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[MediaDownloadService] Attempt ${attempt}/${maxRetries} for ${mediaId}`);

      const result = await this.downloadMedia(mediaId, network, tabId, onProgress);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.log(`[MediaDownloadService] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      error: lastError || 'Download failed after retries',
    };
  }

  /**
   * Check if media is available (cached or downloadable)
   * @param mediaId - UUID of media
   */
  async isMediaAvailable(mediaId: string): Promise<boolean> {
    try {
      // Check cache first
      const cached = await mediaCacheService.isCached(mediaId);
      if (cached) {
        return true;
      }

      // Check if downloadable (HEAD request to check if exists)
      const downloadUrl = `${API_BASE_URL}/media/download/${mediaId}`;

      // Note: RNFS doesn't support HEAD requests directly
      // For now, we'll assume it's available if not cached
      // A proper implementation would need a native module or fetch API
      return true;
    } catch (error) {
      console.error('[MediaDownloadService] Availability check error:', error);
      return false;
    }
  }

  /**
   * Cleanup temp directory
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      const exists = await RNFS.exists(TEMP_DIR);
      if (exists) {
        const files = await RNFS.readDir(TEMP_DIR);
        console.log(`[MediaDownloadService] Cleaning up ${files.length} temp files`);

        for (const file of files) {
          try {
            await RNFS.unlink(file.path);
          } catch (error) {
            console.warn('[MediaDownloadService] Failed to delete temp file:', file.path);
          }
        }
      }
    } catch (error) {
      console.error('[MediaDownloadService] Cleanup error:', error);
    }
  }

  /**
   * Get download URL for media
   * @param mediaId - UUID of media
   */
  getDownloadUrl(mediaId: string): string {
    return `${API_BASE_URL}/media/download/${mediaId}`;
  }
}

// Export singleton instance
export const mediaDownloadService = new MediaDownloadService();
