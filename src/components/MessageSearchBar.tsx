import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';

export interface MessageSearchFilters {
  searchTerm: string;
  messageTypes: {
    message: boolean;
    notice: boolean;
    system: boolean;
    join: boolean;
    part: boolean;
    quit: boolean;
  };
}

interface MessageSearchBarProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (filters: MessageSearchFilters) => void;
  resultCount?: number;
}

export const MessageSearchBar: React.FC<MessageSearchBarProps> = ({
  visible,
  onClose,
  onSearch,
  resultCount,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const tags = 'component:MessageSearchBar,file:MessageSearchBar.tsx';

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [messageTypes, setMessageTypes] = useState({
    message: true,
    notice: true,
    system: true,
    join: false,
    part: false,
    quit: false,
  });

  const handleSearch = useCallback(
    (term: string) => {
      setSearchTerm(term);
      onSearch({ searchTerm: term, messageTypes });
    },
    [messageTypes, onSearch]
  );

  const toggleMessageType = useCallback(
    (type: keyof typeof messageTypes) => {
      const newTypes = { ...messageTypes, [type]: !messageTypes[type] };
      setMessageTypes(newTypes);
      onSearch({ searchTerm, messageTypes: newTypes });
    },
    [messageTypes, searchTerm, onSearch]
  );

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    onSearch({ searchTerm: '', messageTypes });
  }, [messageTypes, onSearch]);

  if (!visible) return null;

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      {/* Search Input Row */}
      <View style={styles.searchRow}>
        <Icon name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('Search messages...', { _tags: tags })}
          placeholderTextColor={colors.textSecondary}
          value={searchTerm}
          onChangeText={handleSearch}
          autoFocus
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Icon name="times-circle" size={16} color={colors.textSecondary} solid />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={[styles.filterButton, showFilters && styles.filterButtonActive]}>
          <Icon name="filter" size={16} color={showFilters ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="times" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Result Count */}
      {searchTerm.length > 0 && resultCount !== undefined && (
        <View style={styles.resultCountRow}>
          <Text style={styles.resultCountText}>
            {resultCount === 0
              ? t('No results found', { _tags: tags })
              : t('{count} result(s) found', { _tags: tags, count: resultCount.toString() })}
          </Text>
        </View>
      )}

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <Text style={styles.filtersTitle}>{t('Message Types:', { _tags: tags })}</Text>
          <View style={styles.filtersGrid}>
            {Object.entries(messageTypes).map(([type, enabled]) => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, enabled && styles.filterChipActive]}
                onPress={() => toggleMessageType(type as keyof typeof messageTypes)}>
                <Text style={[styles.filterChipText, enabled && styles.filterChipTextActive]}>
                  {t(type, { _tags: tags })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 8,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    searchIcon: {
      marginLeft: 4,
    },
    searchInput: {
      flex: 1,
      height: 40,
      backgroundColor: colors.background,
      borderRadius: 20,
      paddingHorizontal: 16,
      color: colors.text,
      fontSize: 14,
    },
    clearButton: {
      padding: 4,
    },
    filterButton: {
      padding: 8,
      borderRadius: 8,
    },
    filterButtonActive: {
      backgroundColor: colors.primary + '20',
    },
    closeButton: {
      padding: 8,
    },
    resultCountRow: {
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    resultCountText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    filtersContainer: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    filtersTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    filtersGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 12,
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    filterChipTextActive: {
      color: colors.buttonPrimaryText || '#fff',
      fontWeight: '600',
    },
  });
