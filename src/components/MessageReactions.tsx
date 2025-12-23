import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { messageReactionsService, MessageReactions } from '../services/MessageReactionsService';

interface MessageReactionsProps {
  messageId: string;
  currentUserNick?: string;
  onReactionPress?: (emoji: string) => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

export const MessageReactionsComponent: React.FC<MessageReactionsProps> = ({
  messageId,
  currentUserNick,
  onReactionPress,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [reactions, setReactions] = useState<MessageReactions | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    // Load initial reactions
    const initialReactions = messageReactionsService.getReactions(messageId);
    setReactions(initialReactions);

    // Listen for changes
    const unsubscribe = messageReactionsService.onReactionsChange((msgId, msgReactions) => {
      if (msgId === messageId) {
        setReactions(msgReactions);
      }
    });

    return unsubscribe;
  }, [messageId]);

  const handleReactionPress = async (emoji: string) => {
    if (!currentUserNick) {
      return;
    }

    await messageReactionsService.toggleReaction(messageId, emoji, currentUserNick);
    
    if (onReactionPress) {
      onReactionPress(emoji);
    }
  };

  const handleAddReaction = () => {
    setShowEmojiPicker(true);
  };

  if (!reactions || reactions.reactions.length === 0) {
    return null; // Don't render anything if no reactions and add button removed
  }

  return (
    <>
      <View style={styles.container}>
        {reactions.reactions.map((reaction, index) => {
          const hasReacted = currentUserNick
            ? messageReactionsService.hasUserReacted(messageId, reaction.emoji, currentUserNick)
            : false;

          return (
            <TouchableOpacity
              key={`${reaction.emoji}-${index}`}
              style={[
                styles.reactionButton,
                hasReacted && styles.reactionButtonActive,
              ]}
              onPress={() => handleReactionPress(reaction.emoji)}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}>
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={[
                styles.reactionCount,
                hasReacted && styles.reactionCountActive,
              ]}>
                {reaction.count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionButtonActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  reactionCountActive: {
    color: colors.primary,
  },
  addButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalClose: {
    fontSize: 20,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  emojiList: {
    padding: 16,
  },
  emojiButton: {
    padding: 12,
    margin: 4,
    borderRadius: 8,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
    minHeight: 50,
  },
  emojiText: {
    fontSize: 24,
  },
});

