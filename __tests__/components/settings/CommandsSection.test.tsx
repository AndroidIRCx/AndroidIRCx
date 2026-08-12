/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for CommandsSection component
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { CommandsSection } from '../../../src/components/settings/sections/CommandsSection';

const mockCapturedItems = new Map<string, any>();

const mockGetAliases = jest.fn(() => [] as any[]);
const mockGetCustomCommands = jest.fn(() => [] as any[]);
const mockGetHistory = jest.fn(() => [] as any[]);
const mockAddAlias = jest.fn(async () => undefined);
const mockAddCustomCommand = jest.fn(async () => undefined);
const mockRemoveAlias = jest.fn(async () => undefined);
const mockRemoveCustomCommand = jest.fn(async () => undefined);
const mockDeleteHistoryEntry = jest.fn(async () => undefined);
const mockClearHistory = jest.fn(async () => undefined);

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../../src/components/settings/SettingItem', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    SettingItem: ({ item, onPress }: any) => {
      mockCapturedItems.set(item.id, item);
      return React.createElement(
        TouchableOpacity,
        {
          testID: `setting-${item.id}`,
          onPress: () => {
            item.onPress?.();
            if (item.type === 'submenu') onPress?.(item.id);
          },
        },
        React.createElement(Text, null, item.title || item.id),
      );
    },
  };
});

jest.mock('../../../src/services/CommandService', () => ({
  commandService: {
    getAliases: (...args: any[]) => mockGetAliases(...args),
    getCustomCommands: (...args: any[]) => mockGetCustomCommands(...args),
    getHistory: (...args: any[]) => mockGetHistory(...args),
    addAlias: (...args: any[]) => mockAddAlias(...args),
    removeAlias: (...args: any[]) => mockRemoveAlias(...args),
    addCustomCommand: (...args: any[]) => mockAddCustomCommand(...args),
    removeCustomCommand: (...args: any[]) => mockRemoveCustomCommand(...args),
    deleteHistoryEntry: (...args: any[]) => mockDeleteHistoryEntry(...args),
    clearHistory: (...args: any[]) => mockClearHistory(...args),
  },
}));

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
  input: {},
  disabledInput: {},
  submenuOverlay: {},
  submenuContainer: {},
  submenuHeader: {},
  submenuTitle: {},
  submenuItem: {},
  submenuItemContent: {},
  submenuItemText: {},
  submenuItemDescription: {},
  submenuInput: {},
  closeButtonText: {},
};

const mockSettingIcons = {};

describe('CommandsSection', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
    mockGetAliases.mockReturnValue([]);
    mockGetCustomCommands.mockReturnValue([]);
    mockGetHistory.mockReturnValue([]);
  });

  it('should render command history section', async () => {
    const { getByText } = await render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles as any}
        settingIcons={mockSettingIcons}
      />,
    );

    expect(getByText(/Command History/i)).toBeTruthy();
  });

  it('should render command aliases section', async () => {
    const { getByText } = await render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles as any}
        settingIcons={mockSettingIcons}
      />,
    );

    expect(getByText(/Command Aliases/i)).toBeTruthy();
  });

  it('should render custom commands section', async () => {
    const { getByText } = await render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles as any}
        settingIcons={mockSettingIcons}
      />,
    );

    expect(getByText(/Custom Commands/i)).toBeTruthy();
  });

  it('should display command history entries', async () => {
    const mockHistory = [
      {
        id: '1',
        command: '/join #test',
        timestamp: Date.now(),
        channel: '#test',
      },
    ];
    mockGetHistory.mockReturnValue(mockHistory);

    await render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles as any}
        settingIcons={mockSettingIcons}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('commands-history')).toBe(true),
    );

    const historyEntry = mockCapturedItems
      .get('commands-history')
      .submenuItems.find((x: any) => x.id === 'history-1');
    expect(historyEntry).toBeTruthy();
    expect(historyEntry.title).toBe('/join #test');
  });

  it('should display command aliases', async () => {
    const mockAliases = [
      {
        alias: 'j',
        command: '/join {channel}',
        description: 'Join channel',
      },
    ];
    mockGetAliases.mockReturnValue(mockAliases);

    await render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles as any}
        settingIcons={mockSettingIcons}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('commands-aliases')).toBe(true),
    );

    const aliasEntry = mockCapturedItems
      .get('commands-aliases')
      .submenuItems.find((x: any) => x.id === 'alias-j');
    expect(aliasEntry).toBeTruthy();
    expect(aliasEntry.title).toBe('/j');
  });

  it('should display custom commands', async () => {
    const mockCommands = [
      {
        name: 'greet',
        command: '/msg {channel} Hello',
        description: 'Greet channel',
        parameters: ['channel'],
      },
    ];
    mockGetCustomCommands.mockReturnValue(mockCommands);

    await render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles as any}
        settingIcons={mockSettingIcons}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('commands-custom')).toBe(true),
    );

    const cmdEntry = mockCapturedItems
      .get('commands-custom')
      .submenuItems.find((x: any) => x.id === 'cmd-greet');
    expect(cmdEntry).toBeTruthy();
    expect(cmdEntry.title).toBe('/greet');
  });
});

describe('CommandsSection submenu interactions', () => {
  const renderSection = async () =>
    render(
      <CommandsSection
        colors={mockColors}
        styles={mockStyles as any}
        settingIcons={mockSettingIcons}
      />,
    );

  const openSubmenu = async (utils: any, id: string) => {
    await act(async () => {
      fireEvent.press(utils.getByTestId(`setting-${id}`));
    });
  };

  const lastAlertButtons = (): any[] => {
    const calls = (Alert.alert as jest.Mock).mock.calls;
    return calls[calls.length - 1][2] as any[];
  };

  const pressAlertButton = async (label: string) => {
    const btn = lastAlertButtons().find((b: any) => b.text === label);
    await act(async () => {
      await btn.onPress?.();
    });
  };

  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockGetAliases.mockReturnValue([]);
    mockGetCustomCommands.mockReturnValue([]);
    mockGetHistory.mockReturnValue([]);
  });

  it('opens the aliases submenu and adds a new alias', async () => {
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-aliases');

    await act(async () => {
      fireEvent.changeText(utils.getByPlaceholderText('e.g. j'), '/j');
    });
    await act(async () => {
      fireEvent.changeText(
        utils.getByPlaceholderText('e.g. /join {channel}'),
        '/join {channel}',
      );
    });

    await act(async () => {
      await fireEvent.press(utils.getByText('Add Alias'));
    });

    expect(mockAddAlias).toHaveBeenCalledWith({
      alias: 'j',
      command: '/join {channel}',
      description: '',
    });
  });

  it('shows an error when adding an alias with missing fields', async () => {
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-aliases');

    await act(async () => {
      await fireEvent.press(utils.getByText('Add Alias'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Alias name and command are required',
    );
    expect(mockAddAlias).not.toHaveBeenCalled();
  });

  it('deletes an alias from its detail alert', async () => {
    mockGetAliases.mockReturnValue([
      { alias: 'j', command: '/join {channel}', description: 'Join channel' },
    ]);
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-aliases');

    await act(async () => {
      await fireEvent.press(utils.getByText('/j'));
    });
    expect(Alert.alert).toHaveBeenCalled();

    await pressAlertButton('Delete');
    expect(mockRemoveAlias).toHaveBeenCalledWith('j');
  });

  it('renders an alias without a description', async () => {
    mockGetAliases.mockReturnValue([
      { alias: 'k', command: '/kick', description: '' },
    ]);
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-aliases');

    await act(async () => {
      await fireEvent.press(utils.getByText('/k'));
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Alias: /k',
      expect.stringContaining('No description'),
      expect.anything(),
    );
  });

  it('opens the custom commands submenu and adds a templated command', async () => {
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-custom');

    await act(async () => {
      fireEvent.changeText(utils.getByPlaceholderText('e.g. greet'), 'greet');
    });
    await act(async () => {
      fireEvent.changeText(
        utils.getByPlaceholderText('e.g. /msg {channel} Hello {param1}'),
        '/msg {channel} Hello {param1}',
      );
    });

    await act(async () => {
      await fireEvent.press(utils.getByText('Add Custom Command'));
    });

    expect(mockAddCustomCommand).toHaveBeenCalledWith({
      name: 'greet',
      command: '/msg {channel} Hello {param1}',
      description: '',
      parameters: ['channel', 'param1'],
    });
  });

  it('adds a custom command without placeholders', async () => {
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-custom');

    await act(async () => {
      fireEvent.changeText(utils.getByPlaceholderText('e.g. greet'), 'ping');
    });
    await act(async () => {
      fireEvent.changeText(
        utils.getByPlaceholderText('e.g. /msg {channel} Hello {param1}'),
        '/ping',
      );
    });

    await act(async () => {
      await fireEvent.press(utils.getByText('Add Custom Command'));
    });

    expect(mockAddCustomCommand).toHaveBeenCalledWith({
      name: 'ping',
      command: '/ping',
      description: '',
      parameters: undefined,
    });
  });

  it('shows an error when adding a custom command with missing fields', async () => {
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-custom');

    await act(async () => {
      await fireEvent.press(utils.getByText('Add Custom Command'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Command name and template are required',
    );
    expect(mockAddCustomCommand).not.toHaveBeenCalled();
  });

  it('deletes a custom command from its detail alert', async () => {
    mockGetCustomCommands.mockReturnValue([
      {
        name: 'greet',
        command: '/msg {channel} Hello',
        description: 'Greet',
        parameters: ['channel'],
      },
    ]);
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-custom');

    await act(async () => {
      await fireEvent.press(utils.getByText('/greet'));
    });
    expect(Alert.alert).toHaveBeenCalled();

    await pressAlertButton('Delete');
    expect(mockRemoveCustomCommand).toHaveBeenCalledWith('greet');
  });

  it('renders a custom command without description or parameters', async () => {
    mockGetCustomCommands.mockReturnValue([
      {
        name: 'bare',
        command: '/bare',
        description: '',
        parameters: undefined,
      },
    ]);
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-custom');

    await act(async () => {
      await fireEvent.press(utils.getByText('/bare'));
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Custom Command: /bare',
      expect.stringContaining('None'),
      expect.anything(),
    );
  });

  it('deletes a single history entry', async () => {
    mockGetHistory.mockReturnValue([
      {
        id: '1',
        command: '/join #test',
        timestamp: Date.now(),
        channel: '#test',
      },
    ]);
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-history');

    await act(async () => {
      await fireEvent.press(utils.getByText('/join #test'));
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Entry',
      expect.stringContaining('/join #test'),
      expect.anything(),
    );

    await pressAlertButton('Delete');
    expect(mockDeleteHistoryEntry).toHaveBeenCalledWith('1');
  });

  it('renders a history entry without a channel', async () => {
    mockGetHistory.mockReturnValue([
      { id: '2', command: '/quit', timestamp: Date.now() },
    ]);
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-history');

    expect(utils.getByText('/quit')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(utils.getByText('/quit'));
    });
    await pressAlertButton('Delete');
    expect(mockDeleteHistoryEntry).toHaveBeenCalledWith('2');
  });

  it('clears all history', async () => {
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-history');

    await act(async () => {
      await fireEvent.press(utils.getByText('Clear All History'));
    });
    expect(Alert.alert).toHaveBeenCalled();

    await pressAlertButton('Delete All');
    expect(mockClearHistory).toHaveBeenCalled();
  });

  it('closes the submenu with the Close button', async () => {
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-aliases');

    expect(utils.getByPlaceholderText('e.g. j')).toBeTruthy();

    await act(async () => {
      fireEvent.press(utils.getByText('Close'));
    });

    expect(utils.queryByPlaceholderText('e.g. j')).toBeNull();
  });

  it('closes the submenu on the modal request-close (back button)', async () => {
    const { Modal } = require('react-native');
    const utils = await renderSection();
    await openSubmenu(utils, 'commands-aliases');

    expect(utils.getByPlaceholderText('e.g. j')).toBeTruthy();

    const modal = utils.UNSAFE_getByType(Modal);
    await act(async () => {
      fireEvent(modal, 'requestClose');
    });

    expect(utils.queryByPlaceholderText('e.g. j')).toBeNull();
  });
});
