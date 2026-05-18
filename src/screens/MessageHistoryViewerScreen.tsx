/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { IRCMessage } from '../services/IRCService';
import { messageHistoryService } from '../services/MessageHistoryService';
import { formatIRCTextAsComponent } from '../utils/IRCFormatter';
import {
  compareStringsCaseInsensitive,
  formatLocalDateTime,
} from '../utils/localeSafe';

interface MessageHistoryViewerScreenProps {
  visible: boolean;
  onClose: () => void;
}

type HistoryEntry = {
  network: string;
  channel: string;
  count: number;
  newest?: number;
  oldest?: number;
};

const MIGRATION_SUMMARY_DISPLAY_DURATION_MS = 3693;

export const MessageHistoryViewerScreen: React.FC<
  MessageHistoryViewerScreenProps
> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [messages, setMessages] = useState<IRCMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{
    processed: number;
    total: number;
  }>({ processed: 0, total: 0 });
  const [migrationSummary, setMigrationSummary] = useState('');
  const [messageSortOrder, setMessageSortOrder] = useState<'desc' | 'asc'>(
    'desc',
  );
  const [historySearchVisible, setHistorySearchVisible] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const migrationSummaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (migrationSummaryTimerRef.current) {
        clearTimeout(migrationSummaryTimerRef.current);
        migrationSummaryTimerRef.current = null;
      }
    };
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      setMigrating(true);
      setMigrationProgress({ processed: 0, total: 0 });
      const migrationResult = await messageHistoryService.ensureHistoryMigrated(
        (processed, total) => {
          setMigrationProgress({ processed, total });
        },
      );
      if (migrationResult.migrated) {
        setMigrationSummary(
          t('Migrated {count} channels.', {
            count: migrationResult.migratedCount,
          }),
        );
        if (migrationSummaryTimerRef.current) {
          clearTimeout(migrationSummaryTimerRef.current);
        }
        migrationSummaryTimerRef.current = setTimeout(() => {
          setMigrationSummary('');
          migrationSummaryTimerRef.current = null;
        }, MIGRATION_SUMMARY_DISPLAY_DURATION_MS);
      } else {
        setMigrationSummary('');
      }
      setMigrating(false);
      const list = await messageHistoryService.listStoredChannels();
      const sorted = [...list].sort((a, b) => {
        if (a.network !== b.network) {
          return compareStringsCaseInsensitive(a.network, b.network);
        }
        return compareStringsCaseInsensitive(a.channel, b.channel);
      });
      setEntries(sorted);
    } finally {
      setMigrating(false);
      setLoading(false);
    }
  }, [t]);

  const loadMessages = useCallback(
    async (
      entry: HistoryEntry,
      sortOrder: 'desc' | 'asc' = messageSortOrder,
    ) => {
      setLoading(true);
      try {
        const data = await messageHistoryService.loadMessages(
          entry.network,
          entry.channel,
        );
        const sorted = [...data].sort((a, b) =>
          sortOrder === 'desc'
            ? b.timestamp - a.timestamp
            : a.timestamp - b.timestamp,
        );
        setMessages(sorted);
      } finally {
        setLoading(false);
      }
    },
    [messageSortOrder],
  );

  useEffect(() => {
    if (!visible) return;
    setSelectedEntry(null);
    setSelectedNetwork('all');
    setMessages([]);
    setHistorySearchVisible(false);
    setHistorySearchTerm('');
    loadEntries();
  }, [visible, loadEntries]);

  const networks = useMemo(() => {
    const unique = Array.from(new Set(entries.map(e => e.network)));
    return ['all', ...unique];
  }, [entries]);

  const normalizedHistorySearchTerm = historySearchTerm.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    const networkFiltered =
      selectedNetwork === 'all'
        ? entries
        : entries.filter(e => e.network === selectedNetwork);

    if (!normalizedHistorySearchTerm) return networkFiltered;

    return networkFiltered.filter(entry => {
      const channel = entry.channel.toLowerCase();
      const entryNetwork = entry.network.toLowerCase();
      return (
        channel.includes(normalizedHistorySearchTerm) ||
        entryNetwork.includes(normalizedHistorySearchTerm)
      );
    });
  }, [entries, normalizedHistorySearchTerm, selectedNetwork]);

  const filteredMessages = useMemo(() => {
    if (!normalizedHistorySearchTerm) return messages;

    return messages.filter(message => {
      const text = message.text?.toLowerCase() || '';
      const from = message.from?.toLowerCase() || '';
      const channel =
        message.channel?.toLowerCase() ||
        selectedEntry?.channel.toLowerCase() ||
        '';
      return (
        text.includes(normalizedHistorySearchTerm) ||
        from.includes(normalizedHistorySearchTerm) ||
        channel.includes(normalizedHistorySearchTerm)
      );
    });
  }, [messages, normalizedHistorySearchTerm, selectedEntry?.channel]);

  const historySearchResultCount = selectedEntry
    ? filteredMessages.length
    : filteredEntries.length;

  const handleOpenEntry = async (entry: HistoryEntry) => {
    setSelectedEntry(entry);
    await loadMessages(entry);
  };

  const closeHistorySearch = () => {
    setHistorySearchVisible(false);
    setHistorySearchTerm('');
  };

  const handleDeleteEntry = async (entry: HistoryEntry) => {
    Alert.alert(
      t('Delete Channel History?', {
        _tags:
          'screen:settings,file:MessageHistoryViewerScreen.tsx,feature:history',
      }),
      t('This will remove all saved messages for {channel}.', {
        channel: entry.channel,
        _tags:
          'screen:settings,file:MessageHistoryViewerScreen.tsx,feature:history',
      }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await messageHistoryService.deleteMessages(
                entry.network,
                entry.channel,
              );
              setEntries(prev =>
                prev.filter(
                  e =>
                    !(
                      e.network === entry.network && e.channel === entry.channel
                    ),
                ),
              );
              if (
                selectedEntry &&
                selectedEntry.network === entry.network &&
                selectedEntry.channel === entry.channel
              ) {
                setSelectedEntry(null);
                setMessages([]);
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleDeleteMessage = async (
    entry: HistoryEntry,
    message: IRCMessage,
  ) => {
    Alert.alert(
      t('Delete message', {
        _tags:
          'screen:settings,file:MessageHistoryViewerScreen.tsx,feature:history',
      }),
      t('This will remove the selected message from history.', {
        _tags:
          'screen:settings,file:MessageHistoryViewerScreen.tsx,feature:history',
      }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            await messageHistoryService.deleteMessageById(
              entry.network,
              entry.channel,
              message.id,
            );
            setMessages(prev => prev.filter(m => m.id !== message.id));
            setEntries(prev =>
              prev.flatMap(e => {
                if (e.network !== entry.network || e.channel !== entry.channel)
                  return e;
                const nextCount = Math.max(0, e.count - 1);
                if (nextCount === 0) return [];
                return { ...e, count: nextCount };
              }),
            );
          },
        },
      ],
    );
  };

  const renderEntry = ({ item }: { item: HistoryEntry }) => (
    <View style={styles.entryRow}>
      <TouchableOpacity
        style={styles.entryInfo}
        onPress={() => handleOpenEntry(item)}
      >
        <Text style={styles.entryTitle}>
          {item.channel} {selectedNetwork === 'all' ? `· ${item.network}` : ''}
        </Text>
        <Text style={styles.entryMeta}>
          {t('Messages: {count}', { count: item.count })}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => handleDeleteEntry(item)}
      >
        <Icon name="trash" size={16} color={colors.error || '#EF5350'} />
      </TouchableOpacity>
    </View>
  );

  const renderMessage = ({ item }: { item: IRCMessage }) => (
    <View style={styles.messageRow}>
      <View style={styles.messageInfo}>
        <Text style={styles.messageMeta}>
          {formatLocalDateTime(item.timestamp)}{' '}
          {item.from ? `· ${item.from}` : ''}
        </Text>
        {formatIRCTextAsComponent(item.text, styles.messageText)}
      </View>
      {selectedEntry && (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleDeleteMessage(selectedEntry, item)}
        >
          <Icon name="trash" size={14} color={colors.error || '#EF5350'} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('History Viewer')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() =>
                historySearchVisible
                  ? closeHistorySearch()
                  : setHistorySearchVisible(true)
              }
              style={styles.headerIconButton}
            >
              <Icon
                name={historySearchVisible ? 'times' : 'search'}
                size={16}
                color={colors.text || '#212121'}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {historySearchVisible && (
          <View style={styles.searchBar}>
            <View style={styles.searchInputRow}>
              <Icon
                name="search"
                size={14}
                color={colors.textSecondary || '#757575'}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={t('Search history...')}
                placeholderTextColor={colors.textSecondary || '#757575'}
                value={historySearchTerm}
                onChangeText={setHistorySearchTerm}
                autoFocus
              />
              {historySearchTerm.length > 0 && (
                <TouchableOpacity
                  onPress={() => setHistorySearchTerm('')}
                  style={styles.clearSearchButton}
                >
                  <Icon
                    name="times-circle"
                    size={16}
                    color={colors.textSecondary || '#757575'}
                    solid
                  />
                </TouchableOpacity>
              )}
            </View>
            {historySearchTerm.trim().length > 0 && (
              <Text style={styles.searchResultText}>
                {historySearchResultCount === 0
                  ? t('No results found')
                  : t('{count} result(s) found', {
                      count: historySearchResultCount.toString(),
                    })}
              </Text>
            )}
          </View>
        )}

        <View style={styles.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {networks.map(net => (
              <TouchableOpacity
                key={net}
                style={[
                  styles.networkChip,
                  selectedNetwork === net && styles.networkChipActive,
                ]}
                onPress={() => setSelectedNetwork(net)}
              >
                <Text
                  style={[
                    styles.networkChipText,
                    selectedNetwork === net && styles.networkChipTextActive,
                  ]}
                >
                  {net === 'all' ? t('All Networks') : net}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.iconButton} onPress={loadEntries}>
            <Icon
              name="sync"
              size={16}
              color={colors.textSecondary || '#757575'}
            />
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary || '#2196F3'} />
            <Text style={styles.loadingText}>
              {migrating
                ? t('Migrating history... {done}/{total}', {
                    done: migrationProgress.processed,
                    total:
                      migrationProgress.total || migrationProgress.processed,
                  })
                : t('Loading...')}
            </Text>
          </View>
        )}
        {!!migrationSummary && !loading && (
          <View style={styles.migrationSummaryRow}>
            <Text style={styles.migrationSummaryText}>{migrationSummary}</Text>
            <TouchableOpacity
              style={styles.migrationSummaryClose}
              onPress={() => setMigrationSummary('')}
            >
              <Text style={styles.migrationSummaryCloseText}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!selectedEntry ? (
          <FlatList
            data={filteredEntries}
            keyExtractor={item => `${item.network}:${item.channel}`}
            renderItem={renderEntry}
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.emptyText}>
                  {historySearchTerm.trim()
                    ? t('No results found')
                    : t('No stored messages')}
                </Text>
              ) : null
            }
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.messagesContainer}>
            <View style={styles.messagesHeader}>
              <TouchableOpacity onPress={() => setSelectedEntry(null)}>
                <Text style={styles.backText}>{t('Back')}</Text>
              </TouchableOpacity>
              <Text style={styles.messagesTitle}>
                {selectedEntry.channel} · {selectedEntry.network}
              </Text>
              <View style={styles.messagesHeaderActions}>
                <TouchableOpacity
                  style={styles.sortButton}
                  onPress={() => {
                    const nextOrder =
                      messageSortOrder === 'desc' ? 'asc' : 'desc';
                    setMessageSortOrder(nextOrder);
                    if (selectedEntry) {
                      loadMessages(selectedEntry, nextOrder);
                    }
                  }}
                >
                  <Text style={styles.sortText}>
                    {messageSortOrder === 'desc'
                      ? t('Newest first')
                      : t('Oldest first')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteEntry(selectedEntry)}
                >
                  <Text style={styles.deleteText}>
                    {t('Delete Channel History')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <FlatList
              data={filteredMessages}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              ListEmptyComponent={
                !loading ? (
                  <Text style={styles.emptyText}>
                    {historySearchTerm.trim()
                      ? t('No results found')
                      : t('No stored messages')}
                  </Text>
                ) : null
              }
              contentContainerStyle={styles.listContent}
            />
          </View>
        )}
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background || '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || '#E0E0E0',
      backgroundColor: colors.surface || '#F5F5F5',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text || '#212121',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerIconButton: {
      padding: 8,
    },
    closeButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    closeButtonText: {
      color: colors.buttonPrimary || '#2196F3',
      fontSize: 16,
      fontWeight: '500',
    },
    searchBar: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || '#E0E0E0',
      backgroundColor: colors.surface || '#F5F5F5',
    },
    searchInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 40,
      paddingHorizontal: 10,
      borderRadius: 20,
      backgroundColor: colors.background || '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border || '#E0E0E0',
    },
    searchIcon: {
      width: 14,
    },
    searchInput: {
      flex: 1,
      color: colors.text || '#212121',
      fontSize: 14,
      paddingVertical: 8,
    },
    clearSearchButton: {
      padding: 4,
    },
    searchResultText: {
      color: colors.textSecondary || '#757575',
      fontSize: 12,
      marginTop: 6,
      paddingHorizontal: 4,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || '#E0E0E0',
    },
    networkChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: colors.surfaceVariant || colors.surface || '#F2F2F2',
      marginRight: 8,
    },
    networkChipActive: {
      backgroundColor: colors.primary || '#2196F3',
    },
    networkChipText: {
      fontSize: 12,
      color: colors.textSecondary || '#757575',
    },
    networkChipTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    iconButton: {
      padding: 6,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
    },
    loadingText: {
      color: colors.textSecondary || '#757575',
    },
    migrationSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    migrationSummaryText: {
      color: colors.textSecondary || '#757575',
      fontSize: 12,
    },
    migrationSummaryClose: {
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    migrationSummaryCloseText: {
      color: colors.buttonPrimary || '#2196F3',
      fontSize: 12,
      fontWeight: '600',
    },
    listContent: {
      padding: 12,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || '#E0E0E0',
    },
    entryInfo: {
      flex: 1,
    },
    entryTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text || '#212121',
    },
    entryMeta: {
      fontSize: 12,
      color: colors.textSecondary || '#757575',
      marginTop: 2,
    },
    messagesContainer: {
      flex: 1,
    },
    messagesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || '#E0E0E0',
    },
    messagesHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sortButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.surfaceVariant || colors.surface || '#F2F2F2',
    },
    sortText: {
      fontSize: 12,
      color: colors.textSecondary || '#757575',
      fontWeight: '600',
    },
    messagesTitle: {
      fontSize: 13,
      color: colors.textSecondary || '#757575',
    },
    backText: {
      color: colors.buttonPrimary || '#2196F3',
      fontWeight: '600',
    },
    deleteText: {
      color: colors.error || '#EF5350',
      fontWeight: '600',
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || '#E0E0E0',
    },
    messageInfo: {
      flex: 1,
    },
    messageMeta: {
      fontSize: 11,
      color: colors.textSecondary || '#757575',
      marginBottom: 4,
    },
    messageText: {
      fontSize: 14,
      color: colors.text || '#212121',
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textSecondary || '#757575',
      paddingVertical: 24,
    },
  });
