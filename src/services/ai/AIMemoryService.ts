/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../Logger';

/**
 * What the assistant remembers about its owner between conversations.
 *
 * Built the way every assistant that does this well builds it: **discrete
 * entries the user can read, edit and delete**, rather than an opaque profile
 * synthesised behind their back. That matches the rest of this app's AI work —
 * the channel opt-in, the allowed hosts, the sessions — where everything is
 * visible and revocable.
 *
 * It never leaves the device on its own. Entries are injected into the
 * assistant's system prompt, so they do reach whichever provider the user
 * configured, exactly like the rest of the conversation. Anything the user
 * does not want sent should not be remembered, and the settings screen exists
 * so they can see what would be.
 */

const STORAGE_KEY = '@AndroidIRCX:aiMemories';
const STORAGE_ENABLED_KEY = '@AndroidIRCX:aiMemoryEnabled';

/** Oldest entries past this are dropped. */
export const MAX_MEMORIES = 100;
/** One entry cannot be an essay. */
export const MAX_MEMORY_CHARS = 300;
/**
 * How much of the store is injected into a turn. A prompt made mostly of
 * remembered trivia crowds out the conversation it is supposed to help with.
 */
export const MAX_INJECTED_CHARS = 2000;

export type MemoryCategory = 'person' | 'preference' | 'project' | 'other';

export interface AIMemory {
  id: string;
  text: string;
  category: MemoryCategory;
  createdAt: number;
}

const CATEGORIES: MemoryCategory[] = [
  'person',
  'preference',
  'project',
  'other',
];

let seq = 0;
const newId = () => `m${Date.now().toString(36)}${++seq}`;

class AIMemoryService {
  private memories: AIMemory[] = [];
  private enabled = true;
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const [raw, enabled] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(STORAGE_ENABLED_KEY),
      ]);
      if (enabled !== null) this.enabled = enabled === 'true';
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.memories = parsed
          .filter(
            (entry: unknown): entry is AIMemory =>
              !!entry &&
              typeof (entry as AIMemory).id === 'string' &&
              typeof (entry as AIMemory).text === 'string',
          )
          .slice(0, MAX_MEMORIES);
      }
    } catch (error) {
      logger.warn('ai', `Failed to load AI memories: ${String(error)}`);
      this.memories = [];
    }
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.memories));
    } catch (error) {
      logger.warn('ai', `Failed to save AI memories: ${String(error)}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    this.loaded = true;
    try {
      await AsyncStorage.setItem(STORAGE_ENABLED_KEY, String(enabled));
    } catch (error) {
      logger.warn('ai', `Failed to save AI memory switch: ${String(error)}`);
    }
  }

  list(): AIMemory[] {
    return [...this.memories].sort((a, b) => b.createdAt - a.createdAt);
  }

  private normalizeCategory(value: unknown): MemoryCategory {
    return CATEGORIES.includes(value as MemoryCategory)
      ? (value as MemoryCategory)
      : 'other';
  }

  /**
   * Store a fact. Returns the entry, or null when there was nothing to store
   * or the same thing is already remembered — repeating a fact should not
   * fill the store with copies of it.
   */
  async remember(text: string, category?: unknown): Promise<AIMemory | null> {
    await this.load();
    const clean = String(text || '')
      .trim()
      .substring(0, MAX_MEMORY_CHARS);
    if (!clean) return null;

    const already = this.memories.find(
      entry => entry.text.toLowerCase() === clean.toLowerCase(),
    );
    if (already) return null;

    const entry: AIMemory = {
      id: newId(),
      text: clean,
      category: this.normalizeCategory(category),
      createdAt: Date.now(),
    };
    this.memories.unshift(entry);
    if (this.memories.length > MAX_MEMORIES) {
      this.memories = this.memories.slice(0, MAX_MEMORIES);
    }
    await this.persist();
    return entry;
  }

  async forget(id: string): Promise<boolean> {
    await this.load();
    const before = this.memories.length;
    this.memories = this.memories.filter(entry => entry.id !== id);
    if (this.memories.length === before) return false;
    await this.persist();
    return true;
  }

  async clearAll(): Promise<void> {
    this.loaded = true;
    this.memories = [];
    await this.persist();
  }

  /** Entries whose text contains every word of the query. */
  search(query: string): AIMemory[] {
    const words = String(query || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) return this.list();
    return this.list().filter(entry => {
      const text = entry.text.toLowerCase();
      return words.every(word => text.includes(word));
    });
  }

  /**
   * The block appended to the assistant's system prompt, or '' when there is
   * nothing to say. Newest first and capped, because a prompt made mostly of
   * remembered trivia crowds out the conversation it is meant to help with.
   */
  promptBlock(): string {
    if (!this.enabled || !this.memories.length) return '';
    const lines: string[] = [];
    let used = 0;
    for (const entry of this.list()) {
      const line = `- (${entry.category}) ${entry.text}`;
      if (used + line.length > MAX_INJECTED_CHARS) break;
      lines.push(line);
      used += line.length;
    }
    if (!lines.length) return '';
    return [
      '',
      'What you remember about this user, from earlier conversations:',
      ...lines,
      '',
      'Use it when it helps. If something here turns out to be wrong or out of',
      'date, say so and call forget_memory rather than working around it.',
    ].join('\n');
  }

  /** Test hook. */
  resetForTests(): void {
    this.memories = [];
    this.enabled = true;
    this.loaded = false;
  }
}

export const aiMemoryService = new AIMemoryService();
