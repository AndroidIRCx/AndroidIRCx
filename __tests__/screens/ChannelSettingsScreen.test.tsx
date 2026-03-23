/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockChannelInfo = {
  topic: 'Current topic',
  topicSetBy: 'chanop',
  topicSetAt: new Date('2026-03-01T10:00:00Z').getTime(),
  modes: {
    inviteOnly: true,
    topicProtected: false,
    noExternalMessages: true,
    moderated: false,
    private: false,
    secret: true,
    key: 'secret',
    limit: 42,
    banList: ['*!*@banned.host'],
    exceptionList: ['*!*@friend.host'],
    inviteList: ['*!*@invite.host'],
  },
};

const mockChannelManagementService = {
  getChannelInfo: jest.fn(),
  getModeString: jest.fn(),
  requestBanList: jest.fn(),
  requestExceptionList: jest.fn(),
  requestInviteList: jest.fn(),
  onChannelInfoChange: jest.fn(),
  setTopic: jest.fn(),
  setKey: jest.fn(),
  removeKey: jest.fn(),
  setLimit: jest.fn(),
  removeLimit: jest.fn(),
  addBan: jest.fn(),
  removeBan: jest.fn(),
  addException: jest.fn(),
  removeException: jest.fn(),
  addInvite: jest.fn(),
  removeInvite: jest.fn(),
  setChannelMode: jest.fn(),
};

const mockIrcService = {
  sendCommand: jest.fn(),
};

const mockSettingsService = {
  getSetting: jest.fn(),
  setSetting: jest.fn(),
};

const mockChannelEncryptionService = {
  hasChannelKey: jest.fn(),
};

const mockChannelEncryptionSettingsService = {
  getAlwaysEncrypt: jest.fn(),
  setAlwaysEncrypt: jest.fn(),
};

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: jest.fn(() => ({
      channelManagementService: mockChannelManagementService,
      ircService: mockIrcService,
    })),
  },
}));

jest.mock('../../src/services/ChannelEncryptionService', () => ({
  channelEncryptionService: mockChannelEncryptionService,
}));

jest.mock('../../src/services/ChannelEncryptionSettingsService', () => ({
  channelEncryptionSettingsService: mockChannelEncryptionSettingsService,
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: mockSettingsService,
}));

jest.mock('../../src/utils/modeDescriptions', () => ({
  getChannelModeDescription: jest.fn(() => ({ description: 'mode description' })),
}));

jest.mock('../../src/utils/IRCFormatter', () => ({
  formatIRCTextAsComponent: jest.fn((value: string) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{value}</Text>;
  }),
  stripIRCFormatting: jest.fn((value: string) => value),
}));

jest.mock('../../src/utils/EncodingUtils', () => ({
  repairMojibake: jest.fn((value: string) => value),
}));

jest.mock('../../src/components/ColorPickerModal', () => ({
  ColorPickerModal: ({ visible, onInsert, onClose }: any) => {
    if (!visible) {
      return null;
    }
    const React = require('react');
    const { Text } = require('react-native');
    return (
      <>
        <Text onPress={() => onInsert('\u000304')}>Insert Color</Text>
        <Text onPress={onClose}>Close Color Picker</Text>
      </>
    );
  },
}));

const { ChannelSettingsScreen } = require('../../src/screens/ChannelSettingsScreen');

describe('ChannelSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(Alert, 'prompt').mockImplementation((_: any, __: any, buttons?: any) => {
      buttons?.[1]?.onPress?.('targetNick');
    });
    mockChannelManagementService.getChannelInfo.mockReturnValue(mockChannelInfo);
    mockChannelManagementService.getModeString.mockReturnValue('+insk secret 42');
    mockChannelManagementService.onChannelInfoChange.mockReturnValue(jest.fn());
    mockSettingsService.getSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'topicStyleId') return Promise.resolve('** <TOPIC>');
      if (key === 'topicStyles') return Promise.resolve(['** <TOPIC>', '~~ <TOPIC>']);
      return Promise.resolve(fallback);
    });
    mockSettingsService.setSetting.mockResolvedValue(undefined);
    mockChannelEncryptionSettingsService.getAlwaysEncrypt.mockResolvedValue(false);
    mockChannelEncryptionSettingsService.setAlwaysEncrypt.mockResolvedValue(undefined);
    mockChannelEncryptionService.hasChannelKey.mockResolvedValue(true);
  });

  it('loads settings, applies topic style, and handles list management actions', async () => {
    const { findByDisplayValue, findByPlaceholderText, findAllByText, getByText } =
      render(
      <ChannelSettingsScreen channel="#chat" network="net1" visible onClose={jest.fn()} />
      );

    expect(await findByDisplayValue('Current topic')).toBeTruthy();

    await waitFor(() => {
      expect(mockIrcService.sendCommand).toHaveBeenCalledWith('MODE #chat');
      expect(mockIrcService.sendCommand).toHaveBeenCalledWith('TOPIC #chat');
      expect(mockChannelManagementService.requestBanList).toHaveBeenCalledWith('#chat');
      expect(mockChannelManagementService.requestExceptionList).toHaveBeenCalledWith('#chat');
      expect(mockChannelManagementService.requestInviteList).toHaveBeenCalledWith('#chat');
    });

    fireEvent.changeText(await findByDisplayValue('Current topic'), 'Updated topic');
    fireEvent.press(getByText('Set Topic'));
    expect(mockChannelManagementService.setTopic).toHaveBeenCalledWith('#chat', '** Updated topic');
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Topic updated');

    fireEvent.press(getByText('Refresh'));
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('MODE #chat');

    fireEvent.changeText(
      await findByPlaceholderText('Channel key (leave empty to remove)'),
      'new-key'
    );
    fireEvent.press(getByText('Set Key'));
    expect(mockChannelManagementService.setKey).toHaveBeenCalledWith('#chat', 'new-key');
    fireEvent.press((await findAllByText('Remove Key'))[0]);
    expect(mockChannelManagementService.removeKey).toHaveBeenCalledWith('#chat');

    fireEvent.changeText(
      await findByPlaceholderText('Maximum users (leave empty to remove)'),
      '50'
    );
    fireEvent.press(getByText('Set Limit'));
    expect(mockChannelManagementService.setLimit).toHaveBeenCalledWith('#chat', 50);
    fireEvent.changeText(
      await findByPlaceholderText('Maximum users (leave empty to remove)'),
      ''
    );
    fireEvent.press(getByText('Remove Limit'));
    expect(mockChannelManagementService.removeLimit).toHaveBeenCalledWith('#chat');
    fireEvent.changeText(
      await findByPlaceholderText('Maximum users (leave empty to remove)'),
      'abc'
    );
    fireEvent.press(getByText('Set Limit'));
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid limit value');

    fireEvent.changeText(
      await findByPlaceholderText('Ban mask (e.g., *!*@host.com)'),
      '*!*@new.host'
    );
    fireEvent.press((await findAllByText('Add'))[0]);
    expect(mockChannelManagementService.addBan).toHaveBeenCalledWith('#chat', '*!*@new.host');
    fireEvent.changeText(await findByPlaceholderText('Ban mask (e.g., *!*@host.com)'), '   ');
    fireEvent.press((await findAllByText('Add'))[0]);
    expect(mockChannelManagementService.addBan).toHaveBeenCalledTimes(1);

    fireEvent.press((await findAllByText('Remove'))[0]);
    expect(mockChannelManagementService.removeBan).toHaveBeenCalledWith('#chat', '*!*@banned.host');

    fireEvent.changeText(await findByPlaceholderText('Exception mask'), '*!*@safe.host');
    fireEvent.press((await findAllByText('Add'))[1]);
    expect(mockChannelManagementService.addException).toHaveBeenCalledWith('#chat', '*!*@safe.host');
    fireEvent.changeText(await findByPlaceholderText('Exception mask'), '   ');
    fireEvent.press((await findAllByText('Add'))[1]);
    expect(mockChannelManagementService.addException).toHaveBeenCalledTimes(1);

    fireEvent.changeText(
      await findByPlaceholderText('Invite mask (e.g., *!*@trusted.host)'),
      '*!*@invite2.host'
    );
    fireEvent.press((await findAllByText('Add'))[2]);
    expect(mockChannelManagementService.addInvite).toHaveBeenCalledWith('#chat', '*!*@invite2.host');
    fireEvent.changeText(
      await findByPlaceholderText('Invite mask (e.g., *!*@trusted.host)'),
      '   '
    );
    fireEvent.press((await findAllByText('Add'))[2]);
    expect(mockChannelManagementService.addInvite).toHaveBeenCalledTimes(1);
  });

  it('manages topic styles and encryption actions', async () => {
    mockChannelEncryptionService.hasChannelKey.mockResolvedValue(false);
    const { findByText, findAllByText, findByPlaceholderText, getByText } = render(
      <ChannelSettingsScreen channel="#chat" network="net1" visible onClose={jest.fn()} />
    );

    await findByText('Manage Topic Styles');
    fireEvent.press(getByText('Manage Topic Styles'));
    fireEvent.press(await findByText('Add style'));
    fireEvent.changeText(await findByPlaceholderText('Use <TOPIC>'), '## <TOPIC>');
    fireEvent.press(getByText('Colors'));
    fireEvent.press(await findByText('Insert Color'));
    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(mockSettingsService.setSetting).toHaveBeenCalledWith(
        'topicStyles',
        expect.arrayContaining(['## <TOPIC>\u000304'])
      );
    });
    fireEvent.press(getByText('Manage Topic Styles'));
    fireEvent.press((await findAllByText('Edit'))[0]);
    fireEvent.changeText(await findByPlaceholderText('Use <TOPIC>'), 'edited <TOPIC>');
    fireEvent.press(getByText('Save'));
    await waitFor(() => {
      expect(mockSettingsService.setSetting).toHaveBeenCalledWith(
        'topicStyles',
        expect.arrayContaining(['edited <TOPIC>'])
      );
    });
    fireEvent.press((await findAllByText('Remove'))[0]);
    await waitFor(() => {
      expect(mockSettingsService.setSetting).toHaveBeenLastCalledWith(
        'topicStyles',
        expect.arrayContaining(['~~ <TOPIC>', '## <TOPIC>\u000304'])
      );
    });
    fireEvent.press(getByText('Select Topic Style'));
    fireEvent.press(getByText('Clear'));
    await waitFor(() => {
      expect(mockSettingsService.setSetting).toHaveBeenCalledWith('topicStyleId', '');
    });

    fireEvent.press(getByText('Generate Key'));
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('/chankey generate');

    fireEvent.press(getByText('Request Key from...'));
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('/chankey request targetNick');

    mockChannelEncryptionService.hasChannelKey.mockResolvedValue(true);
    const secondRender = render(
      <ChannelSettingsScreen channel="#chat" network="net1" visible onClose={jest.fn()} />
    );
    fireEvent.press(await secondRender.findByText('Share Key with...'));
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('/chankey share targetNick');

    fireEvent.press((await secondRender.findAllByText('Remove Key')).at(-1) as any);
    const removeButtons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    await act(async () => {
      await removeButtons?.[1]?.onPress?.();
    });
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('/chankey remove');
  });

  it('shows empty-style and mode toggle branches', async () => {
    mockSettingsService.getSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'topicStyleId') return Promise.resolve('');
      if (key === 'topicStyles') return Promise.resolve([]);
      return Promise.resolve(fallback);
    });
    mockChannelEncryptionService.hasChannelKey.mockResolvedValue(false);

    const { findAllByRole, findByText, getByText } = render(
      <ChannelSettingsScreen channel="#chat" network="net1" visible onClose={jest.fn()} />
    );

    fireEvent.press(getByText('Select Topic Style'));
    expect(Alert.alert).toHaveBeenCalledWith('No styles', 'Add topic styles first.');

    const switches = await findAllByRole('switch');
    expect(switches).toHaveLength(7);

    fireEvent(switches[0], 'valueChange', false);
    fireEvent(switches[1], 'valueChange', true);
    fireEvent(switches[6], 'valueChange', true);

    await waitFor(() => {
      expect(mockChannelManagementService.setChannelMode).toHaveBeenCalledWith('#chat', '-i', undefined);
      expect(mockChannelManagementService.setChannelMode).toHaveBeenCalledWith('#chat', '+t', undefined);
      expect(mockChannelEncryptionSettingsService.setAlwaysEncrypt).toHaveBeenCalledWith(
        '#chat',
        'net1',
        true
      );
      expect(Alert.alert).toHaveBeenCalledWith(
        'No Encryption Key',
        'Always-encrypt is now enabled, but no encryption key exists. Generate or request a key to enable encryption.',
        [{ text: 'OK' }]
      );
    });

    await findByText('⚠ No encryption key');
  });
});
