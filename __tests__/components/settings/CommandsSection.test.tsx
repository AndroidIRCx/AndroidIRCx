/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for CommandsSection component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { CommandsSection } from '../../../src/components/settings/sections/CommandsSection';
import { commandService } from '../../../src/services/CommandService';

// Mock dependencies
jest.mock('../../../src/services/CommandService');
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

describe.skip('CommandsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (commandService.getAliases as jest.Mock).mockReturnValue([]);
    (commandService.getCustomCommands as jest.Mock).mockReturnValue([]);
    (commandService.getHistory as jest.Mock).mockReturnValue([]);
    (commandService.addAlias as jest.Mock).mockResolvedValue(undefined);
    (commandService.removeAlias as jest.Mock).mockResolvedValue(undefined);
    (commandService.addCustomCommand as jest.Mock).mockResolvedValue(undefined);
    (commandService.removeCustomCommand as jest.Mock).mockResolvedValue(undefined);
    (commandService.deleteHistoryEntry as jest.Mock).mockResolvedValue(undefined);
    (commandService.clearHistory as jest.Mock).mockResolvedValue(undefined);
  });

  it('should render command history section', () => {
    const { getByText } = render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    expect(getByText(/Command History/i)).toBeTruthy();
  });

  it('should render command aliases section', () => {
    const { getByText } = render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    expect(getByText(/Command Aliases/i)).toBeTruthy();
  });

  it('should render custom commands section', () => {
    const { getByText } = render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    expect(getByText(/Custom Commands/i)).toBeTruthy();
  });

  it('should display command history entries', () => {
    const mockHistory = [
      {
        id: '1',
        command: '/join #test',
        timestamp: Date.now(),
        channel: '#test',
      },
    ];
    (commandService.getHistory as jest.Mock).mockReturnValue(mockHistory);

    const { getByText } = render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    expect(getByText('/join #test')).toBeTruthy();
  });

  it('should display command aliases', () => {
    const mockAliases = [
      {
        alias: 'j',
        command: '/join {channel}',
        description: 'Join channel',
      },
    ];
    (commandService.getAliases as jest.Mock).mockReturnValue(mockAliases);

    const { getByText } = render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    expect(getByText('/j')).toBeTruthy();
  });

  it('should display custom commands', () => {
    const mockCommands = [
      {
        name: 'greet',
        command: '/msg {channel} Hello',
        description: 'Greet channel',
        parameters: ['channel'],
      },
    ];
    (commandService.getCustomCommands as jest.Mock).mockReturnValue(mockCommands);

    const { getByText } = render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    expect(getByText('/greet')).toBeTruthy();
  });
});
