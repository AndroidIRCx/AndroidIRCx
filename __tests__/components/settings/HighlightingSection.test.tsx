/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for HighlightingSection component
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HighlightingSection } from '../../../src/components/settings/sections/HighlightingSection';
import { highlightService } from '../../../src/services/HighlightService';

const mockCapturedItems = new Map<string, any>();

jest.mock('../../../src/services/HighlightService');

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../../src/components/settings/SettingItem', () => {
  const ReactLocal = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    SettingItem: ({ item }: any) => {
      mockCapturedItems.set(item.id, item);
      return ReactLocal.createElement(
        TouchableOpacity,
        { testID: `setting-${item.id}` },
        ReactLocal.createElement(Text, null, item.title || item.id),
      );
    },
  };
});

const mockColors = {
  text: '#000000',
  textSecondary: '#666666',
  primary: '#007AFF',
  surface: '#FFFFFF',
  border: '#E0E0E0',
  background: '#F5F5F5',
};

const mockStyles = {
  settingItem: {},
  settingContent: {},
  settingTitleRow: {},
  settingTitle: {},
  settingDescription: {},
  disabledItem: {},
  disabledText: {},
  chevron: {},
};

const mockSettingIcons = {};

const renderSection = (settingIcons: Record<string, any> = mockSettingIcons) =>
  render(
    <HighlightingSection
      colors={mockColors}
      styles={mockStyles}
      settingIcons={settingIcons}
    />,
  );

let currentWords: string[] = [];

describe('HighlightingSection', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
    currentWords = [];
    (highlightService.getHighlightWords as jest.Mock).mockImplementation(
      () => currentWords,
    );
    (highlightService.addHighlightWord as jest.Mock).mockResolvedValue(
      undefined,
    );
    (highlightService.removeHighlightWord as jest.Mock).mockResolvedValue(
      undefined,
    );
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('renders the add highlight word input', async () => {
    await renderSection();
    await waitFor(() =>
      expect(mockCapturedItems.has('highlight-add')).toBe(true),
    );
    const item = mockCapturedItems.get('highlight-add');
    expect(item.type).toBe('input');
    expect(item.placeholder).toMatch(/Enter a word to highlight/i);
  });

  it('displays existing highlight words', async () => {
    currentWords = ['test', 'hello'];
    const { getByText } = await renderSection();
    await waitFor(() =>
      expect(mockCapturedItems.has('highlight-word-test')).toBe(true),
    );
    expect(getByText('test')).toBeTruthy();
    expect(getByText('hello')).toBeTruthy();
  });

  it('updates the pending word via onValueChange', async () => {
    await renderSection();
    await waitFor(() =>
      expect(mockCapturedItems.has('highlight-add')).toBe(true),
    );
    await act(async () => {
      mockCapturedItems.get('highlight-add').onValueChange('newword');
    });
    // After typing, the captured item value should reflect the pending word.
    await waitFor(() =>
      expect(mockCapturedItems.get('highlight-add').value).toBe('newword'),
    );
  });

  it('adds a highlight word when a non-empty value is submitted', async () => {
    (highlightService.addHighlightWord as jest.Mock).mockImplementation(
      async (w: string) => {
        currentWords = [w];
      },
    );

    await renderSection();
    await waitFor(() =>
      expect(mockCapturedItems.has('highlight-add')).toBe(true),
    );

    await act(async () => {
      mockCapturedItems.get('highlight-add').onValueChange('  newword  ');
    });
    await act(async () => {
      await mockCapturedItems.get('highlight-add').onPress();
    });

    expect(highlightService.addHighlightWord).toHaveBeenCalledWith('newword');
    // Pending word is cleared after a successful add.
    await waitFor(() =>
      expect(mockCapturedItems.get('highlight-add').value).toBe(''),
    );
  });

  it('does not add an empty/whitespace highlight word', async () => {
    await renderSection();
    await waitFor(() =>
      expect(mockCapturedItems.has('highlight-add')).toBe(true),
    );

    await act(async () => {
      mockCapturedItems.get('highlight-add').onValueChange('   ');
    });
    await act(async () => {
      await mockCapturedItems.get('highlight-add').onPress();
    });

    expect(highlightService.addHighlightWord).not.toHaveBeenCalled();
  });

  it('confirms removal via alert and removes the word', async () => {
    currentWords = ['test'];
    await renderSection();
    await waitFor(() =>
      expect(mockCapturedItems.has('highlight-word-test')).toBe(true),
    );

    mockCapturedItems.get('highlight-word-test').onPress();
    expect(Alert.alert).toHaveBeenCalled();

    // Invoke the destructive "Remove" button from the alert.
    const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] || [];
    const removeButton = buttons.find((b: any) => b.style === 'destructive');
    expect(removeButton).toBeTruthy();
    await removeButton.onPress();

    expect(highlightService.removeHighlightWord).toHaveBeenCalledWith('test');
  });

  it('resolves icons from settingIcons for rendered items', async () => {
    // The settingIcons[item.id] branch of icon resolution runs on every
    // rendered item; provide an entry so it is exercised explicitly.
    currentWords = [];
    mockCapturedItems.clear();
    const { unmount } = await renderSection({
      'highlight-add': { name: 'star' } as any,
    });
    await waitFor(() =>
      expect(mockCapturedItems.has('highlight-add')).toBe(true),
    );
    unmount();
  });
});
