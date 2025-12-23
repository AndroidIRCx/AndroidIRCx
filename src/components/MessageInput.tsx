import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { commandService } from '../services/CommandService';
import { layoutService } from '../services/LayoutService';

interface MessageInputProps {
  placeholder?: string;
  onSubmit: (message: string) => void;
  disabled?: boolean;
  prefilledMessage?: string;
  onPrefillUsed?: () => void;
  bottomInset?: number;
  tabType?: 'channel' | 'query' | 'server' | 'notice';
  tabName?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  placeholder = 'Enter a message',
  onSubmit,
  disabled = false,
  prefilledMessage,
  onPrefillUsed,
  bottomInset = 0,
  tabType = 'server',
  tabName,
}) => {
  const { colors } = useTheme();
  const layoutConfig = layoutService.getConfig();
  const totalBottomInset = bottomInset + layoutConfig.navigationBarOffset;
  const styles = createStyles(colors, totalBottomInset);
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ text: string; description?: string; source: 'alias' | 'history' }>>([]);

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSubmit(message.trim());
      setMessage('');
      setSuggestions([]);
    }
  };

  const scoreAliasForContext = (command: string): number => {
    // Simple heuristic: prefer channel aliases on channels, user aliases on queries, otherwise neutral
    const lower = command.toLowerCase();
    let score = 0;
    if (tabType === 'channel') {
      if (lower.includes('{channel}') || lower.includes('#')) score += 2;
    } else if (tabType === 'query') {
      if (lower.includes('{nick}') || lower.includes('/msg')) score += 2;
    } else {
      // server/notice
      if (!lower.includes('{channel}') && !lower.includes('{nick}')) score += 1;
    }
    return score;
  };

  const handleChangeText = (text: string) => {
    setMessage(text);
    if (!text.trim()) {
      setSuggestions([]);
      return;
    }
    const typed = text.startsWith('/') ? text : `/${text}`;
    const typedLower = typed.toLowerCase();

    // Aliases
    const aliasMatches = commandService.getAliases()
      .map(alias => {
        const aliasText = `/${alias.alias}`;
        return {
          text: aliasText,
          description: alias.description,
          source: 'alias' as const,
          score: scoreAliasForContext(alias.command),
        };
      })
      .filter(item => item.text.toLowerCase().startsWith(typedLower))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.text.localeCompare(b.text);
      })
      .slice(0, 6);

    // History
    const history = commandService.getHistory(30).map(entry => entry.command);
    const uniqueHistory = Array.from(new Set(history));
    const historyMatches = uniqueHistory
      .filter(cmd => cmd.toLowerCase().startsWith(typedLower))
      .map(cmd => ({ text: cmd, source: 'history' as const }))
      .slice(0, 6);

    // Merge, prefer aliases first, dedupe by text
    const merged: Array<{ text: string; description?: string; source: 'alias' | 'history' }> = [];
    [...aliasMatches, ...historyMatches].forEach(item => {
      if (!merged.some(m => m.text.toLowerCase() === item.text.toLowerCase())) {
        merged.push({ text: item.text, description: (item as any).description, source: item.source });
      }
    });

    setSuggestions(merged.slice(0, 8));
  };

  // Support external prefill (e.g., quick actions)
  React.useEffect(() => {
    if (prefilledMessage) {
      setMessage(prefilledMessage);
      setSuggestions([]);
      if (onPrefillUsed) onPrefillUsed();
    }
  }, [prefilledMessage, onPrefillUsed]);

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder}
          onSubmitEditing={handleSubmit}
          editable={!disabled}
          multiline={false}
        />
      </View>
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {suggestions.map(suggestion => (
            <TouchableOpacity
              key={suggestion.text}
              onPress={() => {
                setMessage(suggestion.text + (suggestion.text.endsWith(' ') ? '' : ' '));
                setSuggestions([]);
              }}
              style={styles.suggestionRow}
            >
              <Text style={[styles.suggestionText, { color: colors.text }]}>
                {suggestion.text}
                {suggestion.description ? ` — ${suggestion.description}` : suggestion.source === 'alias' ? ' — alias' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: any, bottomInset: number = 0) => StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Math.max(8, bottomInset),
    ...Platform.select({
      android: {
        elevation: 4,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
      },
    }),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.inputText,
    paddingVertical: 4,
  },
  suggestionsContainer: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  suggestionText: {
    fontSize: 13,
  },
});
