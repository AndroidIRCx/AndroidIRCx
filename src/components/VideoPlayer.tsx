import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import { useTheme } from '../hooks/useTheme';

interface VideoPlayerProps {
  url: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ url }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const videoRef = useRef<VideoRef | null>(null);
  const canUsePiP = Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 26);

  return (
    <View style={styles.container}>
      {loading && !error && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {error ? (
        <Text style={styles.error}>Video error: {error}</Text>
      ) : (
        <Video
          ref={videoRef}
          source={{ uri: url }}
          style={styles.video}
          controls
          paused={paused}
          enterPictureInPictureOnLeave={canUsePiP}
          playInBackground={canUsePiP}
          playWhenInactive={canUsePiP}
          onLoad={() => setLoading(false)}
          onError={(e) => {
            setLoading(false);
            setError(e?.error?.errorString || 'Failed to load video');
          }}
          resizeMode="contain"
        />
      )}
      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => setPaused((p) => !p)}>
          <Text style={styles.actionText}>{paused ? 'Play' : 'Pause'}</Text>
        </TouchableOpacity>
        {canUsePiP && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => videoRef.current?.enterPictureInPicture()}>
            <Text style={styles.actionText}>PiP</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    marginVertical: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    overflow: 'hidden',
  },
  video: {
    height: 200,
    width: '100%',
    backgroundColor: '#000',
  },
  loading: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  error: {
    color: colors.error,
    padding: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  actionButton: {
    flex: 1,
    padding: 8,
    alignItems: 'center',
  },
  actionText: {
    color: colors.text,
    fontWeight: '600',
  },
});
