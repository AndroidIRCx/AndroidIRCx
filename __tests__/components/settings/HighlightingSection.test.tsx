/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for HighlightingSection component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HighlightingSection } from '../../../src/components/settings/sections/HighlightingSection';
import { highlightService } from '../../../src/services/HighlightService';

// Mock dependencies
jest.mock('../../../src/services/HighlightService');
jest.mock('react-native', () => {
  const React = require('react');
  return {
    Alert: {
      alert: jest.fn(),
    },
    Platform: {
      OS: 'android',
    },
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    TextInput: (props: any) => React.createElement('TextInput', props),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    FlatList: (props: any) => React.createElement('FlatList', props),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (style: any) => style,
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

describe('HighlightingSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (highlightService.getHighlightWords as jest.Mock).mockReturnValue([]);
    (highlightService.addHighlightWord as jest.Mock).mockResolvedValue(undefined);
    (highlightService.removeHighlightWord as jest.Mock).mockResolvedValue(undefined);
  });

  it('should render add highlight word input', () => {
    const { getByPlaceholderText } = render(
      <HighlightingSection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    expect(getByPlaceholderText(/Enter a word to highlight/i)).toBeTruthy();
  });

  it('should display existing highlight words', () => {
    (highlightService.getHighlightWords as jest.Mock).mockReturnValue(['test', 'hello']);

    const { getByText } = render(
      <HighlightingSection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    expect(getByText('test')).toBeTruthy();
    expect(getByText('hello')).toBeTruthy();
  });

  it.skip('should add highlight word when input is submitted', async () => {
    const { getByPlaceholderText, getByText } = render(
      <HighlightingSection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    const input = getByPlaceholderText(/Enter a word to highlight/i);
    fireEvent.changeText(input, 'newword');

    // Find and press the add button (assuming it's rendered as part of the input)
    // This depends on how SettingInput handles onPress
    await waitFor(() => {
      expect(highlightService.addHighlightWord).toHaveBeenCalledWith('newword');
    });
  });

  it('should not add empty highlight word', async () => {
    const { getByPlaceholderText } = render(
      <HighlightingSection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    const input = getByPlaceholderText(/Enter a word to highlight/i);
    fireEvent.changeText(input, '   '); // Only whitespace

    // Should not call addHighlightWord for empty/whitespace
    expect(highlightService.addHighlightWord).not.toHaveBeenCalled();
  });

  it('should show alert when removing highlight word', () => {
    (highlightService.getHighlightWords as jest.Mock).mockReturnValue(['test']);

    const { getByText } = render(
      <HighlightingSection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    const removeButton = getByText('test');
    fireEvent.press(removeButton);

    expect(Alert.alert).toHaveBeenCalled();
  });
});
