/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NativeModules, Platform } from 'react-native';
import { emojiPickerService } from '../../src/services/EmojiPickerService';
import {
  isValidReaction,
  MAX_REACTION_BYTES,
} from '../../src/utils/reactionValue';

describe('isValidReaction', () => {
  it('accepts one emoji, even a long ZWJ sequence', () => {
    expect(isValidReaction('👍')).toBe(true);
    expect(isValidReaction('👨🏽‍👩🏽‍👧🏽‍👦🏽')).toBe(false); // 41 bytes
    expect(isValidReaction('👨‍👩‍👧‍👦')).toBe(true); // 25 bytes
    expect(isValidReaction('lol')).toBe(true);
  });

  it('refuses empty, too long, control characters and non-strings', () => {
    expect(isValidReaction('')).toBe(false);
    expect(isValidReaction('   ')).toBe(false);
    expect(isValidReaction('a'.repeat(MAX_REACTION_BYTES + 1))).toBe(false);
    expect(isValidReaction('a'.repeat(MAX_REACTION_BYTES))).toBe(true);
    expect(isValidReaction('ok\r\nPRIVMSG')).toBe(false);
    expect(isValidReaction('x\u0000')).toBe(false);
    expect(isValidReaction(null)).toBe(false);
    expect(isValidReaction(42)).toBe(false);
  });
});

describe('emojiPickerService', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    delete (NativeModules as any).EmojiPickerModule;
    (Platform as any).OS = originalOS;
  });

  it('is available only on Android with the native module', () => {
    (Platform as any).OS = 'android';
    expect(emojiPickerService.isAvailable()).toBe(false);
    (NativeModules as any).EmojiPickerModule = { pick: jest.fn() };
    expect(emojiPickerService.isAvailable()).toBe(true);
    (Platform as any).OS = 'ios';
    expect(emojiPickerService.isAvailable()).toBe(false);
  });

  it('returns the picked emoji, or null when closed, refused or failing', async () => {
    const pick = jest.fn();
    (NativeModules as any).EmojiPickerModule = { pick };
    pick.mockResolvedValueOnce('🎉');
    await expect(emojiPickerService.pick()).resolves.toBe('🎉');
    pick.mockResolvedValueOnce(null);
    await expect(emojiPickerService.pick()).resolves.toBeNull();
    pick.mockResolvedValueOnce('x'.repeat(100));
    await expect(emojiPickerService.pick()).resolves.toBeNull();
    pick.mockRejectedValueOnce(new Error('no activity'));
    await expect(emojiPickerService.pick()).resolves.toBeNull();
  });

  it('returns null without the native module', async () => {
    await expect(emojiPickerService.pick()).resolves.toBeNull();
  });
});
