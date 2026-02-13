/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * MediaPickerService - Unified interface for picking/capturing media
 *
 * Supports:
 * - Image: Pick from gallery or capture with camera
 * - Video: Pick from gallery or record with camera
 * - Voice: Record audio message
 * - File: Pick generic file (gif, audio, documents, etc.)
 *
 * Uses:
 * - react-native-vision-camera for camera/video
 * - @react-native-documents/picker for file picker
 * - react-native-fs for file info
 */

import { Camera, useCameraDevice } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import { Platform, PermissionsAndroid } from 'react-native';

// Dynamic import for DocumentPicker to handle cases where it might not be available
let DocumentPicker: any = null;
let pickFunction: any = null;
let DocumentPickerTypes: any = null;
let isCancelFunction: any = null;

try {
  const pickerModule = require('@react-native-documents/picker');
  DocumentPicker = pickerModule.default || pickerModule;
  pickFunction = pickerModule.pick || DocumentPicker?.pick;
  DocumentPickerTypes = pickerModule.types || DocumentPicker?.types;
  isCancelFunction = pickerModule.isCancel || DocumentPicker?.isCancel;
} catch (e) {
  console.warn('[MediaPickerService] DocumentPicker not available:', e);
}

// Check if DocumentPicker is available
const isDocumentPickerAvailable = () => {
  return pickFunction && typeof pickFunction === 'function' && DocumentPickerTypes;
};

export type MediaType = 'image' | 'video' | 'voice' | 'gif' | 'file';

export interface MediaPickResult {
  success: boolean;
  uri?: string;            // Local file URI
  type?: MediaType;        // Media type
  mimeType?: string;       // MIME type (e.g., 'image/jpeg')
  fileName?: string;       // Original file name
  size?: number;           // File size in bytes
  duration?: number;       // Duration for audio/video (seconds)
  width?: number;          // Image/video width
  height?: number;         // Image/video height
  error?: string;
}

/**
 * MediaPickerService - Handle media selection and capture
 */
class MediaPickerService {
  /**
   * Pick image from gallery
   */
  async pickImage(): Promise<MediaPickResult> {
    try {
      // Check if DocumentPicker is available
      if (!isDocumentPickerAvailable()) {
        return {
          success: false,
          error: 'Document picker is not available. Please ensure @react-native-documents/picker is properly installed and linked.',
        };
      }

      // Use DocumentPicker for image selection
      const result = await pickFunction({
        type: [DocumentPickerTypes.images],
        allowMultiSelection: false,
      });
      
      // Handle array response (pick can return array)
      const pickedFile = Array.isArray(result) ? result[0] : result;

      if (!pickedFile) {
        return { success: false, error: 'No file selected' };
      }

      // Handle content URI properly by copying to local file
      let localFilePath: string;
      if (pickedFile.uri.startsWith('content://')) {
        // Copy content URI to local file in cache directory
        const fileName = pickedFile.name || `photo_${Date.now()}.${this.getFileExtension(pickedFile.type || 'image/jpeg')}`;
        localFilePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

        try {
          // Use RNFS to copy file from content URI to local path
          await RNFS.copyFile(pickedFile.uri, localFilePath);
        } catch (copyError) {
          console.warn('[MediaPickerService] Could not copy content URI, trying readFile/writeFile:', copyError);
          try {
            // Alternative method: read file content and write to local file
            const fileContent = await RNFS.readFile(pickedFile.uri, 'base64');
            await RNFS.writeFile(localFilePath, fileContent, 'base64');
          } catch (readWriteError) {
            console.warn('[MediaPickerService] Could not read/write file, trying downloadFile:', readWriteError);
            // Last resort: try to treat content URI as URL
            const downloadResult = await RNFS.downloadFile({
              fromUrl: pickedFile.uri,
              toFile: localFilePath,
            }).promise;

            if (downloadResult.statusCode !== 200) {
              throw new Error(`Download failed with status ${downloadResult.statusCode}`);
            }
          }
        }
      } else {
        // For file URIs, use as is
        localFilePath = pickedFile.fileCopyUri || pickedFile.uri;
      }

      // Get file info for the local file
      let fileInfo;
      try {
        fileInfo = await this.getFileInfo(localFilePath);
      } catch (err) {
        console.warn('[MediaPickerService] Could not get file info:', err);
        fileInfo = { size: pickedFile.size || 0, isFile: true, name: pickedFile.name || 'unknown' };
      }

      // Normalize URI - ensure it has file:// prefix if it's a file path
      let normalizedUri = localFilePath;
      if (localFilePath && !localFilePath.startsWith('file://') && !localFilePath.startsWith('content://') && !localFilePath.startsWith('http')) {
        normalizedUri = Platform.OS === 'android' ? `file://${localFilePath}` : `file://${localFilePath}`;
      }

      return {
        success: true,
        uri: normalizedUri,
        type: this.determineMediaType(pickedFile.type || '', pickedFile.name || ''),
        mimeType: pickedFile.type || 'image/jpeg',
        fileName: pickedFile.name,
        size: pickedFile.size || fileInfo.size,
      };
    } catch (error: any) {
      // Check if user cancelled
      try {
        if (error && DocumentPicker && DocumentPicker.isCancel && DocumentPicker.isCancel(error)) {
          return { success: false, error: 'User cancelled' };
        }
        // Also check for common cancel error messages
        if (error?.message && (error.message.includes('cancel') || error.message.includes('User cancelled'))) {
          return { success: false, error: 'User cancelled' };
        }
      } catch (checkError) {
        // DocumentPicker.isCancel might not be available or error format is unexpected
        console.warn('[MediaPickerService] Error checking cancel status:', checkError);
      }
      
      console.error('[MediaPickerService] Pick image error:', error);
      return {
        success: false,
        error: error?.message || error?.toString() || 'Failed to pick image',
      };
    }
  }

  /**
   * Capture photo with camera
   * Note: This method should be called from a component that can show CameraScreen modal
   * The actual camera capture is handled by CameraScreen component
   * This method is kept for API compatibility but returns an error directing to use CameraScreen
   */
  async capturePhoto(): Promise<MediaPickResult> {
    try {
      // Permission should already be requested by the caller
      // Just verify it's granted
      const hasPermission = await this.requestCameraPermission();
      if (!hasPermission) {
        return { 
          success: false, 
          error: 'Camera permission denied' 
        };
      }

      // This method should not be called directly
      // Camera capture is handled by CameraScreen component via MediaUploadModal
      return {
        success: false,
        error: 'Camera capture should be handled by CameraScreen component. Please use MediaUploadModal.',
      };
    } catch (error: any) {
      console.error('[MediaPickerService] Capture photo error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to capture photo',
      };
    }
  }

  /**
   * Pick video from gallery
   */
  async pickVideo(): Promise<MediaPickResult> {
    try {
      // Check if DocumentPicker is available
      if (!isDocumentPickerAvailable()) {
        return {
          success: false,
          error: 'Document picker is not available. Please ensure @react-native-documents/picker is properly installed and linked.',
        };
      }

      const result = await pickFunction({
        type: [DocumentPickerTypes.video],
        allowMultiSelection: false,
      });
      
      // Handle array response (pick can return array)
      const pickedFile = Array.isArray(result) ? result[0] : result;
      
      if (!pickedFile) {
        return { success: false, error: 'No file selected' };
      }

      // Handle content URI properly by copying to local file
      let localFilePath: string;
      if (pickedFile.uri.startsWith('content://')) {
        // Copy content URI to local file in cache directory
        const fileName = pickedFile.name || `video_${Date.now()}.${this.getFileExtension(pickedFile.type || 'video/mp4')}`;
        localFilePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

        try {
          // Use RNFS to copy file from content URI to local path
          await RNFS.copyFile(pickedFile.uri, localFilePath);
        } catch (copyError) {
          console.warn('[MediaPickerService] Could not copy content URI, trying readFile/writeFile:', copyError);
          try {
            // Alternative method: read file content and write to local file
            const fileContent = await RNFS.readFile(pickedFile.uri, 'base64');
            await RNFS.writeFile(localFilePath, fileContent, 'base64');
          } catch (readWriteError) {
            console.warn('[MediaPickerService] Could not read/write file, trying downloadFile:', readWriteError);
            // Last resort: try to treat content URI as URL
            const downloadResult = await RNFS.downloadFile({
              fromUrl: pickedFile.uri,
              toFile: localFilePath,
            }).promise;

            if (downloadResult.statusCode !== 200) {
              throw new Error(`Download failed with status ${downloadResult.statusCode}`);
            }
          }
        }
      } else {
        // For file URIs, use as is
        localFilePath = pickedFile.fileCopyUri || pickedFile.uri;
      }

      // Get file info for the local file
      let fileInfo;
      try {
        fileInfo = await this.getFileInfo(localFilePath);
      } catch (err) {
        console.warn('[MediaPickerService] Could not get file info:', err);
        fileInfo = { size: pickedFile.size || 0, isFile: true, name: pickedFile.name || 'unknown' };
      }

      // Normalize URI
      let normalizedUri = localFilePath;
      if (localFilePath && !localFilePath.startsWith('file://') && !localFilePath.startsWith('content://') && !localFilePath.startsWith('http')) {
        normalizedUri = Platform.OS === 'android' ? `file://${localFilePath}` : `file://${localFilePath}`;
      }

      return {
        success: true,
        uri: normalizedUri,
        type: 'video',
        mimeType: pickedFile.type || 'video/mp4',
        fileName: pickedFile.name,
        size: pickedFile.size || fileInfo.size,
        // Duration extraction would require native video metadata reading
        // Can be added later with react-native-video or custom native module
      };
    } catch (error: any) {
      // Check if user cancelled
      try {
        if (error && isCancelFunction && isCancelFunction(error)) {
          return { success: false, error: 'User cancelled' };
        }
        // Also check for common cancel error messages
        if (error?.message && (error.message.includes('cancel') || error.message.includes('User cancelled'))) {
          return { success: false, error: 'User cancelled' };
        }
      } catch (checkError) {
        // DocumentPicker.isCancel might not be available or error format is unexpected
        console.warn('[MediaPickerService] Error checking cancel status:', checkError);
      }
      
      console.error('[MediaPickerService] Pick video error:', error);
      return {
        success: false,
        error: error?.message || error?.toString() || 'Failed to pick video',
      };
    }
  }

  /**
   * Record video with camera
   * Note: Placeholder - needs camera screen implementation
   */
  async recordVideo(): Promise<MediaPickResult> {
    try {
      // Permissions should already be requested by the caller
      // Just verify they're granted
      const hasCameraPermission = await this.requestCameraPermission();
      if (!hasCameraPermission) {
        return { 
          success: false, 
          error: 'Camera permission denied' 
        };
      }

      const hasMicPermission = await this.requestMicrophonePermission();
      if (!hasMicPermission) {
        return { 
          success: false, 
          error: 'Microphone permission denied' 
        };
      }

      // TODO: Implement video recording screen
      return {
        success: false,
        error: 'Video recording feature is not yet implemented. Please use "Video Library" option to select an existing video.',
      };
    } catch (error: any) {
      console.error('[MediaPickerService] Record video error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to record video',
      };
    }
  }

  /**
   * Record voice message
   * Note: Placeholder - needs audio recording implementation
   */
  async recordVoice(): Promise<MediaPickResult> {
    try {
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        return { success: false, error: 'Microphone permission denied' };
      }

      // TODO: Implement audio recording
      // - Create VoiceRecorder component
      // - Use react-native-audio-recorder or similar
      // - Save to cache directory
      // - Return file URI with duration
      return {
        success: false,
        error: 'Voice recording not yet implemented',
      };
    } catch (error: any) {
      console.error('[MediaPickerService] Record voice error:', error);
      return {
        success: false,
        error: error.message || 'Failed to record voice',
      };
    }
  }

  /**
   * Pick generic file (documents, audio, gif, etc.)
   */
  async pickFile(): Promise<MediaPickResult> {
    try {
      // Check if DocumentPicker is available
      if (!isDocumentPickerAvailable()) {
        return {
          success: false,
          error: 'Document picker is not available. Please ensure @react-native-documents/picker is properly installed and linked.',
        };
      }

      const result = await pickFunction({
        type: [DocumentPickerTypes.allFiles],
        allowMultiSelection: false,
      });
      
      // Handle array response (pick can return array)
      const pickedFile = Array.isArray(result) ? result[0] : result;
      
      if (!pickedFile) {
        return { success: false, error: 'No file selected' };
      }

      // Handle content URI properly by copying to local file
      let localFilePath: string;
      if (pickedFile.uri.startsWith('content://')) {
        // Copy content URI to local file in cache directory
        const fileName = pickedFile.name || `file_${Date.now()}.${this.getFileExtension(pickedFile.type || 'application/octet-stream')}`;
        localFilePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

        try {
          // Use RNFS to copy file from content URI to local path
          await RNFS.copyFile(pickedFile.uri, localFilePath);
        } catch (copyError) {
          console.warn('[MediaPickerService] Could not copy content URI, trying readFile/writeFile:', copyError);
          try {
            // Alternative method: read file content and write to local file
            const fileContent = await RNFS.readFile(pickedFile.uri, 'base64');
            await RNFS.writeFile(localFilePath, fileContent, 'base64');
          } catch (readWriteError) {
            console.warn('[MediaPickerService] Could not read/write file, trying downloadFile:', readWriteError);
            // Last resort: try to treat content URI as URL
            const downloadResult = await RNFS.downloadFile({
              fromUrl: pickedFile.uri,
              toFile: localFilePath,
            }).promise;

            if (downloadResult.statusCode !== 200) {
              throw new Error(`Download failed with status ${downloadResult.statusCode}`);
            }
          }
        }
      } else {
        // For file URIs, use as is
        localFilePath = pickedFile.fileCopyUri || pickedFile.uri;
      }

      // Get file info for the local file
      let fileInfo;
      try {
        fileInfo = await this.getFileInfo(localFilePath);
      } catch (err) {
        console.warn('[MediaPickerService] Could not get file info:', err);
        fileInfo = { size: pickedFile.size || 0, isFile: true, name: pickedFile.name || 'unknown' };
      }

      // Normalize URI
      let normalizedUri = localFilePath;
      if (localFilePath && !localFilePath.startsWith('file://') && !localFilePath.startsWith('content://') && !localFilePath.startsWith('http')) {
        normalizedUri = Platform.OS === 'android' ? `file://${localFilePath}` : `file://${localFilePath}`;
      }

      return {
        success: true,
        uri: normalizedUri,
        type: this.determineMediaType(pickedFile.type || '', pickedFile.name || ''),
        mimeType: pickedFile.type || 'application/octet-stream',
        fileName: pickedFile.name,
        size: pickedFile.size || fileInfo.size,
      };
    } catch (error: any) {
      // Check if user cancelled
      try {
        if (error && isCancelFunction && isCancelFunction(error)) {
          return { success: false, error: 'User cancelled' };
        }
        // Also check for common cancel error messages
        if (error?.message && (error.message.includes('cancel') || error.message.includes('User cancelled'))) {
          return { success: false, error: 'User cancelled' };
        }
      } catch (checkError) {
        // DocumentPicker.isCancel might not be available or error format is unexpected
        console.warn('[MediaPickerService] Error checking cancel status:', checkError);
      }
      
      console.error('[MediaPickerService] Pick file error:', error);
      return {
        success: false,
        error: error?.message || error?.toString() || 'Failed to pick file',
      };
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    const mimeToExt: {[key: string]: string} = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'video/mp4': 'mp4',
      'video/avi': 'avi',
      'video/mov': 'mov',
      'video/wmv': 'wmv',
      'video/mkv': 'mkv',
      'video/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/m4a': 'm4a',
      'audio/aac': 'aac',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt',
      'application/zip': 'zip',
    };

    return mimeToExt[mimeType.toLowerCase()] || 'bin';
  }

  /**
   * Get detailed file information
   */
  async getFileInfo(uri: string): Promise<{
    size: number;
    isFile: boolean;
    name: string;
    mtime?: Date;
  }> {
    let normalizedUri = uri;
    try {
      // Normalize URI - remove file:// prefix for RNFS operations
      if (uri.startsWith('file://')) {
        normalizedUri = uri.replace('file://', '');
      } else if (uri.startsWith('content://')) {
        // Content URIs might not work with RNFS.stat - return basic info
        // Try to get file size from RNFS if possible
        try {
          const stat = await RNFS.stat(normalizedUri);
          return {
            size: stat.size,
            isFile: stat.isFile(),
            name: stat.name || 'unknown',
            mtime: stat.mtime,
          };
        } catch (err) {
          // Content URIs might not be accessible via RNFS
          console.warn('[MediaPickerService] Cannot stat content URI, returning basic info');
          return {
            size: 0,
            isFile: true,
            name: 'unknown',
          };
        }
      }

      const stat = await RNFS.stat(normalizedUri);
      return {
        size: stat.size,
        isFile: stat.isFile(),
        name: stat.name || 'unknown',
        mtime: stat.mtime,
      };
    } catch (error) {
      console.error('[MediaPickerService] Get file info error:', error);
      // Try with original URI if normalized failed
      if (uri !== normalizedUri) {
        try {
          const stat = await RNFS.stat(uri);
          return {
            size: stat.size,
            isFile: stat.isFile(),
            name: stat.name || 'unknown',
            mtime: stat.mtime,
          };
        } catch (err2) {
          console.error('[MediaPickerService] Get file info error (retry):', err2);
        }
      }
      return {
        size: 0,
        isFile: false,
        name: 'unknown',
      };
    }
  }

  /**
   * Determine media type from MIME type and filename
   */
  private determineMediaType(mimeType: string, fileName: string): MediaType {
    const mime = mimeType.toLowerCase();
    const ext = fileName.toLowerCase().split('.').pop() || '';

    if (mime.startsWith('image/')) {
      if (mime === 'image/gif' || ext === 'gif') {
        return 'gif';
      }
      return 'image';
    }

    if (mime.startsWith('video/')) {
      return 'video';
    }

    if (mime.startsWith('audio/')) {
      return 'voice';
    }

    // Check file extension
    if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) {
      return 'image';
    }

    if (['gif'].includes(ext)) {
      return 'gif';
    }

    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
      return 'video';
    }

    if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
      return 'voice';
    }

    return 'file';
  }

  /**
   * Request camera permission (Android)
   */
  private async requestCameraPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Check current permission status using PermissionsAndroid
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        
        if (hasPermission) {
          return true;
        }
        
        // Request permission if not granted
        const cameraPermission = await Camera.requestCameraPermission();
        return cameraPermission === 'granted' || cameraPermission === 'authorized';
      }
      return true; // iOS permissions handled in Info.plist
    } catch (error) {
      console.error('[MediaPickerService] Camera permission error:', error);
      return false;
    }
  }

  /**
   * Request microphone permission (Android)
   */
  private async requestMicrophonePermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Check current permission status using PermissionsAndroid
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        
        if (hasPermission) {
          return true;
        }
        
        // Request permission if not granted
        const micPermission = await Camera.requestMicrophonePermission();
        return micPermission === 'granted' || micPermission === 'authorized';
      }
      return true; // iOS permissions handled in Info.plist
    } catch (error) {
      console.error('[MediaPickerService] Microphone permission error:', error);
      return false;
    }
  }

  /**
   * Check if camera is available
   */
  async isCameraAvailable(): Promise<boolean> {
    try {
      const devices = await Camera.getAvailableCameraDevices();
      return devices.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate file before processing
   */
  async validateFile(uri: string, maxSizeBytes: number = 50 * 1024 * 1024): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const fileInfo = await this.getFileInfo(uri);

      if (!fileInfo.isFile) {
        return { valid: false, error: 'Not a file' };
      }

      if (fileInfo.size === 0) {
        return { valid: false, error: 'File is empty' };
      }

      if (fileInfo.size > maxSizeBytes) {
        const sizeMB = (fileInfo.size / 1024 / 1024).toFixed(2);
        const maxMB = (maxSizeBytes / 1024 / 1024).toFixed(0);
        return {
          valid: false,
          error: `File too large: ${sizeMB}MB (max: ${maxMB}MB)`,
        };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Cannot access file' };
    }
  }
}

// Export singleton instance
export const mediaPickerService = new MediaPickerService();
