/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * VideoRecorderScreen - Full-screen camera for recording videos
 *
 * Uses react-native-vision-camera to record videos with audio
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  useVideoOutput,
} from 'react-native-vision-camera';
import type { Recorder } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';

interface VideoRecorderScreenProps {
  visible: boolean;
  onClose: () => void;
  onVideoRecorded: (fileUri: string, duration: number) => void;
}

export const VideoRecorderScreen: React.FC<VideoRecorderScreenProps> = ({
  visible,
  onClose,
  onVideoRecorded,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingDurationRef = useRef(0);
  const recorderRef = useRef<Recorder | null>(null);

  const device = useCameraDevice('back');
  const videoOutput = useVideoOutput({ enableAudio: true, fileType: 'mp4' });
  const {
    hasPermission: hasCameraPermission,
    requestPermission: requestCameraPermission,
  } = useCameraPermission();
  const {
    hasPermission: hasMicPermission,
    requestPermission: requestMicPermission,
  } = useMicrophonePermission();

  const startRecording = async () => {
    if (!device || isRecording) {
      return;
    }

    try {
      setIsRecording(true);
      setError(null);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;

      // Generate file path
      const timestamp = Date.now();
      const fileName = `video_${timestamp}.mp4`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      // Start duration timer before recording begins so cleanup paths can always clear it.
      durationIntervalRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration(recordingDurationRef.current);
      }, 1000);

      const recorder = await videoOutput.createRecorder({ filePath });
      recorderRef.current = recorder;

      await recorder.startRecording(
        async recordedFilePath => {
          try {
            setIsRecording(false);
            recorderRef.current = null;

            // Stop duration timer if still running
            if (durationIntervalRef.current) {
              clearInterval(durationIntervalRef.current);
              durationIntervalRef.current = null;
            }

            let videoPath = recordedFilePath;
            if (!videoPath.startsWith('file://')) {
              videoPath = `file://${videoPath}`;
            }

            // Calculate duration (use recorded duration)
            const duration = recordingDurationRef.current;

            // Return file URI with file:// prefix
            const fileUri =
              Platform.OS === 'android' ? videoPath : recordedFilePath;

            console.log(
              '[VideoRecorderScreen] Video saved:',
              fileUri,
              'Duration:',
              duration,
            );

            // Notify parent
            onVideoRecorded(fileUri, duration);
            onClose();
          } catch (err: any) {
            console.error('[VideoRecorderScreen] Error saving video:', err);
            setError(err.message || t('Failed to save video'));
            setIsRecording(false);
            recorderRef.current = null;
          }
        },
        recordingError => {
          console.error(
            '[VideoRecorderScreen] Recording error:',
            recordingError,
          );
          setError(recordingError.message || t('Recording failed'));
          setIsRecording(false);
          recorderRef.current = null;
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
          }
        },
      );
    } catch (err: any) {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      recorderRef.current = null;
      console.error('[VideoRecorderScreen] Start recording error:', err);
      setError(err.message || t('Failed to start recording'));
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current || !isRecording) {
      return;
    }

    try {
      // Stop duration timer first
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Stop recording (onRecordingFinished callback will handle file saving)
      await recorderRef.current.stopRecording();

      // Note: setIsRecording(false) will be called in onRecordingFinished callback
    } catch (err: any) {
      console.error('[VideoRecorderScreen] Stop recording error:', err);
      setError(err.message || t('Failed to stop recording'));
      setIsRecording(false);
      recorderRef.current = null;
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRequestPermissions = async () => {
    const cameraGranted = await requestCameraPermission();
    const micGranted = await requestMicPermission();

    if (!cameraGranted || !micGranted) {
      setError(
        t('Camera and microphone permissions are required to record videos'),
      );
    }
  };

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      recorderRef.current = null;
    };
  }, []);

  if (!visible) {
    return null;
  }

  if (!hasCameraPermission || !hasMicPermission) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent={false}
      >
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionContainer}>
            <Text style={[styles.permissionTitle, { color: colors.text }]}>
              {t('Permissions Required')}
            </Text>
            <Text
              style={[
                styles.permissionMessage,
                { color: colors.textSecondary },
              ]}
            >
              {t(
                'This app needs access to your camera and microphone to record videos.',
              )}
            </Text>
            <TouchableOpacity
              style={[
                styles.permissionButton,
                { backgroundColor: colors.accent },
              ]}
              onPress={handleRequestPermissions}
            >
              <Text style={styles.permissionButtonText}>
                {t('Grant Permissions')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                {t('Cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  if (!device) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent={false}
      >
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.error }]}>
              {t('Camera not available')}
            </Text>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                {t('Close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <View style={styles.container}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible}
          outputs={[videoOutput]}
        />

        {/* Overlay controls */}
        <View style={styles.overlay}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isRecording}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>
                  {formatDuration(recordingDuration)}
                </Text>
              </View>
            )}
          </View>

          {/* Error message */}
          {error && (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: colors.error + '20' },
              ]}
            >
              <Text style={[styles.errorBannerText, { color: colors.error }]}>
                {error}
              </Text>
            </View>
          )}

          {/* Bottom controls */}
          <View style={styles.bottomBar}>
            <View style={styles.controlsContainer}>
              {/* Record button */}
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  {
                    backgroundColor: isRecording ? colors.error : colors.accent,
                  },
                ]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={false}
              >
                {isRecording ? (
                  <View style={styles.stopIcon} />
                ) : (
                  <View style={styles.recordIcon} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  recordingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  errorBannerText: {
    fontSize: 14,
    textAlign: 'center',
  },
  bottomBar: {
    paddingBottom: Platform.OS === 'android' ? 30 : 40,
    paddingHorizontal: 20,
  },
  controlsContainer: {
    alignItems: 'center',
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  recordIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  stopIcon: {
    width: 30,
    height: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  permissionButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
});
