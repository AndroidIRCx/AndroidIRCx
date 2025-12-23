import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MessageReaction {
  emoji: string;
  users: string[]; // Array of nicknames who reacted
  count: number;
}

export interface MessageReactions {
  messageId: string;
  reactions: MessageReaction[];
}

class MessageReactionsService {
  private reactions: Map<string, MessageReactions> = new Map();
  private listeners: Array<(messageId: string, reactions: MessageReactions) => void> = [];
  private readonly STORAGE_KEY = '@AndroidIRCX:messageReactions';

  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.reactions = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Failed to load message reactions:', error);
    }
  }

  private async save(): Promise<void> {
    try {
      const data = Object.fromEntries(this.reactions);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save message reactions:', error);
    }
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(messageId: string, emoji: string, userNick: string): Promise<void> {
    let messageReactions = this.reactions.get(messageId);
    
    if (!messageReactions) {
      messageReactions = {
        messageId,
        reactions: [],
      };
      this.reactions.set(messageId, messageReactions);
    }

    // Find existing reaction for this emoji
    let reaction = messageReactions.reactions.find(r => r.emoji === emoji);
    
    if (reaction) {
      // Add user if not already present
      if (!reaction.users.includes(userNick)) {
        reaction.users.push(userNick);
        reaction.count = reaction.users.length;
      }
    } else {
      // Create new reaction
      reaction = {
        emoji,
        users: [userNick],
        count: 1,
      };
      messageReactions.reactions.push(reaction);
    }

    await this.save();
    this.notifyListeners(messageId, messageReactions);
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(messageId: string, emoji: string, userNick: string): Promise<void> {
    const messageReactions = this.reactions.get(messageId);
    if (!messageReactions) {
      return;
    }

    const reaction = messageReactions.reactions.find(r => r.emoji === emoji);
    if (!reaction) {
      return;
    }

    // Remove user
    const userIndex = reaction.users.indexOf(userNick);
    if (userIndex > -1) {
      reaction.users.splice(userIndex, 1);
      reaction.count = reaction.users.length;

      // Remove reaction if no users left
      if (reaction.count === 0) {
        const reactionIndex = messageReactions.reactions.indexOf(reaction);
        if (reactionIndex > -1) {
          messageReactions.reactions.splice(reactionIndex, 1);
        }
      }

      // Remove message reactions if no reactions left
      if (messageReactions.reactions.length === 0) {
        this.reactions.delete(messageId);
      }

      await this.save();
      this.notifyListeners(messageId, messageReactions);
    }
  }

  /**
   * Toggle a reaction (add if not present, remove if present)
   */
  async toggleReaction(messageId: string, emoji: string, userNick: string): Promise<void> {
    const messageReactions = this.reactions.get(messageId);
    const reaction = messageReactions?.reactions.find(r => r.emoji === emoji);
    const hasReacted = reaction?.users.includes(userNick) || false;

    if (hasReacted) {
      await this.removeReaction(messageId, emoji, userNick);
    } else {
      await this.addReaction(messageId, emoji, userNick);
    }
  }

  /**
   * Get reactions for a message
   */
  getReactions(messageId: string): MessageReactions | null {
    return this.reactions.get(messageId) || null;
  }

  /**
   * Check if a user has reacted with a specific emoji
   */
  hasUserReacted(messageId: string, emoji: string, userNick: string): boolean {
    const messageReactions = this.reactions.get(messageId);
    if (!messageReactions) {
      return false;
    }

    const reaction = messageReactions.reactions.find(r => r.emoji === emoji);
    return reaction?.users.includes(userNick) || false;
  }

  /**
   * Get all reactions for multiple messages
   */
  getReactionsForMessages(messageIds: string[]): Map<string, MessageReactions> {
    const result = new Map<string, MessageReactions>();
    for (const messageId of messageIds) {
      const reactions = this.getReactions(messageId);
      if (reactions) {
        result.set(messageId, reactions);
      }
    }
    return result;
  }

  /**
   * Clear reactions for a message
   */
  async clearReactions(messageId: string): Promise<void> {
    this.reactions.delete(messageId);
    await this.save();
    this.notifyListeners(messageId, {
      messageId,
      reactions: [],
    });
  }

  /**
   * Listen for reaction changes
   */
  onReactionsChange(callback: (messageId: string, reactions: MessageReactions) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(messageId: string, reactions: MessageReactions): void {
    this.listeners.forEach(callback => callback(messageId, reactions));
  }
}

export const messageReactionsService = new MessageReactionsService();

