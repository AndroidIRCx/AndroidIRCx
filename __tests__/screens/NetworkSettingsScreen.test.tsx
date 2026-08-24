/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert, Switch } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NetworkSettingsScreen } from '../../src/screens/NetworkSettingsScreen';

// useT must return a STABLE function reference: the screen's loadNetwork is a
// useCallback keyed on `t`, and its load effect depends on loadNetwork. A fresh
// `t` per render would recreate loadNetwork every render and re-fire the effect
// forever (infinite loading loop) whenever a networkId is provided.
jest.mock('../../src/i18n/transifex', () => {
  const t = (key: string) => key;
  return { useT: () => t };
});

// createStyles(colors) reads many theme color keys; a Proxy returns a valid
// color string for any key so the huge style sheet never hits an undefined
// color (the real useTheme returns no colors in the test environment).
jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: jest.fn(() => ({
    colors: new Proxy(
      {},
      {
        get: () => '#123456',
      },
    ),
    theme: 'dark',
    setTheme: jest.fn(),
  })),
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getNetwork: jest.fn(),
  },
}));

jest.mock('../../src/services/CertificateManagerService', () => ({
  certificateManager: {
    extractFingerprintFromPem: jest.fn(),
  },
}));

jest.mock('../../src/components/modals/CertificateGeneratorModal', () => ({
  CertificateGeneratorModal: ({ visible, onCertificateGenerated }: any) => {
    const { Text } = require('react-native');
    return visible ? (
      <>
        <Text>Mock Certificate Generator</Text>
        <Text
          onPress={() =>
            onCertificateGenerated({
              pemCert: 'generated-cert',
              pemKey: 'generated-key',
            })
          }
        >
          Complete Certificate Generation
        </Text>
      </>
    ) : null;
  },
}));

jest.mock('../../src/components/modals/CertificateSelectorModal', () => ({
  CertificateSelectorModal: ({ visible, onSelect }: any) => {
    const { Text } = require('react-native');
    return visible ? (
      <>
        <Text>Mock Certificate Selector</Text>
        <Text
          onPress={() =>
            onSelect({
              pemCert: 'selected-cert',
              pemKey: 'selected-key',
            })
          }
        >
          Select Certificate
        </Text>
      </>
    ) : null;
  },
}));

jest.mock('../../src/components/modals/CertificateFingerprintModal', () => ({
  CertificateFingerprintModal: ({ visible, fingerprint }: any) => {
    const { Text } = require('react-native');
    return visible ? <Text>Fingerprint: {fingerprint}</Text> : null;
  },
}));

jest.mock('@react-native-picker/picker', () => {
  const ReactLib = require('react');
  return {
    Picker: Object.assign(
      ({ selectedValue, onValueChange, children }: any) => {
        const { Text } = require('react-native');
        // Only the SASL mechanism picker exposes the SCRAM quick-select buttons,
        // detected from its child items so other pickers (e.g. text encoding)
        // don't render duplicate "Select SCRAM-SHA-256" elements.
        const isSasl = ReactLib.Children.toArray(children).some(
          (child: any) =>
            typeof child?.props?.value === 'string' &&
            child.props.value.includes('SCRAM'),
        );
        return (
          <>
            <Text>Picker Value: {selectedValue}</Text>
            {isSasl && (
              <>
                <Text onPress={() => onValueChange('SCRAM-SHA-256')}>
                  Select SCRAM-SHA-256
                </Text>
                <Text onPress={() => onValueChange('SCRAM-SHA-256-PLUS')}>
                  Select SCRAM-SHA-256-PLUS
                </Text>
              </>
            )}
            {children}
          </>
        );
      },
      {
        Item: ({ label }: any) => {
          const { Text } = require('react-native');
          return <Text>{label}</Text>;
        },
      },
    ),
  };
});

const { settingsService } = require('../../src/services/SettingsService');
const {
  certificateManager,
} = require('../../src/services/CertificateManagerService');

describe('NetworkSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    settingsService.getNetwork.mockResolvedValue(null);
    certificateManager.extractFingerprintFromPem.mockReturnValue('AA:BB:CC');
  });

  it('renders default values for a new network', async () => {
    const { getByText, getByDisplayValue } = await render(
      <NetworkSettingsScreen onSave={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(getByText('Network Settings')).toBeTruthy();
    expect(getByDisplayValue('AndroidIRCX')).toBeTruthy();
    expect(getByDisplayValue('AndroidIRCX_')).toBeTruthy();
    expect(getByDisplayValue('AndroidIRCX User')).toBeTruthy();
    expect(getByDisplayValue('androidircx')).toBeTruthy();
  });

  it('loads an existing network with proxy, sasl and certificate', async () => {
    settingsService.getNetwork.mockResolvedValue({
      id: 'net-1',
      name: 'Freenode',
      nick: 'tester',
      altNick: 'tester_',
      realname: 'Real User',
      ident: 'ident',
      servers: [{ id: 'srv-1' }],
      autoJoinChannels: ['#a', '#b'],
      sasl: {
        account: 'acc',
        password: 'secret',
        mechanism: 'SCRAM-SHA-256',
      },
      clientCert: 'pem-cert',
      clientKey: 'pem-key',
      proxy: {
        enabled: true,
        type: 'socks5',
        host: '10.0.0.1',
        port: 1080,
        username: 'user',
        password: 'pass',
      },
    });

    const { findByDisplayValue, getByText } = await render(
      <NetworkSettingsScreen
        networkId="net-1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(await findByDisplayValue('Freenode')).toBeTruthy();
    expect(await findByDisplayValue('tester')).toBeTruthy();
    expect(await findByDisplayValue('#a, #b')).toBeTruthy();
    expect(await findByDisplayValue('10.0.0.1')).toBeTruthy();
    expect(await findByDisplayValue('1080')).toBeTruthy();
    expect(await findByDisplayValue('pem-cert')).toBeTruthy();
    // SCRAM-SHA-256 help text should be shown for that mechanism
    expect(getByText(/challenge-response authentication/)).toBeTruthy();
    // View Fingerprint appears when a client cert is present
    expect(getByText(/View Fingerprint/)).toBeTruthy();
  });

  it('loads an existing tor proxy network filling default host/port', async () => {
    settingsService.getNetwork.mockResolvedValue({
      id: 'net-tor',
      name: 'TorNet',
      nick: 'nick',
      realname: 'Real',
      servers: [],
      proxy: {
        enabled: true,
        type: 'tor',
        // host/port omitted to exercise tor default fallbacks
      },
    });

    const { findByDisplayValue } = await render(
      <NetworkSettingsScreen
        networkId="net-tor"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(await findByDisplayValue('127.0.0.1')).toBeTruthy();
    expect(await findByDisplayValue('9050')).toBeTruthy();
  });

  it('loads existing websocket + webirc network and shows PLUS help text', async () => {
    settingsService.getNetwork.mockResolvedValue({
      id: 'net-ws',
      name: 'GatewayNet',
      nick: 'nick',
      realname: 'Real',
      servers: [],
      transport: 'websocket',
      webSocketUrl: 'wss://gateway.example.net/irc',
      webSocketSubprotocols: ['text.ircv3.net'],
      sasl: {
        account: 'acc',
        password: 'pwd',
        mechanism: 'SCRAM-SHA-256-PLUS',
      },
      webirc: {
        enabled: true,
        password: 'webirc-secret',
        gateway: 'gateway-name',
        hostname: 'client.example.net',
        ip: '203.0.113.10',
        options: ['secure', 'tls'],
      },
    });

    const { findByDisplayValue, getByText } = await render(
      <NetworkSettingsScreen
        networkId="net-ws"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(
      await findByDisplayValue('wss://gateway.example.net/irc'),
    ).toBeTruthy();
    expect(await findByDisplayValue('gateway-name')).toBeTruthy();
    expect(await findByDisplayValue('secure, tls')).toBeTruthy();
    expect(getByText(/channel binding will be available/)).toBeTruthy();
  });

  it('shows error and can retry when loading fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    settingsService.getNetwork.mockRejectedValueOnce(new Error('boom'));
    settingsService.getNetwork.mockResolvedValue({
      id: 'net-1',
      name: 'Recovered',
      nick: 'nick',
      realname: 'Real',
      servers: [],
    });

    const { findByText, findByDisplayValue } = await render(
      <NetworkSettingsScreen
        networkId="net-1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    const retryBtn = await findByText('Retry');
    expect(errorSpy).toHaveBeenCalledWith(
      'Error loading network:',
      expect.any(Error),
    );
    await fireEvent.press(retryBtn);
    expect(await findByDisplayValue('Recovered')).toBeTruthy();
    errorSpy.mockRestore();
  });

  it('shows "Network not found" when the network is missing', async () => {
    settingsService.getNetwork.mockResolvedValue(null);

    const { findByText } = await render(
      <NetworkSettingsScreen
        networkId="net-missing"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(await findByText('Network not found')).toBeTruthy();
  });

  it('validates required fields before saving', async () => {
    const onSave = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <NetworkSettingsScreen onSave={onSave} onCancel={jest.fn()} />,
    );

    // Clear the nick to make the form invalid (name is empty by default)
    await fireEvent.changeText(getByPlaceholderText('Your IRC nickname'), '');
    await fireEvent.press(getByText('Save'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please fill in all required fields (Name, Nick, Realname)',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('validates WEBIRC required fields when enabled', async () => {
    const onSave = jest.fn();
    const { getByText, getByPlaceholderText, UNSAFE_getAllByType } =
      await render(
        <NetworkSettingsScreen onSave={onSave} onCancel={jest.fn()} />,
      );

    await fireEvent.changeText(
      getByPlaceholderText('e.g., dbase.in.rs'),
      'Net',
    );

    // Third switch is the WEBIRC toggle (proxy, websocket, webirc)
    const switches = UNSAFE_getAllByType(Switch);
    await fireEvent(switches[2], 'valueChange', true);

    await fireEvent.press(getByText('Save'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'WEBIRC requires password, gateway, hostname, and IP before it can be enabled.',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a minimal new network (tcp transport, no proxy/sasl/webirc)', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByPlaceholderText } = await render(
      <NetworkSettingsScreen onSave={onSave} onCancel={jest.fn()} />,
    );

    await fireEvent.changeText(
      getByPlaceholderText('e.g., dbase.in.rs'),
      'Libera',
    );
    await fireEvent.changeText(
      getByPlaceholderText('Your IRC nickname'),
      'tester',
    );
    await fireEvent.changeText(
      getByPlaceholderText('Your real name or description'),
      'Tester Real',
    );
    // Clear altNick and ident to exercise the undefined branches
    await fireEvent.changeText(
      getByPlaceholderText('Fallback if primary nick is taken'),
      '',
    );
    await fireEvent.changeText(
      getByPlaceholderText('Username for ident (optional)'),
      '',
    );
    await fireEvent.changeText(
      getByPlaceholderText('#channel1, #channel2'),
      '#chat, #help',
    );

    await fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Libera',
          nick: 'tester',
          realname: 'Tester Real',
          altNick: undefined,
          ident: undefined,
          autoJoinChannels: ['#chat', '#help'],
          transport: 'tcp',
          proxy: undefined,
          sasl: undefined,
          webirc: undefined,
          webSocketUrl: undefined,
          webSocketSubprotocols: undefined,
        }),
      );
    });
  });

  it('saves proxy (socks5) and sasl configuration with picker change', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByPlaceholderText, UNSAFE_getAllByType } =
      await render(
        <NetworkSettingsScreen onSave={onSave} onCancel={jest.fn()} />,
      );

    await fireEvent.changeText(
      getByPlaceholderText('e.g., dbase.in.rs'),
      'ProxyNet',
    );
    await fireEvent.changeText(
      getByPlaceholderText('Your IRC nickname'),
      'nick',
    );
    await fireEvent.changeText(
      getByPlaceholderText('Your real name or description'),
      'Real',
    );

    const switches = UNSAFE_getAllByType(Switch);
    await fireEvent(switches[0], 'valueChange', true); // enable proxy

    await fireEvent.changeText(getByPlaceholderText('tor'), 'socks5');
    await fireEvent.changeText(
      getByPlaceholderText('127.0.0.1 (Tor default)'),
      '10.0.0.1',
    );
    await fireEvent.changeText(
      getByPlaceholderText('9050 for Tor, 1080 for SOCKS5'),
      '1080',
    );
    await fireEvent.changeText(
      getByPlaceholderText('SASL account name'),
      'acc',
    );
    await fireEvent.changeText(getByPlaceholderText('SASL password'), 'pwd');

    await fireEvent.press(getByText('Select SCRAM-SHA-256'));

    await fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: {
            enabled: true,
            type: 'socks5',
            host: '10.0.0.1',
            port: 1080,
            username: undefined,
            password: undefined,
          },
          sasl: {
            account: 'acc',
            password: 'pwd',
            mechanism: 'SCRAM-SHA-256',
          },
        }),
      );
    });
  });

  it('saves proxy with tor defaults when host/port left blank', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByPlaceholderText, UNSAFE_getAllByType } =
      await render(
        <NetworkSettingsScreen onSave={onSave} onCancel={jest.fn()} />,
      );

    await fireEvent.changeText(
      getByPlaceholderText('e.g., dbase.in.rs'),
      'TorNet',
    );
    await fireEvent.changeText(
      getByPlaceholderText('Your IRC nickname'),
      'nick',
    );
    await fireEvent.changeText(
      getByPlaceholderText('Your real name or description'),
      'Real',
    );

    const switches = UNSAFE_getAllByType(Switch);
    await fireEvent(switches[0], 'valueChange', true); // enable proxy

    // Clear host and port; type stays 'tor' -> defaults applied
    await fireEvent.changeText(
      getByPlaceholderText('127.0.0.1 (Tor default)'),
      '',
    );
    await fireEvent.changeText(
      getByPlaceholderText('9050 for Tor, 1080 for SOCKS5'),
      '',
    );

    await fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            type: 'tor',
            host: '127.0.0.1',
            port: 9050,
          }),
        }),
      );
    });
  });

  it('saves websocket + webirc with valid subprotocols', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByPlaceholderText, UNSAFE_getAllByType } =
      await render(
        <NetworkSettingsScreen onSave={onSave} onCancel={jest.fn()} />,
      );

    await fireEvent.changeText(
      getByPlaceholderText('e.g., dbase.in.rs'),
      'WSNet',
    );
    await fireEvent.changeText(
      getByPlaceholderText('Your IRC nickname'),
      'nick',
    );
    await fireEvent.changeText(
      getByPlaceholderText('Your real name or description'),
      'Real',
    );

    const switches = UNSAFE_getAllByType(Switch);
    await fireEvent(switches[1], 'valueChange', true); // enable websocket
    await fireEvent(switches[2], 'valueChange', true); // enable webirc

    await fireEvent.changeText(
      getByPlaceholderText('wss://irc.example.net:6697/'),
      'wss://irc.example.net/',
    );
    await fireEvent.changeText(
      getByPlaceholderText('shared WEBIRC password'),
      'secret',
    );
    await fireEvent.changeText(getByPlaceholderText('AndroidIRCX'), 'gw');
    await fireEvent.changeText(
      getByPlaceholderText('client.example.net'),
      'host',
    );
    await fireEvent.changeText(getByPlaceholderText('203.0.113.10'), '1.2.3.4');
    await fireEvent.changeText(
      getByPlaceholderText('secure, tls'),
      'secure, tls',
    );

    await fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: 'websocket',
          webSocketUrl: 'wss://irc.example.net/',
          webSocketSubprotocols: ['binary.ircv3.net', 'text.ircv3.net'],
          webirc: {
            enabled: true,
            password: 'secret',
            gateway: 'gw',
            hostname: 'host',
            ip: '1.2.3.4',
            options: ['secure', 'tls'],
          },
        }),
      );
    });
  });

  it('saves websocket with blank url and invalid subprotocols (undefined)', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByPlaceholderText, UNSAFE_getAllByType } =
      await render(
        <NetworkSettingsScreen onSave={onSave} onCancel={jest.fn()} />,
      );

    await fireEvent.changeText(
      getByPlaceholderText('e.g., dbase.in.rs'),
      'WSNet2',
    );
    await fireEvent.changeText(
      getByPlaceholderText('Your IRC nickname'),
      'nick',
    );
    await fireEvent.changeText(
      getByPlaceholderText('Your real name or description'),
      'Real',
    );

    const switches = UNSAFE_getAllByType(Switch);
    await fireEvent(switches[1], 'valueChange', true); // enable websocket

    // URL stays blank; replace default subprotocols with invalid values
    await fireEvent.changeText(
      getByPlaceholderText('binary.ircv3.net, text.ircv3.net'),
      'foo, bar',
    );

    await fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: 'websocket',
          webSocketUrl: undefined,
          webSocketSubprotocols: undefined,
        }),
      );
    });
  });

  it('fetches existing network servers on save when editing', async () => {
    settingsService.getNetwork.mockResolvedValue({
      id: 'net-edit',
      name: 'EditNet',
      nick: 'nick',
      realname: 'Real',
      servers: [{ id: 'srv-keep' }],
    });
    const onSave = jest.fn().mockResolvedValue(undefined);

    const { findByDisplayValue, getByText } = await render(
      <NetworkSettingsScreen
        networkId="net-edit"
        onSave={onSave}
        onCancel={jest.fn()}
      />,
    );

    await findByDisplayValue('EditNet');
    await fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'net-edit',
          servers: [{ id: 'srv-keep' }],
        }),
      );
    });
    // getNetwork called once on load, once on save
    expect(settingsService.getNetwork).toHaveBeenCalledTimes(2);
  });

  it('generates and selects a certificate', async () => {
    const { getByText, findByDisplayValue } = await render(
      <NetworkSettingsScreen onSave={jest.fn()} onCancel={jest.fn()} />,
    );

    await fireEvent.press(getByText(/Generate New/));
    await fireEvent.press(getByText('Complete Certificate Generation'));
    expect(await findByDisplayValue('generated-cert')).toBeTruthy();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      "Certificate generated and applied! Don't forget to add the fingerprint to NickServ.",
    );

    await fireEvent.press(getByText(/Select Existing/));
    await fireEvent.press(getByText('Select Certificate'));
    expect(await findByDisplayValue('selected-cert')).toBeTruthy();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Certificate applied to network configuration',
    );
  });

  it('shows the fingerprint modal when viewing a valid certificate', async () => {
    settingsService.getNetwork.mockResolvedValue({
      id: 'net-1',
      name: 'Freenode',
      nick: 'tester',
      realname: 'Real User',
      servers: [],
      clientCert: 'pem-cert',
      clientKey: 'pem-key',
    });

    const { findByText, getByText } = await render(
      <NetworkSettingsScreen
        networkId="net-1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText(/View Fingerprint/));
    expect(await findByText(/Fingerprint: AA:BB:CC/)).toBeTruthy();
    expect(certificateManager.extractFingerprintFromPem).toHaveBeenCalledWith(
      'pem-cert',
    );
    expect(getByText(/View Fingerprint/)).toBeTruthy();
  });

  it('alerts when viewing fingerprint of an invalid certificate', async () => {
    certificateManager.extractFingerprintFromPem.mockReturnValue(null);
    settingsService.getNetwork.mockResolvedValue({
      id: 'net-1',
      name: 'Freenode',
      nick: 'tester',
      realname: 'Real User',
      servers: [],
      clientCert: 'bad-cert',
    });

    const { findByText } = await render(
      <NetworkSettingsScreen
        networkId="net-1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText(/View Fingerprint/));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Invalid certificate format. Please configure a valid PEM certificate.',
    );
  });

  it('triggers identity profiles callback and cancel button', async () => {
    const onCancel = jest.fn();
    const onShowIdentityProfiles = jest.fn();
    const { getByText } = await render(
      <NetworkSettingsScreen
        onSave={jest.fn()}
        onCancel={onCancel}
        onShowIdentityProfiles={onShowIdentityProfiles}
      />,
    );

    await fireEvent.press(getByText('Manage Identity Profiles'));
    expect(onShowIdentityProfiles).toHaveBeenCalledTimes(1);

    await fireEvent.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
