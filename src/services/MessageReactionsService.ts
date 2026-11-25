/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidReaction } from '../utils/reactionValue';

/** Offered in the selection bar until the user has reactions of their own. */
export const DEFAULT_QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const QUICK_REACTION_COUNT = DEFAULT_QUICK_REACTIONS.length;

export interface MessageReaction {
  emoji: string;
  users: string[]; // Array of nicknames who reacted
  count: number;
}

export interface MessageReactions {
  messageId: string;
  reactions: MessageReaction[];
}

/**
 * Reactions are stored per network message: an IRCv3 msgid is unique on its
 * network, not across networks.
 */
export const reactionKey = (network: string, msgid: string): string =>
  `${network}\n${msgid}`;

/** Sends a react/unreact to the network; returns whether it went out. */
export type ReactionSender = (
  network: string,
  target: string,
  msgid: string,
  emoji: string,
  remove: boolean,
) => boolean;

class MessageReactionsService {
  private sender: ReactionSender | null = null;

  /**
   * ConnectionManager registers how reactions reach the network, so this
   * module does not import it (that would be an import cycle).
   */
  setReactionSender(sender: ReactionSender | null): void {
    this.sender = sender;
  }

  /**
   * The user tapped a reaction on a network message: tell the network, and
   * only if that worked, show it. Returns whether it was sent.
   */
  async toggleNetworkReaction(
    network: string,
    target: string,
    msgid: string,
    emoji: string,
    userNick: string,
  ): Promise<boolean> {
    if (!isValidReaction(emoji)) return false;
    const key = reactionKey(network, msgid);
    const remove = this.hasUserReacted(key, emoji, userNick);
    if (!this.sender || !this.sender(network, target, msgid, emoji, remove)) {
      return false;
    }
    if (remove) {
      await this.removeReaction(key, emoji, userNick);
    } else {
      await this.addReaction(key, emoji, userNick);
      await this.rememberQuickReaction(emoji);
    }
    return true;
  }

  /** A react or unreact arrived from the network (client-tags/react.md). */
  async applyRemoteReaction(
    network: string,
    msgid: string,
    emoji: string,
    userNick: string,
    remove: boolean,
  ): Promise<void> {
    // Same limit we send with: a "reaction" of a paragraph is not shown.
    if (!network || !msgid || !userNick || !isValidReaction(emoji)) return;
    const key = reactionKey(network, msgid);
    if (remove) {
      await this.removeReaction(key, emoji, userNick);
    } else {
      await this.addReaction(key, emoji, userNick);
    }
  }

  private reactions: Map<string, MessageReactions> = new Map();
  private listeners: Array<
    (messageId: string, reactions: MessageReactions) => void
  > = [];
  private readonly STORAGE_KEY = '@AndroidIRCX:messageReactions';
  private readonly RECENT_KEY = '@AndroidIRCX:recentReactions';
  private recentReactions: string[] = [];

  /**
   * The reactions offered in the selection bar: the user's most recent ones
   * first, topped up with the defaults.
   */
  getQuickReactions(): string[] {
    const quick = [...this.recentReactions];
    for (const emoji of DEFAULT_QUICK_REACTIONS) {
      if (quick.length >= QUICK_REACTION_COUNT) break;
      if (!quick.includes(emoji)) quick.push(emoji);
    }
    return quick.slice(0, QUICK_REACTION_COUNT);
  }

  private async rememberQuickReaction(emoji: string): Promise<void> {
    this.recentReactions = [
      emoji,
      ...this.recentReactions.filter(item => item !== emoji),
    ].slice(0, QUICK_REACTION_COUNT);
    try {
      await AsyncStorage.setItem(
        this.RECENT_KEY,
        JSON.stringify(this.recentReactions),
      );
    } catch (error) {
      console.error('Failed to save recent reactions:', error);
    }
  }

  async initialize(): Promise<void> {
    try {
      const recent = JSON.parse(
        (await AsyncStorage.getItem(this.RECENT_KEY)) || '[]',
      );
      this.recentReactions = Array.isArray(recent)
        ? recent.filter(isValidReaction).slice(0, QUICK_REACTION_COUNT)
        : [];
    } catch {
      this.recentReactions = [];
    }
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
  async addReaction(
    messageId: string,
    emoji: string,
    userNick: string,
  ): Promise<void> {
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
  async removeReaction(
    messageId: string,
    emoji: string,
    userNick: string,
  ): Promise<void> {
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
  async toggleReaction(
    messageId: string,
    emoji: string,
    userNick: string,
  ): Promise<void> {
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
  onReactionsChange(
    callback: (messageId: string, reactions: MessageReactions) => void,
  ): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(
    messageId: string,
    reactions: MessageReactions,
  ): void {
    this.listeners.forEach(callback => callback(messageId, reactions));
  }
}

export const messageReactionsService = new MessageReactionsService();
