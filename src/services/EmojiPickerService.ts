/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NativeModules, Platform } from 'react-native';
import { isValidReaction } from '../utils/reactionValue';

interface NativeEmojiPicker {
  pick(): Promise<string | null>;
}

const nativePicker = (): NativeEmojiPicker | undefined =>
  NativeModules.EmojiPickerModule as NativeEmojiPicker | undefined;

/**
 * The system-style emoji picker (EmojiPickerModule: AndroidX EmojiPickerView
 * on Android). Neither Android nor iOS has a public "pick an emoji" call, so
 * the app brings the picker; iOS gets its own implementation behind the same
 * API when there is an iOS build.
 */
export const emojiPickerService = {
  /** Whether a picker exists on this device; the UI hides "+" otherwise. */
  isAvailable(): boolean {
    return (
      Platform.OS === 'android' && typeof nativePicker()?.pick === 'function'
    );
  },

  /** The emoji the user picked, or null when they closed the picker. */
  async pick(): Promise<string | null> {
    const picker = nativePicker();
    if (!picker || typeof picker.pick !== 'function') return null;
    try {
      const emoji = await picker.pick();
      return isValidReaction(emoji) ? emoji : null;
    } catch {
      return null;
    }
  },
};
