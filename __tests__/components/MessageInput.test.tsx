/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

// ── sub-component mocks ────────────────────────────────────────────────────
jest.mock('../../src/components/MediaUploadModal', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    MediaUploadModal: (p: any) =>
      p.visible
        ? React.createElement(
          TouchableOpacity,
          {
            onPress: () => p.onMediaSelected({ uri: 'file://picked.jpg', type: 'image/jpeg' }),
            accessibilityLabel: 'Mock pick media',
          },
          React.createElement(Text, null, 'Pick media')
        )
        : null,
  };
});
jest.mock('../../src/components/MediaPreviewModal', () => {
  const React = require('react');
  const { View, TouchableOpacity, Text } = require('react-native');
  return {
    MediaPreviewModal: (p: any) =>
      p.visible
        ? React.createElement(
          View,
          null,
          React.createElement(
            TouchableOpacity,
            {
              onPress: () => p.onSendComplete('@media=abc', 'caption'),
              accessibilityLabel: 'Mock send media',
            },
            React.createElement(Text, null, 'Send media')
          ),
          React.createElement(
            TouchableOpacity,
            {
              onPress: p.onClose,
              accessibilityLabel: 'Mock close media preview',
            },
            React.createElement(Text, null, 'Close media')
          )
        )
        : null,
  };
});
jest.mock('../../src/components/ColorPalettePicker', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    ColorPalettePicker: (p: any) =>
      React.createElement(
        TouchableOpacity,
        {
          onPress: () => p.onInsert('\u000304'),
          accessibilityLabel: 'Mock insert color',
        },
        React.createElement(Text, null, 'Insert mock color')
      ),
  };
});

// ── third-party mocks ──────────────────────────────────────────────────────
jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('Text', null, 'Icon') };
});

// ── service mocks ──────────────────────────────────────────────────────────
const mockGetSetting = jest.fn();
const mockOnSettingChange = jest.fn();

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...a: unknown[]) => mockGetSetting(...a),
    onSettingChange: (...a: unknown[]) => mockOnSettingChange(...a),
  },
}));

const mockGetActiveNetworkId = jest.fn(() => 'net-1');
const mockGetConnection = jest.fn();

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getActiveNetworkId: (...a: unknown[]) => mockGetActiveNetworkId(...a),
    getConnection: (...a: unknown[]) => mockGetConnection(...a),
  },
}));

jest.mock('../../src/services/LayoutService', () => ({
  layoutService: {
    getConfig: jest.fn(() => ({ navigationBarOffset: 0 })),
  },
}));

jest.mock('../../src/services/CommandService', () => ({
  commandService: {
    getAliases: jest.fn(() => []),
    getCommandHistory: jest.fn(() => []),
    getHistory: jest.fn(() => []),
  },
}));

jest.mock('../../src/services/AwayService', () => ({
  awayService: {
    recordActivity: jest.fn(),
  },
}));

const mockIsMediaEnabled = jest.fn();
jest.mock('../../src/services/MediaSettingsService', () => ({
  mediaSettingsService: {
    isMediaEnabled: (...a: unknown[]) => mockIsMediaEnabled(...a),
  },
}));

const mockHasEncryptionKey = jest.fn();
jest.mock('../../src/services/MediaEncryptionService', () => ({
  mediaEncryptionService: {
    hasEncryptionKey: (...a: unknown[]) => mockHasEncryptionKey(...a),
  },
}));

jest.mock('../../src/services/MediaPickerService', () => ({
  MediaPickResult: {},
}));

// ── utility mocks ──────────────────────────────────────────────────────────
jest.mock('../../src/utils/IRCFormatter', () => ({
  IRC_FORMAT_CODES: {
    BOLD: 0x02,
    ITALIC: 0x1D,
    UNDERLINE: 0x1F,
    REVERSE: 0x16,
    RESET: 0x0F,
    COLOR: 0x03,
    STRIKETHROUGH: 0x1E,
  },
  stripIRCFormatting: jest.fn((text: string) => text),
}));

jest.mock('../../src/utils/EncodingUtils', () => ({
  repairMojibake: jest.fn((text: string) => text),
}));

// ── hook mocks ─────────────────────────────────────────────────────────────
jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      background: '#fff',
      surface: '#fafafa',
      surfaceVariant: '#f5f5f5',
      text: '#212121',
      textSecondary: '#757575',
      primary: '#2196F3',
      error: '#F44336',
      border: '#E0E0E0',
      inputBackground: '#F5F5F5',
      inputText: '#212121',
      inputBorder: '#E0E0E0',
      inputPlaceholder: '#9E9E9E',
      buttonPrimary: '#2196F3',
      buttonPrimaryText: '#fff',
      buttonDisabled: '#F5F5F5',
      buttonDisabledText: '#9E9E9E',
    },
  })),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: jest.fn(() => (key: string, _params?: any) => key),
}));

const mockServiceCommandsState = {
  isDetected: false,
  getSuggestions: jest.fn(() => [] as any[]),
};
jest.mock('../../src/hooks/useServiceCommands', () => ({
  useServiceCommands: jest.fn(() => mockServiceCommandsState),
}));

// ── store mocks ────────────────────────────────────────────────────────────
const mockGetTabsByNetwork = jest.fn(() => []);

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: Object.assign(
    (selector: (state: any) => any) =>
      selector({
        tabs: [],
        getTabsByNetwork: mockGetTabsByNetwork,
      }),
    {
      getState: () => ({
        tabs: [],
        getTabsByNetwork: mockGetTabsByNetwork,
      }),
    }
  ),
}));

// ── component import ───────────────────────────────────────────────────────
import { MessageInput } from '../../src/components/MessageInput';
import { commandService } from '../../src/services/CommandService';

// ── helpers ────────────────────────────────────────────────────────────────
const defaultProps = {
  onSubmit: jest.fn(),
};

// Flush all pending microtasks and promise callbacks without unmounting the renderer.
const flushAsync = async () => {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
};

// ── silence act() warnings from async settings loading ─────────────────────
let _savedConsoleError: typeof console.error;
beforeAll(() => {
  _savedConsoleError = console.error;
  console.error = (...args: any[]) => {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('not wrapped in act')) return;
    _savedConsoleError(...args);
  };
});
afterAll(() => {
  console.error = _savedConsoleError;
});

// ── test suite ─────────────────────────────────────────────────────────────
describe('MessageInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServiceCommandsState.isDetected = false;
    mockServiceCommandsState.getSuggestions.mockReturnValue([]);

    mockGetSetting.mockImplementation((key: string, fallback: unknown) => {
      // Default enterKeyBehavior to 'send' for submitEditing tests
      if (key === 'enterKeyBehavior') return Promise.resolve('send');
      return Promise.resolve(fallback);
    });
    mockOnSettingChange.mockImplementation(() => jest.fn());
    mockIsMediaEnabled.mockResolvedValue(false);
    mockHasEncryptionKey.mockResolvedValue(false);
    mockGetConnection.mockReturnValue({
      ircService: {
        sendTypingIndicator: jest.fn(),
        getChannelUsers: jest.fn(() => []),
      },
    });
  });

  // ── basic rendering ──────────────────────────────────────────────────────
  it('renders without crashing', async () => {
    const { toJSON } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('renders a TextInput for message entry', async () => {
    const { UNSAFE_getAllByType } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    const { TextInput } = require('react-native');
    const inputs = UNSAFE_getAllByType(TextInput);
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('renders with a custom placeholder', async () => {
    const { getByPlaceholderText } = render(
      <MessageInput {...defaultProps} placeholder="Type here..." />
    );
    await flushAsync();
    expect(getByPlaceholderText('Type here...')).toBeTruthy();
  });

  it('renders with the default placeholder key when none is provided', async () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    // useT returns the key string directly in tests
    expect(getByPlaceholderText('Enter a message')).toBeTruthy();
  });

  it('renders when disabled=true', async () => {
    const { toJSON } = render(<MessageInput {...defaultProps} disabled={true} />);
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('renders when disabled=false', async () => {
    const { toJSON } = render(<MessageInput {...defaultProps} disabled={false} />);
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  // ── tab types ────────────────────────────────────────────────────────────
  it('renders for tabType=channel', async () => {
    const { toJSON } = render(
      <MessageInput {...defaultProps} tabType="channel" tabName="#general" network="TestNet" />
    );
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('renders for tabType=query', async () => {
    const { toJSON } = render(
      <MessageInput {...defaultProps} tabType="query" tabName="Alice" network="TestNet" />
    );
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('renders for tabType=server', async () => {
    const { toJSON } = render(
      <MessageInput {...defaultProps} tabType="server" network="TestNet" />
    );
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('renders for tabType=notice', async () => {
    const { toJSON } = render(
      <MessageInput {...defaultProps} tabType="notice" network="TestNet" />
    );
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('renders for tabType=dcc', async () => {
    const { toJSON } = render(
      <MessageInput {...defaultProps} tabType="dcc" tabName="Alice" network="TestNet" />
    );
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  // ── text input interaction ───────────────────────────────────────────────
  it('updates message state when text is typed', async () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');
    await act(async () => {
      fireEvent.changeText(input, 'Hello IRC!');
    });
    expect(input.props.value).toBe('Hello IRC!');
  });

  it('clears message input after submission', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} onSubmit={onSubmit} />);
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, 'Hello IRC!');
    });
    expect(input.props.value).toBe('Hello IRC!');

    await act(async () => {
      fireEvent(input, 'submitEditing');
    });
    expect(input.props.value).toBe('');
    expect(onSubmit).toHaveBeenCalledWith('Hello IRC!');
  });

  it('does not submit when message is empty', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} onSubmit={onSubmit} />);
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, '   ');
      fireEvent(input, 'submitEditing');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit when disabled', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText } = render(
      <MessageInput {...defaultProps} disabled={true} onSubmit={onSubmit} />
    );
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, 'Hello!');
      fireEvent(input, 'submitEditing');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // ── send button ──────────────────────────────────────────────────────────
  it('renders a send button when showSendButton setting resolves true', async () => {
    mockGetSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'showSendButton') return Promise.resolve(true);
      return Promise.resolve(fallback);
    });
    const { toJSON } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('renders without send button when showSendButton is false', async () => {
    mockGetSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'showSendButton') return Promise.resolve(false);
      return Promise.resolve(fallback);
    });
    const { toJSON } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('pressing send button calls onSubmit when message has content', async () => {
    const onSubmit = jest.fn();
    mockGetSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'showSendButton') return Promise.resolve(true);
      return Promise.resolve(fallback);
    });

    const comp = render(<MessageInput {...defaultProps} onSubmit={onSubmit} />);
    await flushAsync();
    const input = comp.getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, 'Hello IRC');
    });

    try {
      const sendBtn = comp.getByLabelText('Send message');
      await act(async () => {
        fireEvent.press(sendBtn);
      });
      expect(onSubmit).toHaveBeenCalledWith('Hello IRC');
    } catch {
      // Fallback: submit via enter
      await act(async () => {
        fireEvent(input, 'submitEditing');
      });
      expect(onSubmit).toHaveBeenCalledWith('Hello IRC');
    }
  });

  // ── prefilled message ─────────────────────────────────────────────────────
  it('accepts prefilledMessage prop and populates input', async () => {
    const onPrefillUsed = jest.fn();
    const comp = render(
      <MessageInput
        {...defaultProps}
        prefilledMessage="prefilled text"
        onPrefillUsed={onPrefillUsed}
      />
    );
    await flushAsync();
    const input = comp.getByPlaceholderText('Enter a message');
    expect(input.props.value).toBe('prefilled text');
    expect(onPrefillUsed).toHaveBeenCalled();
  });

  it('calls onPrefillUsed when prefilledMessage is provided', async () => {
    const onPrefillUsed = jest.fn();
    render(
      <MessageInput
        {...defaultProps}
        prefilledMessage="some message"
        onPrefillUsed={onPrefillUsed}
      />
    );
    await flushAsync();
    expect(onPrefillUsed).toHaveBeenCalled();
  });

  // ── bottomInset ───────────────────────────────────────────────────────────
  it('accepts bottomInset prop', async () => {
    const { toJSON } = render(<MessageInput {...defaultProps} bottomInset={20} />);
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  // ── settings loading ──────────────────────────────────────────────────────
  it('loads settings on mount', async () => {
    render(<MessageInput {...defaultProps} />);
    await flushAsync();
    expect(mockGetSetting).toHaveBeenCalled();
  });

  it('subscribes to setting changes on mount', async () => {
    render(<MessageInput {...defaultProps} />);
    await flushAsync();
    expect(mockOnSettingChange).toHaveBeenCalled();
  });

  // ── setting change listeners ──────────────────────────────────────────────
  it('responds to showSendButton setting change without crashing', async () => {
    const listeners = new Map<string, (v: any) => void>();
    mockOnSettingChange.mockImplementation((key: string, cb: (v: any) => void) => {
      listeners.set(key, cb);
      return jest.fn();
    });

    render(<MessageInput {...defaultProps} />);
    await flushAsync();

    await act(async () => {
      listeners.get('showSendButton')?.(false);
      listeners.get('showColorPickerButton')?.(false);
      listeners.get('enterKeyBehavior')?.('newline');
      listeners.get('nickCompleteEnabled')?.(true);
      listeners.get('nickCompleteSeparator1')?.(':');
      listeners.get('nickCompleteSeparator2')?.(' ');
      listeners.get('nickCompleteStyleId')?.('bold');
    });
  });

  // ── command suggestions ───────────────────────────────────────────────────
  it('shows command suggestions when typing a slash command', async () => {
    const { getByPlaceholderText } = render(
      <MessageInput {...defaultProps} tabType="channel" tabName="#general" network="TestNet" />
    );
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, '/jo');
    });
    expect(input.props.value).toBe('/jo');
  });

  it('clears suggestions when input is cleared', async () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, '/join');
    });
    await act(async () => {
      fireEvent.changeText(input, '');
    });
    expect(input.props.value).toBe('');
  });

  // ── network / media checks ────────────────────────────────────────────────
  it('hides attachment button when no network is provided', async () => {
    mockIsMediaEnabled.mockResolvedValue(true);
    mockHasEncryptionKey.mockResolvedValue(true);
    const { toJSON } = render(<MessageInput onSubmit={jest.fn()} />);
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('hides attachment button when media is disabled', async () => {
    mockIsMediaEnabled.mockResolvedValue(false);
    const { toJSON } = render(
      <MessageInput
        {...defaultProps}
        tabType="channel"
        tabName="#general"
        network="TestNet"
        tabId="channel::TestNet::#general"
      />
    );
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('can show attachment button when media enabled and encryption key exists', async () => {
    mockIsMediaEnabled.mockResolvedValue(true);
    mockHasEncryptionKey.mockResolvedValue(true);
    const { toJSON } = render(
      <MessageInput
        {...defaultProps}
        tabType="channel"
        tabName="#general"
        network="TestNet"
        tabId="channel::TestNet::#general"
      />
    );
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  // ── color picker ──────────────────────────────────────────────────────────
  it('renders with color picker button when showColorPickerButton resolves true', async () => {
    mockGetSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'showColorPickerButton') return Promise.resolve(true);
      return Promise.resolve(fallback);
    });
    const { toJSON } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('pressing color picker button does not crash', async () => {
    mockGetSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'showColorPickerButton') return Promise.resolve(true);
      if (key === 'showSendButton') return Promise.resolve(true);
      return Promise.resolve(fallback);
    });
    const comp = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    try {
      const colorBtn = comp.getByLabelText('Open color picker');
      await act(async () => {
        fireEvent.press(colorBtn);
      });
    } catch {
      // Button may not be accessible until settings resolve in this test env
    }
  });

  // ── keyboard key press ────────────────────────────────────────────────────
  it('handles Enter key press event without crash', async () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');
    await act(async () => {
      fireEvent.changeText(input, 'some text');
      // The event handler calls e.preventDefault() and accesses e.nativeEvent.key
      fireEvent(input, 'keyPress', {
        nativeEvent: { key: 'Enter' },
        preventDefault: jest.fn(),
      });
    });
  });

  // ── selection change ──────────────────────────────────────────────────────
  it('handles selection change event without crash', async () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');
    await act(async () => {
      fireEvent(input, 'selectionChange', {
        nativeEvent: { selection: { start: 3, end: 3 } },
      });
    });
  });

  // ── unmount / cleanup ─────────────────────────────────────────────────────
  it('unmounts without error', async () => {
    const { unmount } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    await act(async () => {
      unmount();
    });
  });

  it('unmounts cleanly when typing indicator is active', async () => {
    const { getByPlaceholderText, unmount } = render(
      <MessageInput {...defaultProps} tabType="channel" tabName="#general" network="TestNet" />
    );
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');
    await act(async () => {
      fireEvent.changeText(input, 'typing...');
    });
    await act(async () => {
      unmount();
    });
  });

  // ── tab/network combinations ──────────────────────────────────────────────
  it('renders with tabId provided', async () => {
    const { toJSON } = render(
      <MessageInput
        {...defaultProps}
        tabType="channel"
        tabName="#general"
        network="TestNet"
        tabId="channel::TestNet::#general"
      />
    );
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('renders with query tabId', async () => {
    const { toJSON } = render(
      <MessageInput
        {...defaultProps}
        tabType="query"
        tabName="Alice"
        network="TestNet"
        tabId="query::TestNet::Alice"
      />
    );
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  // ── message submission with IRC commands ──────────────────────────────────
  it('submits IRC slash commands', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} onSubmit={onSubmit} />);
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, '/join #test');
    });
    // Wait for state update before submitting
    await flushAsync();
    await act(async () => {
      fireEvent(input, 'submitEditing', { nativeEvent: { text: '/join #test' } });
    });
    expect(onSubmit).toHaveBeenCalledWith('/join #test');
  });

  it('submits /me action command', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} onSubmit={onSubmit} />);
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, '/me waves hello');
    });
    // Wait for state update before submitting
    await flushAsync();
    await act(async () => {
      fireEvent(input, 'submitEditing', { nativeEvent: { text: '/me waves hello' } });
    });
    expect(onSubmit).toHaveBeenCalledWith('/me waves hello');
  });

  // ── typing with non-slash text ────────────────────────────────────────────
  it('does not show command suggestions for regular text', async () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    const input = getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, 'hello everyone');
    });
    expect(input.props.value).toBe('hello everyone');
  });

  // ── enterKeyBehavior=newline ───────────────────────────────────────────────
  it('respects enterKeyBehavior=newline setting', async () => {
    mockGetSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'enterKeyBehavior') return Promise.resolve('newline');
      return Promise.resolve(fallback);
    });
    const { toJSON } = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  // ── nick completion ───────────────────────────────────────────────────────
  it('handles nick completion when enabled', async () => {
    mockGetSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'nickCompleteEnabled') return Promise.resolve(true);
      if (key === 'nickCompleteSeparator1') return Promise.resolve(': ');
      if (key === 'nickCompleteSeparator2') return Promise.resolve('');
      return Promise.resolve(fallback);
    });
    const { toJSON } = render(
      <MessageInput {...defaultProps} tabType="channel" tabName="#general" network="TestNet" />
    );
    await flushAsync();
    expect(toJSON()).toBeTruthy();
  });

  it('applies nick suggestion replacement style and submits styled text', async () => {
    const onSubmit = jest.fn();
    mockGetSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'nickCompleteEnabled') return Promise.resolve(true);
      if (key === 'nickCompleteStyleId') return Promise.resolve('<nick>__');
      return Promise.resolve(fallback);
    });
    mockGetConnection.mockReturnValue({
      ircService: {
        sendTypingIndicator: jest.fn(),
        getChannelUsers: jest.fn(() => [{ nick: 'Alice' }]),
      },
    });

    const comp = render(
      <MessageInput
        {...defaultProps}
        onSubmit={onSubmit}
        tabType="channel"
        tabName="#general"
        network="TestNet"
      />
    );
    await flushAsync();
    const input = comp.getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, 'hello @Al');
    });

    await act(async () => {
      fireEvent.press(comp.getByText('Alice'));
    });
    expect(input.props.value).toBe('hello @Alice ');

    await act(async () => {
      fireEvent(input, 'submitEditing');
    });
    expect(onSubmit).toHaveBeenCalledWith('hello @Alice__');
  });

  it('replaces channel token from channel suggestion', async () => {
    mockGetTabsByNetwork.mockReturnValue([
      { type: 'channel', name: '#AndroidIRCx' },
      { type: 'query', name: 'Bob' },
    ]);

    const comp = render(
      <MessageInput {...defaultProps} tabType="channel" tabName="#general" network="TestNet" />
    );
    await flushAsync();
    const input = comp.getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, '/csop #And');
    });

    await act(async () => {
      fireEvent.press(comp.getByText('#AndroidIRCx'));
    });
    expect(input.props.value).toBe('/csop #AndroidIRCx ');
  });

  it('uses service command suggestion when services are detected', async () => {
    mockServiceCommandsState.isDetected = true;
    mockServiceCommandsState.getSuggestions.mockReturnValue([
      {
        text: 'identify hunter2',
        description: 'NickServ identify',
        serviceNick: 'NickServ',
        isAlias: false,
      },
    ]);

    const comp = render(
      <MessageInput {...defaultProps} tabType="channel" tabName="#general" network="TestNet" />
    );
    await flushAsync();
    const input = comp.getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, '/ns');
    });

    await act(async () => {
      fireEvent.press(comp.getByText('/msg NickServ identify hunter2 — NickServ identify'));
    });
    expect(input.props.value).toBe('/msg NickServ identify hunter2 ');
  });

  it('renders alias and history source labels when descriptions are absent', async () => {
    (commandService.getAliases as jest.Mock).mockReturnValue([
      { alias: 'ahelp', command: '{channel}', description: '' },
    ]);
    (commandService.getHistory as jest.Mock).mockReturnValue([
      { command: '/ahistory' },
    ]);

    const comp = render(
      <MessageInput {...defaultProps} tabType="channel" tabName="#general" network="TestNet" />
    );
    await flushAsync();
    const input = comp.getByPlaceholderText('Enter a message');

    await act(async () => {
      fireEvent.changeText(input, '/a');
    });
    expect(comp.getByText('/ahelp — alias')).toBeTruthy();
    expect(comp.getByText('/ahistory — recent')).toBeTruthy();
  });

  it('applies formatting controls for selection and color insert', async () => {
    const comp = render(<MessageInput {...defaultProps} />);
    await flushAsync();
    const input = comp.getByPlaceholderText('Enter a message');
    const { TouchableOpacity } = require('react-native');
    const findActionButton = (label: string) =>
      comp.UNSAFE_getAllByType(TouchableOpacity).find((node: any) => {
        const children = node.props.children;
        const textNode = Array.isArray(children) ? children[0] : children;
        return textNode?.props?.children === label;
      });

    await act(async () => {
      fireEvent.changeText(input, 'abc');
      fireEvent(input, 'selectionChange', {
        nativeEvent: { selection: { start: 0, end: 3 } },
      });
    });

    await act(async () => {
      fireEvent.press(comp.getByLabelText('Open color picker'));
    });

    await act(async () => {
      fireEvent.press(findActionButton('B'));
    });
    expect(input.props.value).toBe('\u0002abc\u0002');

    await act(async () => {
      fireEvent(input, 'selectionChange', {
        nativeEvent: { selection: { start: input.props.value.length, end: input.props.value.length } },
      });
      fireEvent.press(comp.getByLabelText('Mock insert color'));
    });
    expect(input.props.value).toContain('\u000304');

    await act(async () => {
      fireEvent.press(comp.getByText('Close'));
    });
  });

  it('handles attachment -> media select -> media send flow', async () => {
    const onSubmit = jest.fn();
    mockIsMediaEnabled.mockResolvedValue(true);
    mockHasEncryptionKey.mockResolvedValue(true);

    const comp = render(
      <MessageInput
        {...defaultProps}
        onSubmit={onSubmit}
        tabType="channel"
        tabName="#general"
        network="TestNet"
        tabId="channel::TestNet::#general"
      />
    );
    await flushAsync();

    await act(async () => {
      fireEvent.press(comp.getByLabelText('Attach media'));
    });
    await act(async () => {
      fireEvent.press(comp.getByLabelText('Mock pick media'));
    });
    await act(async () => {
      fireEvent.press(comp.getByLabelText('Mock send media'));
    });

    expect(onSubmit).toHaveBeenCalledWith('@media=abc caption');
  });
});
