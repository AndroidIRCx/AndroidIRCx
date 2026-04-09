/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for HighlightService
 */

import { highlightService } from '../../src/services/HighlightService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('HighlightService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    // @ts-ignore - reset highlight words
    highlightService.highlightWords = [];
    // @ts-ignore - reset listeners
    highlightService.listeners = [];
  });

  describe('getHighlightWords', () => {
    it('should return empty array initially', () => {
      const words = highlightService.getHighlightWords();
      expect(words).toEqual([]);
    });

    it('should return copy of highlight words', async () => {
      await highlightService.addHighlightWord('test');

      const words1 = highlightService.getHighlightWords();
      const words2 = highlightService.getHighlightWords();

      expect(words1).not.toBe(words2);
      expect(words1).toEqual(words2);
    });
  });

  describe('addHighlightWord', () => {
    it('should add a word', async () => {
      await highlightService.addHighlightWord('test');

      const words = highlightService.getHighlightWords();
      expect(words).toContain('test');
    });

    it('should trim whitespace', async () => {
      await highlightService.addHighlightWord('  test  ');

      const words = highlightService.getHighlightWords();
      expect(words).toContain('test');
      expect(words).not.toContain('  test  ');
    });

    it('should not add duplicate words', async () => {
      await highlightService.addHighlightWord('test');
      await highlightService.addHighlightWord('test');

      const words = highlightService.getHighlightWords();
      expect(words).toHaveLength(1);
    });

    it('should not add empty words', async () => {
      await highlightService.addHighlightWord('');
      await highlightService.addHighlightWord('   ');

      const words = highlightService.getHighlightWords();
      expect(words).toHaveLength(0);
    });

    it('should save to storage', async () => {
      await highlightService.addHighlightWord('test');

      const stored = await AsyncStorage.getItem('HIGHLIGHT_WORDS');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toContain('test');
    });

    it('should notify listeners', async () => {
      const listener = jest.fn();
      const unsubscribe = highlightService.onHighlightWordsChange(listener);

      await highlightService.addHighlightWord('test');

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('removeHighlightWord', () => {
    it('should remove a word', async () => {
      await highlightService.addHighlightWord('test');
      await highlightService.removeHighlightWord('test');

      const words = highlightService.getHighlightWords();
      expect(words).not.toContain('test');
    });

    it('should handle removing non-existent word', async () => {
      await highlightService.addHighlightWord('test');

      await highlightService.removeHighlightWord('non-existent');

      const words = highlightService.getHighlightWords();
      expect(words).toHaveLength(1);
    });

    it('should notify listeners on remove', async () => {
      await highlightService.addHighlightWord('test');

      const listener = jest.fn();
      const unsubscribe = highlightService.onHighlightWordsChange(listener);

      await highlightService.removeHighlightWord('test');

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('isHighlighted', () => {
    it('should return false for empty text', async () => {
      await highlightService.addHighlightWord('test');

      expect(highlightService.isHighlighted('')).toBe(false);
    });

    it('should return false when no words are set', () => {
      expect(highlightService.isHighlighted('some text')).toBe(false);
    });

    it('should detect highlight word', async () => {
      await highlightService.addHighlightWord('test');

      expect(highlightService.isHighlighted('this is a test message')).toBe(
        true,
      );
    });

    it('should be case insensitive', async () => {
      await highlightService.addHighlightWord('TEST');

      expect(highlightService.isHighlighted('this is a test message')).toBe(
        true,
      );
    });

    it('should match whole words only', async () => {
      await highlightService.addHighlightWord('test');

      // Should match "test" as a whole word
      expect(highlightService.isHighlighted('this is a test')).toBe(true);
      // Should not match "testing"
      expect(highlightService.isHighlighted('this is testing')).toBe(false);
    });

    it('should handle multiple words', async () => {
      await highlightService.addHighlightWord('hello');
      await highlightService.addHighlightWord('world');

      expect(highlightService.isHighlighted('hello there')).toBe(true);
      expect(highlightService.isHighlighted('world news')).toBe(true);
      expect(highlightService.isHighlighted('goodbye')).toBe(false);
    });

    it('should handle special characters in words', async () => {
      await highlightService.addHighlightWord('c++');

      // Should not throw
      expect(() => highlightService.isHighlighted('I love c++')).not.toThrow();
    });

    it('should fallback to includes for invalid regex', async () => {
      // Add a word that would create invalid regex
      await highlightService.addHighlightWord('[invalid');

      // Should fallback and not throw
      expect(() => highlightService.isHighlighted('test')).not.toThrow();
    });
  });

  describe('onHighlightWordsChange', () => {
    it('should add listener', async () => {
      const listener = jest.fn();
      const unsubscribe = highlightService.onHighlightWordsChange(listener);

      await highlightService.addHighlightWord('test');

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it('should remove listener', async () => {
      const listener = jest.fn();
      const unsubscribe = highlightService.onHighlightWordsChange(listener);

      unsubscribe();

      await highlightService.addHighlightWord('test');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });

      highlightService.onHighlightWordsChange(errorListener);

      // Should not throw
      await expect(
        highlightService.addHighlightWord('test'),
      ).resolves.not.toThrow();
    });
  });

  describe('load from storage', () => {
    it('should load saved words on construction', async () => {
      await AsyncStorage.setItem(
        'HIGHLIGHT_WORDS',
        JSON.stringify(['word1', 'word2']),
      );

      // Manually reload words to simulate construction
      // @ts-ignore
      await highlightService.loadHighlightWords();

      const words = highlightService.getHighlightWords();
      expect(words).toContain('word1');
      expect(words).toContain('word2');
    });

    it('should handle storage errors gracefully', async () => {
      jest
        .spyOn(AsyncStorage, 'getItem')
        .mockRejectedValueOnce(new Error('Storage error'));

      // Should not throw when loading
      // @ts-ignore
      await expect(
        highlightService.loadHighlightWords(),
      ).resolves.not.toThrow();
    });
  });
});
