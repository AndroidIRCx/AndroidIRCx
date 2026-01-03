import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { inAppPurchaseService } from '../services/InAppPurchaseService';

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

  showEncryptionButton?: boolean;

  onEncryptionPress?: () => void;

  showKillSwitchButton?: boolean;

  onKillSwitchPress?: () => void;

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

  showEncryptionButton = false,

  onEncryptionPress,

  showKillSwitchButton = false,

  onKillSwitchPress,

}) => {
  const t = useT();
  const { colors } = useTheme();
  const [isSupporter, setIsSupporter] = useState(false);

  const styles = createStyles(colors);

  useEffect(() => {
    const updateSupporterStatus = () => {
      setIsSupporter(inAppPurchaseService.isSupporter());
    };

    updateSupporterStatus();
    const unsubscribe = inAppPurchaseService.addListener(updateSupporterStatus);
    return unsubscribe;
  }, []);

  return (

    <View style={styles.container}>

      <View style={styles.leftSection}>

        <TouchableOpacity

          onPress={!isConnected && onConnectPress ? onConnectPress : undefined}

          disabled={isConnected || !onConnectPress}>

          <View style={styles.networkNameContainer}>
            <Text style={styles.networkName}>{networkName}</Text>
            {isSupporter && (
              <Text style={styles.supporterBadge}>❤️</Text>
            )}
          </View>

        </TouchableOpacity>

        {ping !== undefined && (

          <Text style={styles.ping}>{t('Ping: {ping} ms').replace('{ping}', ping.toFixed(1))}</Text>

        )}

        {!isConnected && onConnectPress && (

          <Text style={styles.connectHint}>{t('Tap to connect')}</Text>

        )}

      </View>

      <View style={styles.rightSection}>

        {showKillSwitchButton && onKillSwitchPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onKillSwitchPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.icon}>💀</Text>
          </TouchableOpacity>
        )}

        {showEncryptionButton && onEncryptionPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onEncryptionPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.icon}>🔐</Text>
          </TouchableOpacity>
        )}

        {showLockButton && onLockPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onLockPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.icon}>{lockState === 'locked' ? '\u{1F512}' : '\u{1F513}'}</Text>
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
  networkNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  networkName: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  supporterBadge: {
    fontSize: 14,
    lineHeight: 16,
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



