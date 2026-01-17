/**
 * Network Picker Modal
 *
 * Modal for selecting a network to add a ZNC server to.
 * Shows list of existing networks with option to create new.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { settingsService, NetworkConfig } from '../../services/SettingsService';
import { useTheme } from '../../hooks/useTheme';
import { useT } from '../../i18n/transifex';

interface NetworkPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectNetwork: (network: NetworkConfig) => void;
  onCreateNew: () => void;
  /** Highlight this network as recommended */
  recommendedNetworkId?: string;
  /** Title override */
  title?: string;
}

export const NetworkPickerModal: React.FC<NetworkPickerModalProps> = ({
  visible,
  onClose,
  onSelectNetwork,
  onCreateNew,
  recommendedNetworkId = 'DBase',
  title,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const [networks, setNetworks] = useState<NetworkConfig[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadNetworks();
    }
  }, [visible]);

  const loadNetworks = async () => {
    setLoading(true);
    try {
      const loadedNetworks = await settingsService.loadNetworks();
      // Sort with recommended network first
      const sorted = [...loadedNetworks].sort((a, b) => {
        if (a.name === recommendedNetworkId) return -1;
        if (b.name === recommendedNetworkId) return 1;
        return a.name.localeCompare(b.name);
      });
      setNetworks(sorted);
    } catch (error) {
      console.error('Failed to load networks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNetworkIcon = (network: NetworkConfig) => {
    // Check if network has ZNC server configured
    const hasZnc = network.servers?.some(s => s.connectionType === 'znc');
    if (hasZnc) {
      return { name: 'server', color: '#4CAF50' };
    }
    return { name: 'network-wired', color: colors.textSecondary };
  };

  const renderNetwork = ({ item }: { item: NetworkConfig }) => {
    const isRecommended = item.name === recommendedNetworkId;
    const icon = getNetworkIcon(item);
    const serverCount = item.servers?.length || 0;

    return (
      <TouchableOpacity
        style={[
          styles.networkItem,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isRecommended && styles.recommendedItem,
        ]}
        onPress={() => onSelectNetwork(item)}
        activeOpacity={0.7}
      >
        <View style={styles.networkIcon}>
          <Icon name={icon.name} size={20} color={icon.color} />
        </View>

        <View style={styles.networkContent}>
          <View style={styles.networkHeader}>
            <Text style={[styles.networkName, { color: colors.text }]}>
              {item.name}
            </Text>
            {isRecommended && (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>{t('Recommended')}</Text>
              </View>
            )}
          </View>

          <Text style={[styles.networkMeta, { color: colors.textSecondary }]}>
            {serverCount} {serverCount === 1 ? t('server') : t('servers')}
            {item.nick && ` · ${item.nick}`}
          </Text>
        </View>

        <Icon name="chevron-right" size={14} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="network-wired" size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {t('No Networks')}
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        {t('Create a network first to add ZNC to it.')}
      </Text>
    </View>
  );

  const styles = createStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {title || t('Select Network')}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeButtonText, { color: colors.primary }]}>
              {t('Cancel')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.surface }]}>
          <Icon name="info-circle" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {t('Select a network to add your ZNC server to. The ZNC will be automatically configured.')}
          </Text>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {t('Loading networks...')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={networks}
            renderItem={renderNetwork}
            keyExtractor={item => item.name}
            contentContainerStyle={
              networks.length === 0 ? styles.emptyList : styles.listContent
            }
            ListEmptyComponent={renderEmpty}
          />
        )}

        {/* Create New Network Button */}
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={onCreateNew}
          >
            <Icon name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.createButtonText}>
              {t('Create New Network')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 14,
    },
    listContent: {
      padding: 16,
    },
    emptyList: {
      flex: 1,
    },
    networkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: 1,
    },
    recommendedItem: {
      borderColor: '#4CAF50',
      borderWidth: 2,
    },
    networkIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(128, 128, 128, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    networkContent: {
      flex: 1,
    },
    networkHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    networkName: {
      fontSize: 16,
      fontWeight: '600',
    },
    recommendedBadge: {
      marginLeft: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: '#4CAF5020',
      borderRadius: 4,
    },
    recommendedText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#4CAF50',
    },
    networkMeta: {
      fontSize: 13,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 8,
      gap: 8,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
