/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Command Suggestions Dropdown
 * Auto-completion for IRC service commands in message input
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CommandSuggestion } from '../services/ServiceCommandProvider';

interface CommandSuggestionsProps {
  suggestions: CommandSuggestion[];
  onSelect: (suggestion: CommandSuggestion) => void;
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    surface: string;
    border: string;
    background: string;
  };
  visible: boolean;
}

export const CommandSuggestions: React.FC<CommandSuggestionsProps> = ({
  suggestions,
  onSelect,
  colors,
  visible,
}) => {
  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {suggestions.map((suggestion, index) => (
          <TouchableOpacity
            key={`${suggestion.text}-${index}`}
            style={[
              styles.suggestionItem,
              { borderBottomColor: colors.border },
              index === suggestions.length - 1 && styles.lastItem,
            ]}
            onPress={() => onSelect(suggestion)}>
            <View style={styles.iconContainer}>
              <Icon
                name={suggestion.isAlias ? 'flash' : 'server'}
                size={18}
                color={suggestion.isAlias ? colors.primary : colors.textSecondary}
              />
            </View>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {suggestion.label}
                </Text>
                {suggestion.isAlias && (
                  <View
                    style={[
                      styles.aliasBadge,
                      { backgroundColor: colors.primary },
                    ]}>
                    <Text style={styles.aliasBadgeText}>{'alias'}</Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.description, { color: colors.textSecondary }]}>
                {suggestion.description}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: '100%',
    left: 8,
    right: 8,
    maxHeight: 250,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  scrollView: {
    maxHeight: 250,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  aliasBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aliasBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    marginTop: 2,
  },
});
