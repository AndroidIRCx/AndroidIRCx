/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
  Dimensions,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';

interface ImagePreviewProps {
  url: string;
  thumbnail?: boolean;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ url, thumbnail = true }) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalImageLoading, setModalImageLoading] = useState(true);

  const handlePress = () => {
    setModalVisible(true);
    setModalImageLoading(true);
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleImageError = () => {
    setLoading(false);
    setError(true);
  };

  const handleModalImageLoad = () => {
    setModalImageLoading(false);
  };

  const handleModalImageError = () => {
    setModalImageLoading(false);
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('Failed to load image')}</Text>
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
            <Text style={styles.modalCloseText}>{t('Close')}</Text>
          </TouchableOpacity>
          {modalImageLoading && (
            <View style={styles.modalLoadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalLoadingText}>{t('Loading image...')}</Text>
            </View>
          )}
          <ScrollView
            contentContainerStyle={styles.modalContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            centerContent>
            <Image
              source={{ uri: url }}
              style={styles.modalImage}
              resizeMode="contain"
              onLoad={handleModalImageLoad}
              onError={handleModalImageError}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (colors: any) => {
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  return StyleSheet.create({
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
      backgroundColor: colors.modalOverlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalClose: {
      position: 'absolute',
      top: 40,
      right: 20,
      zIndex: 10,
      padding: 10,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 20,
    },
    modalCloseText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: 'bold',
    },
    modalLoadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 5,
    },
    modalLoadingText: {
      color: colors.text,
      fontSize: 14,
      marginTop: 12,
    },
    modalContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: screenWidth,
      minHeight: screenHeight,
    },
    modalImage: {
      width: screenWidth,
      height: screenHeight,
    },
  });
};

