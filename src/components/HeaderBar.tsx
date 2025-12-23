import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface HeaderBarProps {

  networkName: string;

  ping?: number;

  isConnected: boolean;

  onDropdownPress: () => void;

  onMenuPress: () => void;

  onConnectPress?: () => void;

  onToggleNicklist: () => void;

  showNicklistButton: boolean;

  onLockPress?: () => void;

  lockState?: 'locked' | 'unlocked';

  showLockButton?: boolean;

}



export const HeaderBar: React.FC<HeaderBarProps> = ({

  networkName,

  ping,

  isConnected,

  onDropdownPress,

  onMenuPress,

  onConnectPress,

  onToggleNicklist,

  showNicklistButton,

  onLockPress,

  lockState = 'unlocked',

  showLockButton = false,

}) => {

  const { colors } = useTheme();

  const styles = createStyles(colors);

  return (

    <View style={styles.container}>

      <View style={styles.leftSection}>

        <TouchableOpacity

          onPress={!isConnected && onConnectPress ? onConnectPress : undefined}

          disabled={isConnected || !onConnectPress}>

          <Text style={styles.networkName}>{networkName}</Text>

        </TouchableOpacity>

        {ping !== undefined && (

          <Text style={styles.ping}>Ping: {ping.toFixed(1)} ms</Text>

        )}

        {!isConnected && onConnectPress && (

          <Text style={styles.connectHint}>Tap to connect</Text>

        )}

      </View>

      <View style={styles.rightSection}>

        {showLockButton && onLockPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onLockPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.icon}>{lockState === 'locked' ? '🔓' : '🔒'}</Text>
          </TouchableOpacity>
        )}

        {showNicklistButton && (

          <TouchableOpacity

            style={styles.iconButton}

            onPress={onToggleNicklist}

            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>

            <Text style={styles.icon}>👥</Text>

          </TouchableOpacity>

        )}

        <TouchableOpacity

          style={styles.iconButton}

          onPress={onDropdownPress}

          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>

          <Text style={styles.icon}>▼</Text>

        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onMenuPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.icon}>☰</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...Platform.select({
      android: {
        elevation: 4,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
    }),
  },
  leftSection: {
    flex: 1,
  },
  networkName: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  ping: {
    color: colors.onPrimary,
    fontSize: 12,
    opacity: 0.9,
  },
  connectHint: {
    color: colors.onPrimary,
    fontSize: 11,
    opacity: 0.7,
    fontStyle: 'italic',
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    padding: 4,
  },
  icon: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

