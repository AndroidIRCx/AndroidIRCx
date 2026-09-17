/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Alert, TouchableOpacity } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeEditorScreen } from '../../src/screens/ThemeEditorScreen';
import { encodeThemeShare } from '../../src/themes/shareTheme';

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

jest.mock('../../src/i18n/localization', () => ({
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

// Override the shared jest.setup mock, which renders a raw "QRCode" string
// inside a View (illegal in RN). Render a proper host component instead.
jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ value }: any) =>
      React.createElement(View, { testID: 'qr-code', 'data-value': value }),
  };
});

jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ onValueChange, testID, value }: any) =>
      React.createElement(View, {
        testID,
        // Expose the handler so tests can drive slider changes.
        onValueChange,
        'data-value': value,
      }),
  };
});

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
  beforeEach(async () => {
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

  it('renders nothing when hidden', async () => {
    const { queryByText } = await render(
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
    const { findByPlaceholderText, findByText } = await render(
      <ThemeEditorScreen visible onClose={onClose} onSave={onSave} />,
    );

    await fireEvent.changeText(
      await findByPlaceholderText('Enter theme name'),
      'Night Sky',
    );
    await fireEvent.press(await findByText('Save'));

    await waitFor(async () => {
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
    const { findByText } = await render(
      <ThemeEditorScreen visible onClose={jest.fn()} onSave={jest.fn()} />,
    );

    await fireEvent.press(await findByText('Save'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter a theme name',
    );
  });

  it('updates an existing theme', async () => {
    const onSave = jest.fn();
    const { findByDisplayValue, findByText } = await render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    await fireEvent.changeText(await findByDisplayValue('Ocean'), 'Ocean 2');
    await fireEvent.press(await findByText('Save'));

    await waitFor(async () => {
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
    const { findByText } = await render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    await fireEvent.press(await findByText('Edit format'));
    await fireEvent.press(await findByText('Save Message Formats'));
    await fireEvent.press(await findByText('Save'));

    await waitFor(async () => {
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
    const { UNSAFE_getAllByType, findByText, findByPlaceholderText } =
      await render(
        <ThemeEditorScreen
          visible
          theme={mockTheme as any}
          onClose={jest.fn()}
          onSave={onSave}
        />,
      );

    // Index 9: header (2) + actions row (2: import/share) + message-format
    // button (1) + 3 seed swatches + 1 generate button precede the first
    // colour-category preview (background).
    await fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[9]);
    await fireEvent.changeText(
      await findByPlaceholderText('#FFFFFF'),
      '#123456',
    );
    await fireEvent.press(await findByText('Done'));
    await fireEvent.press(await findByText('Save'));

    await waitFor(async () => {
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
    const { UNSAFE_getAllByType, findByText, findByPlaceholderText } =
      await render(
        <ThemeEditorScreen
          visible
          theme={mockTheme as any}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />,
      );

    await fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[9]);
    await fireEvent.changeText(await findByPlaceholderText('#FFFFFF'), 'oops');
    await fireEvent.press(await findByText('Done'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid Color',
      'Please enter a valid hex color (e.g., #FF0000) or rgba value',
    );
  });

  it('renders the live preview transcript', async () => {
    const { findByText } = await render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(await findByText('Hey, welcome to the channel!')).toBeTruthy();
    expect(await findByText('→ nick has joined #general')).toBeTruthy();
  });

  it('generates a full theme from the seed and saves it', async () => {
    const { UNSAFE_getAllByType, findByText, findByPlaceholderText } =
      await render(
        <ThemeEditorScreen
          visible
          theme={mockTheme as any}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />,
      );

    // Index 5 is the seed "Background" swatch: header (2) + actions row (2) +
    // message-format button (1) precede it.
    await fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[5]);
    await fireEvent.changeText(
      await findByPlaceholderText('#FFFFFF'),
      '#0B1E33',
    );
    await fireEvent.press(await findByText('Done'));
    await fireEvent.press(await findByText('Generate theme'));
    await fireEvent.press(await findByText('Save'));

    await waitFor(async () => {
      const call = themeService.updateCustomTheme.mock.calls[0];
      const savedColors = call[1].colors;
      expect(savedColors.background).toBe('#0B1E33');
      // Derived: every key present and distinct from the original mock surface.
      expect(savedColors.surface).not.toBe(mockTheme.colors.surface);
      expect(typeof savedColors.messageText).toBe('string');
    });
  });

  it('reports failing WCAG contrast pairs', async () => {
    const brokenTheme = {
      ...mockTheme,
      colors: {
        ...mockTheme.colors,
        text: '#000000',
        background: '#010101',
      },
    };
    const { findByText } = await render(
      <ThemeEditorScreen
        visible
        theme={brokenTheme as any}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(await findByText(/Body text on background/)).toBeTruthy();
  });

  it('shows a positive message when all pairs pass WCAG AA', async () => {
    const fgKeys = [
      'text',
      'textSecondary',
      'messageText',
      'messageNick',
      'messageTimestamp',
      'systemMessage',
      'inputText',
      'inputPlaceholder',
      'buttonPrimaryText',
      'buttonSecondaryText',
      'tabActiveText',
      'tabInactiveText',
      'modalText',
      'userNormal',
      'userOwner',
      'userOp',
      'userVoice',
      'highlightText',
    ];
    const bgKeys = [
      'background',
      'messageBackground',
      'inputBackground',
      'buttonPrimary',
      'buttonSecondary',
      'tabActive',
      'tabInactive',
      'modalBackground',
      'userListBackground',
      'highlightBackground',
    ];
    const accessibleColors: Record<string, string> = { ...mockTheme.colors };
    fgKeys.forEach(key => {
      accessibleColors[key] = '#000000';
    });
    bgKeys.forEach(key => {
      accessibleColors[key] = '#FFFFFF';
    });
    const accessibleTheme = { ...mockTheme, colors: accessibleColors };

    const { findByText } = await render(
      <ThemeEditorScreen
        visible
        theme={accessibleTheme as any}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(await findByText('All text meets WCAG AA')).toBeTruthy();
  });

  it('adjusts a colour with the HSL sliders', async () => {
    const SliderMock = require('@react-native-community/slider').default;
    const { UNSAFE_getAllByType, findByText, findByPlaceholderText } =
      await render(
        <ThemeEditorScreen
          visible
          theme={mockTheme as any}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />,
      );

    // Open the background colour picker (index 9, see comment above).
    await fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[9]);
    await fireEvent.changeText(
      await findByPlaceholderText('#FFFFFF'),
      '#3366CC',
    );

    const sliders = UNSAFE_getAllByType(SliderMock);
    expect(sliders).toHaveLength(3);
    // Move the hue slider to 0 degrees.
    await fireEvent(sliders[0], 'valueChange', 0);
    await fireEvent.press(await findByText('Done'));
    await fireEvent.press(await findByText('Save'));

    await waitFor(async () => {
      const saved = themeService.updateCustomTheme.mock.calls[0][1].colors;
      expect(saved.background).toMatch(/^#[0-9A-F]{6}$/);
      expect(saved.background).not.toBe('#3366CC');
    });
  });

  it('imports a keyed palette and merges the colours', async () => {
    const { findByText, findByPlaceholderText } = await render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('Import palette'));
    await fireEvent.changeText(
      await findByPlaceholderText('Paste palette here'),
      'background: #123456\nmessageNick: #abcdef',
    );
    await fireEvent.press(await findByText('Apply'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Import palette',
      'Applied 2 colours',
    );

    await fireEvent.press(await findByText('Save'));
    await waitFor(async () => {
      expect(themeService.updateCustomTheme).toHaveBeenCalledWith(
        'custom-1',
        expect.objectContaining({
          colors: expect.objectContaining({
            background: '#123456',
            messageNick: '#ABCDEF',
          }),
        }),
      );
    });
  });

  it('imports a bare hex list via the seed generator', async () => {
    const { findByText, findByPlaceholderText } = await render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('Import palette'));
    await fireEvent.changeText(
      await findByPlaceholderText('Paste palette here'),
      '#101010, #FF0000, #00FF00',
    );
    await fireEvent.press(await findByText('Apply'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Import palette',
      'Generated a theme from 3 colours',
    );
  });

  it('alerts when the pasted palette has no colours', async () => {
    const { findByText, findByPlaceholderText } = await render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('Import palette'));
    await fireEvent.changeText(
      await findByPlaceholderText('Paste palette here'),
      'hello world',
    );
    await fireEvent.press(await findByText('Apply'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Import palette',
      'No colours found',
    );
  });

  it('copies the share code to the clipboard', async () => {
    const Clipboard = require('@react-native-clipboard/clipboard');
    const { findByText } = await render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('Share'));
    await fireEvent.press(await findByText('Copy'));

    expect(Clipboard.setString).toHaveBeenCalledTimes(1);
    expect(Clipboard.setString.mock.calls[0][0]).toMatch(/^AIRCX1:/);
  });

  it('loads a theme from a valid share code', async () => {
    const code = encodeThemeShare({
      name: 'Imported',
      colors: mockTheme.colors as any,
    });
    const { findByText, findByPlaceholderText } = await render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('Share'));
    await fireEvent.changeText(
      await findByPlaceholderText('Paste a share code'),
      code,
    );
    await fireEvent.press(await findByText('Load'));
    await fireEvent.press(await findByText('Save'));

    await waitFor(async () => {
      expect(themeService.updateCustomTheme).toHaveBeenCalledWith(
        'custom-1',
        expect.objectContaining({ name: 'Imported' }),
      );
    });
  });

  it('alerts on an invalid share code', async () => {
    const { findByText, findByPlaceholderText } = await render(
      <ThemeEditorScreen
        visible
        theme={mockTheme as any}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('Share'));
    await fireEvent.changeText(
      await findByPlaceholderText('Paste a share code'),
      'not-a-valid-code',
    );
    await fireEvent.press(await findByText('Load'));

    expect(Alert.alert).toHaveBeenCalledWith('Share', 'Invalid code');
  });
});
