import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DccTransfer } from './DccTransfersModal';

interface DccTransfersMinimizedIndicatorProps {
  visible: boolean;
  transfers: DccTransfer[];
  onPress: () => void;
  colors: {
    surface: string;
    text: string;
    primary: string;
    textSecondary: string;
  };
}

export const DccTransfersMinimizedIndicator: React.FC<DccTransfersMinimizedIndicatorProps> = ({
  visible,
  transfers,
  onPress,
  colors,
}) => {
  if (!visible) return null;

  // Get active transfers (downloading or sending)
  const activeTransfers = transfers.filter(t => t.status === 'downloading' || t.status === 'sending');

  if (activeTransfers.length === 0) return null;

  // Calculate overall progress
  const totalSize = activeTransfers.reduce((sum, t) => sum + (t.size || 0), 0);
  const totalReceived = activeTransfers.reduce((sum, t) => sum + t.bytesReceived, 0);
  const overallPercent = totalSize > 0 ? Math.floor((totalReceived / totalSize) * 100) : 0;

  // Get first transfer name for display
  const firstName = activeTransfers[0]?.offer.filename || 'File';
  const displayName = activeTransfers.length > 1
    ? `${firstName} (+${activeTransfers.length - 1} more)`
    : firstName;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.container, { backgroundColor: colors.primary }]}
      activeOpacity={0.8}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📥</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: '#fff' }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }]}>
            {activeTransfers.length} transfer{activeTransfers.length > 1 ? 's' : ''} - {overallPercent}%
          </Text>
        </View>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${overallPercent}%`, backgroundColor: '#fff' }
              ]}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    left: 16,
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  progressContainer: {
    width: 60,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
