/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Alert, TouchableOpacity } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeEditorScreen } from '../../src/screens/ThemeEditorScreen';

const mockTheme = {
  id: 'custom-1',
  name: 'Ocean',
  type: 'custom',
  baseTheme: 'dark',
  colors: {
    background: '#000000',
    surface: '#111111',
    surfaceVariant: '#222222',
    surfaceAlt: '#333333',
    cardBackground: '#121212',
    text: '#ffffff',
    textSecondary: '#cccccc',
    textDisabled: '#999999',
    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#64B5F6',
    onPrimary: '#ffffff',
    secondary: '#FF9800',
    onSecondary: '#000000',
    accent: '#4CAF50',
    onAccent: '#ffffff',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    border: '#444444',
    borderLight: '#555555',
    divider: '#666666',
    messageBackground: '#111111',
    messageText: '#ffffff',
    messageNick: '#64B5F6',
    messageTimestamp: '#888888',
    systemMessage: '#FF9800',
    noticeMessage: '#9C27B0',
    joinMessage: '#4CAF50',
    partMessage: '#F44336',
    quitMessage: '#E91E63',
    kickMessage: '#FF5722',
    nickMessage: '#00BCD4',
    modeMessage: '#FFC107',
    topicMessage: '#8BC34A',
    inviteMessage: '#CDDC39',
    monitorMessage: '#009688',
    actionMessage: '#FFEB3B',
    rawMessage: '#9E9E9E',
    ctcpMessage: '#795548',
    inputBackground: '#1a1a1a',
    inputText: '#ffffff',
    inputBorder: '#555555',
    inputPlaceholder: '#777777',
    buttonPrimary: '#2196F3',
    buttonPrimaryText: '#ffffff',
    buttonSecondary: '#555555',
    buttonSecondaryText: '#ffffff',
    buttonDisabled: '#333333',
    buttonDisabledText: '#777777',
    buttonText: '#ffffff',
    tabActive: '#2196F3',
    tabInactive: '#555555',
    tabActiveText: '#ffffff',
    tabInactiveText: '#cccccc',
    tabBorder: '#666666',
    modalOverlay: 'rgba(0,0,0,0.5)',
    modalBackground: '#111111',
    modalText: '#ffffff',
    userListBackground: '#121212',
    userListText: '#ffffff',
    userListBorder: '#333333',
    userOwner: '#ff0000',
    userAdmin: '#ff6600',
    userOp: '#ffaa00',
    userHalfop: '#aaff00',
    userVoice: '#00ffaa',
    userNormal: '#ffffff',
    highlightBackground: '#333300',
    highlightText: '#ffff00',
    selectionBackground: '#4444aa',
  },
  messageFormats: {
    privmsg: '<{nick}> {message}',
  },
};

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => {
    if (!params) {
      return key;
    }
    return Object.entries(params).reduce(
      (result, [paramKey, value]) =>
        result.replace(`{${paramKey}}`, String(value)),
      key,
    );
  },
}));

jest.mock('../../src/services/ThemeService', () => ({
  themeService: {
    getColors: jest.fn(() => mockTheme.colors),
    createCustomTheme: jest.fn(),
    updateCustomTheme: jest.fn(),
  },
}));

jest.mock('../../src/utils/MessageFormatDefaults', () => ({
  getDefaultMessageFormats: jest.fn(() => ({
    privmsg: '<{nick}> {message}',
  })),
}));

jest.mock('../../src/screens/MessageFormatEditorScreen', () => ({
  MessageFormatEditorScreen: ({ visible, onSave, onCancel }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return visible ? (
      <>
        <Text>Mock Message Format Editor</Text>
        <Text onPress={() => onSave({ privmsg: '[{nick}] {message}' })}>
          Save Message Formats
        </Text>
        <Text onPress={onCancel}>Cancel Message Formats</Text>
      </>
    ) : null;
  },
}));

const { themeService } = require('../../src/services/ThemeService');

describe('ThemeEditorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    themeService.createCustomTheme.mockResolvedValue({
      id: 'new-theme',
      name: 'New Theme',
      baseTheme: 'dark',
      type: 'custom',
    });
    themeService.updateCustomTheme.mockResolvedValue(undefined);
  });

  it('renders nothing when hidden', () => {
    const { queryByText } = render(
      <ThemeEditorScreen
        visible={false}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(queryByText('New Theme')).toBeNull();
  });

  it('creates a new theme and saves it', async () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    const { findByPlaceholderText, findByText } = render(
      <ThemeEditorScreen visible onClose={onClose} onSave={onSave} />,
    );

    fireEvent.changeText(
      await findByPlaceholderText('Enter theme name'),
      'Night Sky',
    );
    fireEvent.press(await findByText('Save'));

    await waitFor(() => {
      expect(themeService.createCustomTheme).toHaveBeenCalledWith(
        'Night Sky',
        'dark',
      );
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new-theme',
          colors: mockTheme.colors,
        }),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('validates missing theme name', async () => {
    const { findByText } = render(
      <ThemeEditorScreen visible onClose={jest.fn()} onSave={jest.fn()} />,
    );

    fireEvent.press(await findByText('Save'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter a theme name',
    );
  });

  it('updates an existing theme', async () => {
    const onSave = jest.fn();
    const { findByDisplayValue, findByText } = render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.changeText(await findByDisplayValue('Ocean'), 'Ocean 2');
    fireEvent.press(await findByText('Save'));

    await waitFor(() => {
      expect(themeService.updateCustomTheme).toHaveBeenCalledWith(
        'custom-1',
        expect.objectContaining({
          name: 'Ocean 2',
          colors: mockTheme.colors,
        }),
      );
    });
  });

  it('opens message format editor and saves custom formats', async () => {
    const onSave = jest.fn();
    const { findByText } = render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.press(await findByText('Edit format'));
    fireEvent.press(await findByText('Save Message Formats'));
    fireEvent.press(await findByText('Save'));

    await waitFor(() => {
      expect(themeService.updateCustomTheme).toHaveBeenCalledWith(
        'custom-1',
        expect.objectContaining({
          messageFormats: { privmsg: '[{nick}] {message}' },
        }),
      );
    });
  });

  it('edits a color with the picker', async () => {
    const onSave = jest.fn();
    const { UNSAFE_getAllByType, findByText, findByPlaceholderText } = render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[3]);
    fireEvent.changeText(await findByPlaceholderText('#FFFFFF'), '#123456');
    fireEvent.press(await findByText('Done'));
    fireEvent.press(await findByText('Save'));

    await waitFor(() => {
      expect(themeService.updateCustomTheme).toHaveBeenCalledWith(
        'custom-1',
        expect.objectContaining({
          colors: expect.objectContaining({
            background: '#123456',
          }),
        }),
      );
    });
  });

  it('shows invalid color alert for bad hex input', async () => {
    const { UNSAFE_getAllByType, findByText, findByPlaceholderText } = render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[3]);
    fireEvent.changeText(await findByPlaceholderText('#FFFFFF'), 'oops');
    fireEvent.press(await findByText('Done'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid Color',
      'Please enter a valid hex color (e.g., #FF0000) or rgba value',
    );
  });
});
