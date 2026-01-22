/**
 * MediaPreviewModal - Preview selected media before sending
 *
 * Features:
 * - Preview image/video/audio/file before sending
 * - Show file info (type, size, duration)
 * - Optional caption input
 * - Encryption indicator (🔒) if E2E is active
 * - Send button (triggers: encrypt → upload → IRC message)
 * - Cancel button (discard selection)
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { MediaPickResult, MediaType } from '../services/MediaPickerService';
import { mediaEncryptionService } from '../services/MediaEncryptionService';
import { mediaUploadService } from '../services/MediaUploadService';
import { mediaSettingsService } from '../services/MediaSettingsService';
import RNFS from 'react-native-fs';

interface MediaPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  mediaResult: MediaPickResult | null;
  network: string;
  tabId: string;
  onSendComplete: (ircTag: string, caption?: string) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  visible,
  onClose,
  mediaResult,
  network,
  tabId,
  onSendComplete,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasEncryption, setHasEncryption] = useState(false);
  const [showEncryptionIndicator, setShowEncryptionIndicator] = useState(true);

  // Check if E2E encryption is available and if indicator should be shown
  useEffect(() => {
    const checkEncryption = async () => {
      if (mediaResult && network && tabId) {
        const hasKey = await mediaEncryptionService.hasEncryptionKey(network, tabId);
        setHasEncryption(hasKey);

        const showIndicator = await mediaSettingsService.shouldShowEncryptionIndicator();
        setShowEncryptionIndicator(showIndicator);
      }
    };

    if (visible) {
      checkEncryption();
    }
  }, [visible, mediaResult, network, tabId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setCaption('');
      setUploading(false);
      setUploadProgress(0);
      setError(null);
    }
  }, [visible]);

  const handleSend = async () => {
    if (!mediaResult?.uri) {
      setError(t('No media selected'));
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Normalize file URI - ensure it has file:// prefix if needed
      let fileUri = mediaResult.uri;
      if (!fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
        // If it's a path without protocol, add file://
        if (Platform.OS === 'android') {
          fileUri = `file://${fileUri}`;
        } else {
          fileUri = `file://${fileUri}`;
        }
      }

      // Verify file exists
      const normalizedPath = fileUri.replace('file://', '');
      const fileExists = await RNFS.exists(normalizedPath);
      if (!fileExists) {
        // Try with original URI
        const originalExists = await RNFS.exists(mediaResult.uri);
        if (!originalExists) {
          throw new Error(t('File does not exist. Please select the file again.'));
        }
        fileUri = mediaResult.uri;
      } else {
        fileUri = normalizedPath;
      }

      console.log('[MediaPreviewModal] Processing file:', fileUri);

      // Step 1: Request upload token (gives us mediaId for AAD binding)
      const uploadToken = await mediaUploadService.requestUploadToken(
        mediaResult.type || 'file',
        mediaResult.mimeType
      );

      // Step 2: Encrypt media file (bind AAD to mediaId)
      const encryptResult = await mediaEncryptionService.encryptMediaFile(
        fileUri,
        network,
        tabId,
        uploadToken.id
      );

      if (!encryptResult.success || !encryptResult.encryptedUri) {
        throw new Error(encryptResult.error || t('Encryption failed'));
      }

      // Step 3: Upload encrypted file using the pre-issued token
      const uploadResult = await mediaUploadService.uploadFile(
        encryptResult.encryptedUri,
        uploadToken.id,
        uploadToken.upload_token,
        uploadToken.expires,
        (progress) => {
          setUploadProgress(Math.round(progress.percentage));
        }
      );

      if (uploadResult.status !== 'ready') {
        throw new Error(t('Upload failed'));
      }

      // Step 4: Notify parent with IRC tag
      onSendComplete(`!enc-media [${uploadToken.id}]`, caption || undefined);

      // Close modal
      onClose();
    } catch (err: any) {
      console.error('[MediaPreviewModal] Send error:', err);
      setError(err.message || t('Failed to send media'));
      setUploading(false);
    }
  };

  const renderMediaPreview = () => {
    if (!mediaResult?.uri) return null;

    const { type, uri, mimeType } = mediaResult;
    const previewHeight = Math.min(screenHeight * 0.45, 360);
    
    // Normalize URI for display
    let displayUri = uri;
    if (!uri.startsWith('file://') && !uri.startsWith('content://') && !uri.startsWith('http')) {
      displayUri = Platform.OS === 'android' ? `file://${uri}` : `file://${uri}`;
    } else if (uri.startsWith('file://')) {
      // Remove file:// prefix for RNFS operations, but keep for Image/Video components
      displayUri = uri;
    }

    // Image preview
    if (type === 'image' || type === 'gif' || mimeType?.startsWith('image/')) {
      return (
        <View style={[styles.previewContainer, { height: previewHeight }]}>
          <Image
            source={{ uri: displayUri }}
            style={styles.imagePreview}
            resizeMode="contain"
            onError={(e) => {
              console.error('[MediaPreviewModal] Image load error:', e.nativeEvent.error);
              setError(t('Failed to load image preview'));
            }}
          />
        </View>
      );
    }

    // Video preview
    if (type === 'video' || mimeType?.startsWith('video/')) {
      return (
        <View style={[styles.previewContainer, { height: previewHeight }]}>
          <Video
            source={{ uri: displayUri }}
            style={styles.videoPreview}
            controls
            paused
            resizeMode="contain"
            useTextureView
            onError={(e) => {
              console.error('[MediaPreviewModal] Video load error:', e);
              setError(t('Failed to load video preview'));
            }}
          />
        </View>
      );
    }

    // Audio preview
    if (type === 'voice' || mimeType?.startsWith('audio/')) {
      return (
        <View style={[styles.previewContainer, styles.audioContainer, { height: previewHeight }]}>
          <Text style={[styles.audioIcon, { color: colors.text }]}>🎵</Text>
          <Text style={[styles.audioLabel, { color: colors.text }]}>
            {t('Audio File')}
          </Text>
          <Video
            source={{ uri: displayUri }}
            controls
            paused
            style={styles.audioPlayer}
            onError={(e) => {
              console.error('[MediaPreviewModal] Audio load error:', e);
              setError(t('Failed to load audio preview'));
            }}
          />
        </View>
      );
    }

    // Generic file preview
    return (
      <View style={[styles.previewContainer, styles.fileContainer]}>
        <Text style={[styles.fileIcon, { color: colors.text }]}>📄</Text>
        <Text style={[styles.fileLabel, { color: colors.text }]}>
          {mediaResult.fileName || t('File')}
        </Text>
      </View>
    );
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';

    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    } else {
      return `${bytes} bytes`;
    }
  };

  if (!mediaResult) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={false}
      hardwareAccelerated={true}>
      <View style={styles.overlay}>
        {/* Modal content */}
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.surface },
          ]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerText, { color: colors.text }]}>
              {t('Preview Media')}
            </Text>
            {hasEncryption && showEncryptionIndicator && (
              <View style={styles.encryptionBadge}>
                <Text style={styles.encryptionIcon}>🔒</Text>
                <Text style={[styles.encryptionText, { color: colors.textSecondary }]}>
                  {t('Encrypted')}
                </Text>
              </View>
            )}
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}>
            {/* Media preview */}
            {renderMediaPreview()}

            {/* File info */}
            <View style={[styles.infoContainer, { backgroundColor: colors.messageBackground }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                {t('Type:')} {mediaResult.mimeType || t('Unknown')}
              </Text>
              {mediaResult.size && (
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  {t('Size:')} {formatFileSize(mediaResult.size)}
                </Text>
              )}
              {mediaResult.duration && (
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  {t('Duration:')} {Math.round(mediaResult.duration)}s
                </Text>
              )}
              {mediaResult.width && mediaResult.height && (
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  {t('Dimensions:')} {mediaResult.width} × {mediaResult.height}
                </Text>
              )}
            </View>

            {/* Caption input */}
            <View style={styles.captionContainer}>
              <Text style={[styles.captionLabel, { color: colors.text }]}>
                {t('Caption (optional)')}
              </Text>
              <TextInput
                style={[
                  styles.captionInput,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={t('Add a caption...')}
                placeholderTextColor={colors.textSecondary}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={500}
                editable={!uploading}
              />
              <Text style={[styles.captionCounter, { color: colors.textSecondary }]}>
                {caption.length}/500
              </Text>
            </View>

            {/* Error message */}
            {error && (
              <View style={[styles.errorContainer, { backgroundColor: colors.error + '20' }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {error}
                </Text>
              </View>
            )}

            {/* Upload progress */}
            {uploading && (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[styles.progressText, { color: colors.text }]}>
                    {uploadProgress < 50
                      ? t('Encrypting and uploading...')
                      : t('Uploading...')} {uploadProgress}%
                  </Text>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: colors.accent, width: `${uploadProgress}%` },
                    ]}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { backgroundColor: colors.messageBackground },
              ]}
              onPress={onClose}
              disabled={uploading}>
              <Text style={[styles.buttonText, { color: colors.text }]}>
                {t('Cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.sendButton,
                { backgroundColor: colors.accent },
                uploading && styles.buttonDisabled,
              ]}
              onPress={handleSend}
              disabled={uploading}>
              <Text style={[styles.buttonText, styles.sendButtonText]}>
                {uploading ? t('Sending...') : t('Send')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: screenWidth * 0.95,
    maxHeight: screenHeight * 0.9,
    borderRadius: 12,
    elevation: 24,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
  },
  encryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 12,
  },
  encryptionIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  encryptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  previewContainer: {
    width: '100%',
    minHeight: 200,
    maxHeight: 400,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#000',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  audioContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  audioIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  audioLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  audioPlayer: {
    width: '100%',
    height: 50,
  },
  fileContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  fileIcon: {
    fontSize: 72,
    marginBottom: 12,
  },
  fileLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  infoContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  captionContainer: {
    marginBottom: 16,
  },
  captionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  captionInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  captionCounter: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    marginLeft: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    // backgroundColor set dynamically
  },
  sendButton: {
    // backgroundColor set dynamically
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sendButtonText: {
    color: '#FFFFFF',
  },
});
