import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ImagePreviewProps {
  url: string;
  thumbnail?: boolean;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ url, thumbnail = true }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handlePress = () => {
    setModalVisible(true);
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleImageError = () => {
    setLoading(false);
    setError(true);
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load image</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        activeOpacity={0.8}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
        <Image
          source={{ uri: url }}
          style={thumbnail ? styles.thumbnail : styles.fullImage}
          resizeMode={thumbnail ? 'cover' : 'contain'}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setModalVisible(false)}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            maximumZoomScale={3}
            minimumZoomScale={1}>
            <Image
              source={{ uri: url }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    marginVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceVariant,
  },
  thumbnail: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  fullImage: {
    width: '100%',
    minHeight: 200,
    borderRadius: 8,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  errorContainer: {
    padding: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});

