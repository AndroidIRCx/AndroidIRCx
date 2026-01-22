/**
 * MediaMessageDisplay - Display encrypted media messages inline
 *
 * Features:
 * - Parse !enc-media [uuid] tags from messages
 * - Download encrypted media from API
 * - Decrypt and cache media
 * - Display inline (image, video, audio, file)
 * - Show progress/loading/error states
 * - Encryption indicator (🔒) if enabled
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { mediaSettingsService } from '../services/MediaSettingsService';
import { mediaDownloadService } from '../services/MediaDownloadService';
import { ImagePreview } from './ImagePreview';

interface MediaMessageDisplayProps {
  mediaId: string;
  network: string;
  tabId: string;
  caption?: string;
}

type MediaState = 'loading' | 'ready' | 'error' | 'cached';
type MediaInfo = {
  type: 'image' | 'video' | 'audio' | 'file';
  uri: string;
  mimeType?: string;
};

export const MediaMessageDisplay: React.FC<MediaMessageDisplayProps> = ({
  mediaId,
  network,
  tabId,
  caption,
}) => {
  const t = useT();
  const { colors } = useTheme();

  // Check if tabId is available before proceeding
  const [state, setState] = useState<MediaState>(() => {
    if (!tabId) {
      console.log('[MediaMessageDisplay] No tabId provided for media:', mediaId);
      return 'error'; // Set to error state if no tabId is available
    }
    return 'loading';
  });
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showEncryptionIndicator, setShowEncryptionIndicator] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const checkEncryptionIndicator = async () => {
      const shouldShow = await mediaSettingsService.shouldShowEncryptionIndicator();
      setShowEncryptionIndicator(shouldShow);
    };

    checkEncryptionIndicator();
  }, []);

  useEffect(() => {
    loadMedia();
  }, [mediaId, network, tabId, retryCount]);

  const loadMedia = async () => {
    try {
      // Check if tabId is available before attempting to download
      if (!tabId) {
        throw new Error('No tabId provided for decryption - cannot decrypt media');
      }

      setState('loading');
      setError(null);

      // Download, decrypt, and cache media using MediaDownloadService
      const result = await mediaDownloadService.downloadMediaWithRetry(
        mediaId,
        network,
        tabId,
        3, // max retries
        (progressInfo) => {
          setProgress(Math.round(progressInfo.percentage));
        }
      );

      if (!result.success || !result.uri) {
        throw new Error(result.error || t('Failed to load media'));
      }

      // Detect media type and display
      const type = await detectMediaType(result.uri, result.mimeType);
      
      // Ensure URI has file:// prefix for React Native Image component
      // On Android, Image component can handle file:// URIs
      let finalUri = result.uri;
      if (!finalUri.startsWith('file://') && !finalUri.startsWith('content://')) {
        finalUri = `file://${finalUri}`;
      }
      
      // Verify file exists
      const fileExists = await RNFS.exists(finalUri.replace('file://', ''));
      console.log('[MediaMessageDisplay] Setting media info:', {
        type,
        uri: finalUri,
        mimeType: result.mimeType,
        originalUri: result.uri,
        fileExists,
      });
      
      if (!fileExists) {
        throw new Error(`Media file does not exist: ${finalUri}`);
      }
      
      setMediaInfo({
        type,
        uri: finalUri,
        mimeType: result.mimeType,
      });
      setState('ready');

      console.log('[MediaMessageDisplay] Media loaded successfully:', mediaId);
    } catch (err: any) {
      console.error('[MediaMessageDisplay] Load error:', err);
      setError(err.message || t('Failed to load media'));
      setState('error');
    }
  };

  const detectMediaType = async (filePath: string, mimeType?: string): Promise<'image' | 'video' | 'audio' | 'file'> => {
    try {
      // First try to detect from MIME type if available
      if (mimeType) {
        if (mimeType.startsWith('image/')) {
          return 'image';
        }
        if (mimeType.startsWith('video/')) {
          return 'video';
        }
        if (mimeType.startsWith('audio/')) {
          return 'audio';
        }
      }

      // Fallback to extension detection
      const extension = filePath.split('.').pop()?.toLowerCase();

      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension || '')) {
        return 'image';
      }

      if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension || '')) {
        return 'video';
      }

      if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(extension || '')) {
        return 'audio';
      }

      return 'file';
    } catch {
      return 'file';
    }
  };

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  const renderMedia = () => {
    if (!mediaInfo) return null;

    switch (mediaInfo.type) {
      case 'image':
        return (
          <View style={styles.mediaContainer}>
            <ImagePreview url={mediaInfo.uri} thumbnail={true} />
          </View>
        );

      case 'video':
        return (
          <View style={styles.mediaContainer}>
            <Video
              source={{ uri: mediaInfo.uri }}
              style={styles.video}
              controls
              paused
              resizeMode="contain"
            />
          </View>
        );

      case 'audio':
        return (
          <View style={[styles.mediaContainer, styles.audioContainer]}>
            <Text style={[styles.audioIcon, { color: colors.text }]}>🎵</Text>
            <Text style={[styles.audioLabel, { color: colors.text }]}>
              {t('Audio Message')}
            </Text>
            <Video
              source={{ uri: mediaInfo.uri }}
              controls
              paused
              style={styles.audioPlayer}
            />
          </View>
        );

      case 'file':
        return (
          <TouchableOpacity
            style={[styles.mediaContainer, styles.fileContainer, { backgroundColor: colors.surfaceVariant }]}
            onPress={async () => {
              try {
                // Use react-native-share to open file
                await Share.open({
                  url: mediaInfo.uri,
                  type: mediaInfo.mimeType || 'application/octet-stream',
                });
              } catch (error: any) {
                // Share dialog was cancelled or failed
                if (error.message !== 'User did not share') {
                  console.error('[MediaMessageDisplay] Error opening file:', error);
                }
              }
            }}>
            <Text style={[styles.fileIcon, { color: colors.text }]}>📄</Text>
            <Text style={[styles.fileLabel, { color: colors.text }]}>
              {t('File')}
            </Text>
            <Text style={[styles.fileSubtext, { color: colors.textSecondary }]}>
              {t('Tap to open')}
            </Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Encryption indicator */}
      {showEncryptionIndicator && (state === 'ready' || state === 'cached') && (
        <View style={styles.encryptionBadge}>
          <Text style={styles.encryptionIcon}>🔒</Text>
          <Text style={[styles.encryptionText, { color: colors.textSecondary }]}>
            {t('Encrypted')}
          </Text>
        </View>
      )}

      {/* Loading state */}
      {state === 'loading' && (
        <View style={[styles.stateContainer, { backgroundColor: colors.surfaceVariant }]}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.stateText, { color: colors.text }]}>
            {progress > 0 && progress < 100
              ? t('Downloading... {progress}%', { progress })
              : t('Loading encrypted media...')}
          </Text>
        </View>
      )}

      {/* Error state */}
      {state === 'error' && (
        <View style={[styles.stateContainer, { backgroundColor: colors.error + '20' }]}>
          <Text style={[styles.errorIcon, { color: colors.error }]}>⚠️</Text>
          {error?.includes('No tabId provided for decryption') ? (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {t('Cannot decrypt media: insufficient context. This may happen if the message is viewed outside its original channel or if encryption keys are not available.')}
            </Text>
          ) : (
            <>
              <Text style={[styles.errorText, { color: colors.error }]}>
                {error || t('Failed to load media')}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.accent }]}
                onPress={handleRetry}>
                <Text style={styles.retryButtonText}>{t('Retry')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Media display */}
      {(state === 'ready' || state === 'cached') && renderMedia()}

      {/* Caption */}
      {caption && (state === 'ready' || state === 'cached') && (
        <Text style={[styles.caption, { color: colors.text }]}>
          {caption}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  encryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 12,
    marginBottom: 6,
  },
  encryptionIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  encryptionText: {
    fontSize: 11,
    fontWeight: '500',
  },
  stateContainer: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  stateText: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  mediaContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  audioContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 16,
    alignItems: 'center',
  },
  audioIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  audioLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  audioPlayer: {
    width: '100%',
    height: 50,
  },
  fileContainer: {
    padding: 20,
    alignItems: 'center',
  },
  fileIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  fileLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  fileSubtext: {
    fontSize: 12,
  },
  caption: {
    fontSize: 14,
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
