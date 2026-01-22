/**
 * MediaUploadModal - Select media source (camera, gallery, file, voice)
 *
 * Grid layout with action buttons:
 * - 📷 Take Photo (camera)
 * - 🎥 Record Video (camera)
 * - 🖼️ Photo Library (gallery)
 * - 🎬 Video Library (gallery)
 * - 🎙️ Voice Message (recorder)
 * - 📁 File Picker (documents)
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { mediaPickerService, MediaPickResult } from '../services/MediaPickerService';
import { VoiceRecorder } from './VoiceRecorder';
import { CameraScreen } from './CameraScreen';
import { VideoRecorderScreen } from './VideoRecorderScreen';

interface MediaUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onMediaSelected: (result: MediaPickResult) => void;
}

export const MediaUploadModal: React.FC<MediaUploadModalProps> = ({
  visible,
  onClose,
  onMediaSelected,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showCameraScreen, setShowCameraScreen] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);

  const handleAction = async (
    action: string,
    handler: () => Promise<MediaPickResult> | void
  ) => {
    try {
      setLoading(true);
      setLoadingAction(action);

      const result = await handler();

      // Handle void return (e.g., voice recorder opens modal)
      if (result === undefined) {
        // Action handled elsewhere (e.g., voice recorder modal)
        return;
      }

      // Handle MediaPickResult
      if (result.success && result.uri) {
        onMediaSelected(result);
        onClose();
      } else if (result.error && result.error !== 'User cancelled') {
        // Show error (could use a toast/alert here)
        console.error(`[MediaUploadModal] ${action} error:`, result.error);
        Alert.alert(t('Error'),result.error); // TODO: Replace with proper error modal
      }
    } catch (error: any) {
      console.error(`[MediaUploadModal] ${action} error:`, error);
      const errorMessage = error?.message || error?.toString() || `Failed to ${action.toLowerCase()}`;
      Alert.alert(t('Error'),errorMessage);
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  const actions = [
    {
      id: 'take-photo',
      label: t('Take Photo'),
      icon: '📷',
      handler: async () => {
        // Request camera permission before attempting to capture
        if (Platform.OS === 'android') {
          try {
            const hasPermission = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.CAMERA
            );
            
            if (!hasPermission) {
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
                {
                  title: t('Camera Permission'),
                  message: t('This app needs access to your camera to take photos.'),
                  buttonNeutral: t('Ask Me Later'),
                  buttonNegative: t('Cancel'),
                  buttonPositive: t('OK'),
                }
              );
              if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                return; // Permission denied, don't proceed
              }
            }
          } catch (err) {
            console.error('[MediaUploadModal] Camera permission error:', err);
            return;
          }
        }
        // Open camera screen - photo will be handled by CameraScreen component
        setShowCameraScreen(true);
        return; // Return undefined to indicate modal will handle it
      },
      disabled: false,
    },
    {
      id: 'record-video',
      label: t('Record Video'),
      icon: '🎥',
      handler: async () => {
        // Request camera and microphone permissions before attempting to record
        if (Platform.OS === 'android') {
          try {
            // Check camera permission
            let hasCameraPermission = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.CAMERA
            );
            
            if (!hasCameraPermission) {
              const cameraGranted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
                {
                  title: t('Camera Permission'),
                  message: t('This app needs access to your camera to record videos.'),
                  buttonNeutral: t('Ask Me Later'),
                  buttonNegative: t('Cancel'),
                  buttonPositive: t('OK'),
                }
              );
              if (cameraGranted !== PermissionsAndroid.RESULTS.GRANTED) {
                return; // Camera permission denied
              }
            }
            
            // Check microphone permission
            let hasMicPermission = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
            );
            
            if (!hasMicPermission) {
              const micGranted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                {
                  title: t('Microphone Permission'),
                  message: t('This app needs access to your microphone to record videos with audio.'),
                  buttonNeutral: t('Ask Me Later'),
                  buttonNegative: t('Cancel'),
                  buttonPositive: t('OK'),
                }
              );
              if (micGranted !== PermissionsAndroid.RESULTS.GRANTED) {
                return; // Microphone permission denied
              }
            }
          } catch (err) {
            console.error('[MediaUploadModal] Video recording permission error:', err);
            return;
          }
        }
        // Open video recorder screen
        setShowVideoRecorder(true);
        return; // Return undefined to indicate modal will handle it
      },
      disabled: false,
    },
    {
      id: 'photo-library',
      label: t('Photo Library'),
      icon: '🖼️',
      handler: () => mediaPickerService.pickImage(),
      disabled: false,
    },
    {
      id: 'video-library',
      label: t('Video Library'),
      icon: '🎬',
      handler: () => mediaPickerService.pickVideo(),
      disabled: false,
    },
    {
      id: 'voice-message',
      label: t('Voice Message'),
      icon: '🎙️',
      handler: async () => {
        // Request microphone permission before opening recorder
        if (Platform.OS === 'android') {
          try {
            // Check current permission status first
            const checkResult = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
            );
            
            if (!checkResult) {
              // Request permission if not granted
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                {
                  title: t('Microphone Permission'),
                  message: t('This app needs access to your microphone to record voice messages.'),
                  buttonNeutral: t('Ask Me Later'),
                  buttonNegative: t('Cancel'),
                  buttonPositive: t('OK'),
                }
              );
              if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert(t('Error'),t('Microphone permission is required to record voice messages. Please allow microphone access in app settings.'));
                return;
              }
            }
          } catch (err) {
            console.error('[MediaUploadModal] Microphone permission error:', err);
            Alert.alert(t('Error'),t('Failed to request microphone permission. Please check app settings.'));
            return;
          }
        }
        setShowVoiceRecorder(true);
      },
      disabled: false,
    },
    {
      id: 'file-picker',
      label: t('File Picker'),
      icon: '📁',
      handler: () => mediaPickerService.pickFile(),
      disabled: false,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={false}
      hardwareAccelerated={true}>
      {/* Background overlay */}
      <View style={styles.overlay}>
        {/* Dismiss touch area */}
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
          disabled={loading}
        />

        {/* Modal content */}
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.surface },
          ]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerText, { color: colors.text }]}>
              {t('Select Media Source')}
            </Text>
          </View>

          {/* Grid of action buttons (2x3) */}
          <View style={styles.grid}>
            {actions.map((action) => {
              const isLoading = loading && loadingAction === action.id;
              const isDisabled = loading || action.disabled;

              return (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.gridItem,
                    {
                      backgroundColor: colors.messageBackground,
                      borderColor: colors.border,
                    },
                    isDisabled && styles.gridItemDisabled,
                  ]}
                  onPress={() => handleAction(action.id, action.handler)}
                  disabled={isDisabled}
                  activeOpacity={0.7}>
                  <View style={styles.gridItemContent}>
                    {isLoading ? (
                      <ActivityIndicator size="large" color={colors.accent} />
                    ) : (
                      <>
                        <Text style={styles.gridIcon}>{action.icon}</Text>
                        <Text
                          style={[
                            styles.gridLabel,
                            { color: colors.text },
                            isDisabled && styles.gridLabelDisabled,
                          ]}>
                          {action.label}
                        </Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Cancel button */}
          <TouchableOpacity
            style={[
              styles.cancelButton,
              { backgroundColor: colors.messageBackground },
            ]}
            onPress={onClose}
            disabled={loading}>
            <Text style={[styles.cancelText, { color: colors.text }]}>
              {t('Cancel')}
            </Text>
          </TouchableOpacity>

          {/* Loading indicator overlay */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.text }]}>
                  {t('Loading...')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Voice Recorder Modal - Always render but control visibility */}
      <Modal
        visible={showVoiceRecorder}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowVoiceRecorder(false)}
        statusBarTranslucent={false}>
        <View style={styles.voiceRecorderOverlay}>
          <View style={[styles.voiceRecorderContainer, { backgroundColor: colors.surface }]}>
            <VoiceRecorder
              onRecordingComplete={async (fileUri, duration) => {
                setShowVoiceRecorder(false);
                
                // Normalize URI - ensure it's in correct format
                let normalizedUri = fileUri;
                if (!fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
                  normalizedUri = Platform.OS === 'android' ? `file://${fileUri}` : `file://${fileUri}`;
                }
                
                onMediaSelected({
                  success: true,
                  uri: normalizedUri,
                  type: 'voice',
                  duration,
                  mimeType: 'audio/m4a',
                });
                onClose();
              }}
              onCancel={() => setShowVoiceRecorder(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Camera Screen Modal - Always render but control visibility */}
      <CameraScreen
        visible={showCameraScreen}
        onClose={() => setShowCameraScreen(false)}
        onPhotoTaken={(fileUri) => {
          setShowCameraScreen(false);
          // Get file info
          mediaPickerService.getFileInfo(fileUri).then((fileInfo) => {
            onMediaSelected({
              success: true,
              uri: fileUri,
              type: 'image',
              mimeType: 'image/jpeg',
              size: fileInfo.size,
            });
            onClose();
          }).catch((err) => {
            console.error('[MediaUploadModal] Get file info error:', err);
            // Still proceed with the file URI even if we can't get info
            onMediaSelected({
              success: true,
              uri: fileUri,
              type: 'image',
              mimeType: 'image/jpeg',
            });
            onClose();
          });
        }}
      />

      {/* Video Recorder Screen Modal - Always render but control visibility */}
      <VideoRecorderScreen
        visible={showVideoRecorder}
        onClose={() => setShowVideoRecorder(false)}
        onVideoRecorded={(fileUri, duration) => {
          setShowVideoRecorder(false);
          // Get file info
          mediaPickerService.getFileInfo(fileUri).then((fileInfo) => {
            onMediaSelected({
              success: true,
              uri: fileUri,
              type: 'video',
              mimeType: 'video/mp4',
              size: fileInfo.size,
              duration,
            });
            onClose();
          }).catch((err) => {
            console.error('[MediaUploadModal] Get file info error:', err);
            // Still proceed with the file URI even if we can't get info
            onMediaSelected({
              success: true,
              uri: fileUri,
              type: 'video',
              mimeType: 'video/mp4',
              duration,
            });
            onClose();
          });
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    borderRadius: 12,
    elevation: 24,
    width: 340,
    maxWidth: '90%',
    padding: 16,
    zIndex: 1000,
  },
  header: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridItemDisabled: {
    opacity: 0.5,
  },
  gridItemContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  gridIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  gridLabelDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  loadingContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  voiceRecorderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceRecorderContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 0,
  },
});
