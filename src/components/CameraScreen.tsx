/**
 * CameraScreen - Full-screen camera for taking photos
 * 
 * Uses react-native-vision-camera to capture photos
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';

interface CameraScreenProps {
  visible: boolean;
  onClose: () => void;
  onPhotoTaken: (fileUri: string) => void;
}

export const CameraScreen: React.FC<CameraScreenProps> = ({
  visible,
  onClose,
  onPhotoTaken,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const cameraRef = useRef<Camera>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  const handleTakePhoto = async () => {
    if (!cameraRef.current || !device || isCapturing) {
      return;
    }

    try {
      setIsCapturing(true);
      setError(null);

      // Take photo
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
      });

      // Save photo to cache directory
      const timestamp = Date.now();
      const fileName = `photo_${timestamp}.jpg`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      // Copy photo file to cache directory
      // The photo path from camera is usually in a temp location
      let photoPath = photo.path;
      if (!photoPath.startsWith('file://')) {
        photoPath = `file://${photoPath}`;
      }
      
      // Read the photo file and write to cache
      // Remove file:// prefix for RNFS operations
      const normalizedPhotoPath = photoPath.replace('file://', '');
      const photoData = await RNFS.readFile(normalizedPhotoPath, 'base64');
      await RNFS.writeFile(filePath, photoData, 'base64');

      // Return file URI with file:// prefix
      const fileUri = Platform.OS === 'android' ? `file://${filePath}` : filePath;

      console.log('[CameraScreen] Photo saved:', fileUri);

      // Notify parent
      onPhotoTaken(fileUri);
      onClose();
    } catch (err: any) {
      console.error('[CameraScreen] Take photo error:', err);
      setError(err.message || t('Failed to take photo'));
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (!granted) {
      setError(t('Camera permission is required to take photos'));
    }
  };

  if (!visible) {
    return null;
  }

  if (!hasPermission) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent={false}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionContainer}>
            <Text style={[styles.permissionTitle, { color: colors.text }]}>
              {t('Camera Permission Required')}
            </Text>
            <Text style={[styles.permissionMessage, { color: colors.textSecondary }]}>
              {t('This app needs access to your camera to take photos.')}
            </Text>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: colors.accent }]}
              onPress={handleRequestPermission}>
              <Text style={styles.permissionButtonText}>{t('Grant Permission')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}>
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
        statusBarTranslucent={false}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.error }]}>
              {t('Camera not available')}
            </Text>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}>
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
      statusBarTranslucent={false}>
      <View style={styles.container}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible}
          photo={true}
        />

        {/* Overlay controls */}
        <View style={styles.overlay}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isCapturing}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Error message */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: colors.error + '20' }]}>
              <Text style={[styles.errorBannerText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {/* Bottom controls */}
          <View style={styles.bottomBar}>
            <View style={styles.controlsContainer}>
              {/* Capture button */}
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  { backgroundColor: colors.accent },
                  isCapturing && styles.captureButtonDisabled,
                ]}
                onPress={handleTakePhoto}
                disabled={isCapturing}>
                {isCapturing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.captureButtonInner} />
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
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
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
