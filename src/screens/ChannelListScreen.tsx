import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { channelListService as singletonChannelListService, ChannelListItem, ChannelListFilter } from '../services/ChannelListService';
import { channelFavoritesService } from '../services/ChannelFavoritesService';
import { ircService } from '../services/IRCService';
import { connectionManager } from '../services/ConnectionManager';
import { formatIRCTextAsComponent } from '../utils/IRCFormatter';

interface ChannelListScreenProps {
  visible: boolean;
  network?: string;
  onClose: () => void;
  onJoinChannel: (channel: string, key?: string) => void;
}

export const ChannelListScreen: React.FC<ChannelListScreenProps> = ({
  visible,
  network,
  onClose,
  onJoinChannel,
}) => {
  const { colors } = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'users'>('users');
  const [ascending, setAscending] = useState(false);
  const [filter, setFilter] = useState<ChannelListFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [listService, setListService] = useState(singletonChannelListService);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search query to avoid excessive filtering
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    const connection = network
      ? connectionManager.getConnection(network)
      : connectionManager.getActiveConnection();
    const service = connection?.channelListService || singletonChannelListService;
    setListService(service);
  }, [network, visible]);

  useEffect(() => {
    const unsubscribe = listService.onChannelListUpdate((updatedChannels) => {
      setChannels(updatedChannels);
    });

    const unsubscribeEnd = listService.onListEnd(() => {
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeEnd();
    };
  }, [listService]);

  const loadChannelList = useCallback(() => {
    const connection = network
      ? connectionManager.getConnection(network)
      : connectionManager.getActiveConnection();
    const activeIRC = connection?.ircService || ircService;
    const run = async () => {
      if (!activeIRC.getConnectionStatus() || !activeIRC.isRegistered()) {
        setLoading(true);
        const cached = await listService.getCachedList(network);
        setChannels(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      setChannels([]);
      listService.requestChannelList();
    };
    run();
  }, [network, listService]);

  useEffect(() => {
    if (!visible) return;
    loadChannelList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, listService, network]);

  // Memoize filtered and sorted channels to avoid recalculating on every render
  const filteredChannels = useMemo(() => {
    let filtered = channels;

    // Apply search query
    if (debouncedSearchQuery.trim()) {
      filtered = listService.searchChannels(debouncedSearchQuery);
    }

    // Apply filters
    if (filter.minUsers !== undefined || filter.maxUsers !== undefined || filter.namePattern || filter.topicPattern) {
      filtered = listService.filterChannelList(filter);
    }

    // Sort
    filtered = listService.sortChannels(filtered, sortBy, ascending);

    return filtered;
  }, [channels, debouncedSearchQuery, filter, sortBy, ascending, listService]);

  const handleJoin = (channel: ChannelListItem) => {
    const favorite = channelFavoritesService.isFavorite(network || '', channel.name);
    const favoriteData = network
      ? channelFavoritesService.getFavorites(network).find(f => f.name === channel.name)
      : undefined;
    
    onJoinChannel(channel.name, favoriteData?.key);
    onClose();
  };

  const handleToggleFavorite = async (channel: ChannelListItem) => {
    if (!network) return;
    
    // Normalize network ID to base network name to ensure favorites are stored per base network
    // "DBase (1)" -> "DBase", "DBase (2)" -> "DBase", "DBase" -> "DBase"
    const baseNetworkId = network.replace(/\s+\(\d+\)$/, '');
    
    const isFavorite = channelFavoritesService.isFavorite(baseNetworkId, channel.name);
    if (isFavorite) {
      await channelFavoritesService.removeFavorite(baseNetworkId, channel.name);
    } else {
      await channelFavoritesService.addFavorite(baseNetworkId, channel.name);
    }
  };

  const renderChannelItem = useCallback(({ item }: { item: ChannelListItem }) => {
    const isFavorite = network ? channelFavoritesService.isFavorite(network, item.name) : false;

    return (
      <TouchableOpacity
        style={styles.channelItem}
        onPress={() => handleJoin(item)}
        onLongPress={() => handleToggleFavorite(item)}>
        <View style={styles.channelInfo}>
          <View style={styles.channelHeader}>
            <Text style={styles.channelName}>{item.name}</Text>
            {isFavorite && <Text style={styles.favoriteIcon}>★</Text>}
            {item.userCount !== undefined && (
              <Text style={styles.userCount}>{t('{count} users').replace('{count}', item.userCount.toString())}</Text>
            )}
          </View>
          {item.topic && (
            <Text style={styles.channelTopic}>
              {formatIRCTextAsComponent(item.topic, styles.channelTopic)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [network, styles, t]);

  // Optimize FlatList rendering with getItemLayout for fixed-height items
  const getItemLayout = useCallback((data: ChannelListItem[] | null | undefined, index: number) => ({
    length: 76, // Approximate item height (padding + content)
    offset: 76 * index,
    index,
  }), []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={[styles.cancelText, { color: colors.onPrimary }]}>{t('Close')}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.onPrimary }]}>{t('Channel List')}</Text>
          <TouchableOpacity onPress={loadChannelList} style={styles.refreshButton}>
            <Text style={[styles.refreshText, { color: colors.onPrimary }]}>{t('Refresh')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
            placeholder={t('Search channels...')}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: colors.surfaceVariant }]}
            onPress={() => setShowFilters(!showFilters)}>
            <Text style={[styles.filterButtonText, { color: colors.text }]}>{t('Filters')}</Text>
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={[styles.filtersContainer, { backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.filterInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
              placeholder={t('Min users')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={filter.minUsers?.toString() || ''}
              onChangeText={(text) => setFilter({ ...filter, minUsers: text ? parseInt(text, 10) : undefined })}
            />
            <TextInput
              style={[styles.filterInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
              placeholder={t('Max users')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={filter.maxUsers?.toString() || ''}
              onChangeText={(text) => setFilter({ ...filter, maxUsers: text ? parseInt(text, 10) : undefined })}
            />
            <TextInput
              style={[styles.filterInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
              placeholder={t('Name pattern')}
              placeholderTextColor={colors.textSecondary}
              value={filter.namePattern || ''}
              onChangeText={(text) => setFilter({ ...filter, namePattern: text || undefined })}
            />
          </View>
        )}

        <View style={[styles.sortContainer, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'users' && styles.sortButtonActive]}
            onPress={() => {
              if (sortBy === 'users') {
                setAscending(!ascending);
              } else {
                setSortBy('users');
                setAscending(false);
              }
            }}>
            <Text style={[styles.sortButtonText, { color: sortBy === 'users' ? colors.primary : colors.text }]}>
              {t('Users')} {sortBy === 'users' && (ascending ? '↑' : '↓')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
            onPress={() => {
              if (sortBy === 'name') {
                setAscending(!ascending);
              } else {
                setSortBy('name');
                setAscending(false);
              }
            }}>
            <Text style={[styles.sortButtonText, { color: sortBy === 'name' ? colors.primary : colors.text }]}>
              {t('Name')} {sortBy === 'name' && (ascending ? '↑' : '↓')}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {t('Loading channel list...')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredChannels}
            renderItem={renderChannelItem}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            getItemLayout={getItemLayout}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            windowSize={10}
            removeClippedSubviews={true}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('No channels found')}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
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
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 8,
  },
  refreshText: {
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filtersContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterInput: {
    flex: 1,
    padding: 8,
    borderRadius: 4,
    fontSize: 12,
  },
  sortContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortButton: {
    flex: 1,
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  sortButtonActive: {
    backgroundColor: colors.primary + '20',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
  },
  channelItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  channelInfo: {
    flex: 1,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  favoriteIcon: {
    fontSize: 16,
    color: colors.warning,
    marginRight: 8,
  },
  userCount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 'auto',
  },
  channelTopic: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
  },
});

