/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGHLIGHT_WORDS_STORAGE_KEY = 'HIGHLIGHT_WORDS';

class HighlightService {
  private highlightWords: string[] = [];
  private listeners: Array<() => void> = [];
  // One compiled pattern for all words, rebuilt only when the list changes:
  // isHighlighted runs for every incoming message. undefined = not built yet.
  private pattern: RegExp | null | undefined;

  constructor() {
    this.loadHighlightWords();
  }

  private async loadHighlightWords() {
    try {
      const storedWords = await AsyncStorage.getItem(
        HIGHLIGHT_WORDS_STORAGE_KEY,
      );
      if (storedWords) {
        this.highlightWords = JSON.parse(storedWords);
        this.pattern = undefined;
      }
    } catch (error) {
      console.error('Failed to load highlight words:', error);
    }
  }

  private async saveHighlightWords() {
    this.pattern = undefined;
    try {
      await AsyncStorage.setItem(
        HIGHLIGHT_WORDS_STORAGE_KEY,
        JSON.stringify(this.highlightWords),
      );
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save highlight words:', error);
    }
  }

  public getHighlightWords(): string[] {
    return [...this.highlightWords];
  }

  public async addHighlightWord(word: string) {
    const sanitizedWord = word.trim();
    if (sanitizedWord && !this.highlightWords.includes(sanitizedWord)) {
      this.highlightWords.push(sanitizedWord);
      await this.saveHighlightWords();
    }
  }

  public async removeHighlightWord(word: string) {
    this.highlightWords = this.highlightWords.filter(w => w !== word);
    await this.saveHighlightWords();
  }

  private buildPattern(): RegExp | null {
    if (this.highlightWords.length === 0) return null;
    const alternatives = this.highlightWords.map(word =>
      // Escape special regex characters in the word
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    return new RegExp(`\\b(?:${alternatives.join('|')})\\b`, 'i');
  }

  public isHighlighted(text: string): boolean {
    if (!text || this.highlightWords.length === 0) {
      return false;
    }
    if (this.pattern === undefined) {
      try {
        this.pattern = this.buildPattern();
      } catch (e) {
        console.error('Invalid highlight word pattern:', e);
        this.pattern = null;
      }
    }
    if (this.pattern) {
      return this.pattern.test(text);
    }
    // Fallback to simple includes
    const lower = text.toLowerCase();
    return this.highlightWords.some(word => lower.includes(word.toLowerCase()));
  }

  public onHighlightWordsChange(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in highlight words listener:', error);
      }
    });
  }
}

export const highlightService = new HighlightService();
