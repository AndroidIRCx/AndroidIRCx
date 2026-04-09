/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NetworkSettingsScreen } from '../../src/screens/NetworkSettingsScreen';

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
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

jest.mock('@react-native-picker/picker', () => ({
  Picker: Object.assign(
    ({ selectedValue, onValueChange, children }: any) => {
      const { Text } = require('react-native');
      return (
        <>
          <Text>Picker Value: {selectedValue}</Text>
          <Text onPress={() => onValueChange('SCRAM-SHA-256')}>
            Select SCRAM-SHA-256
          </Text>
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
}));

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
    const { findByDisplayValue, findByText } = render(
      <NetworkSettingsScreen onSave={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(await findByText('Network Settings')).toBeTruthy();
    expect(await findByDisplayValue('AndroidIRCX')).toBeTruthy();
    expect(await findByDisplayValue('AndroidIRCX_')).toBeTruthy();
    expect(await findByDisplayValue('AndroidIRCX User')).toBeTruthy();
    expect(await findByDisplayValue('androidircx')).toBeTruthy();
  });

  it('loads an existing network', async () => {
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

    const { findByDisplayValue, findByText } = render(
      <NetworkSettingsScreen
        networkId="net-1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(await findByDisplayValue('Freenode')).toBeTruthy();
    expect(await findByDisplayValue('tester')).toBeTruthy();
    expect(await findByDisplayValue('#a, #b')).toBeTruthy();
    expect(await findByDisplayValue('pem-cert')).toBeTruthy();
    expect(await findByText(/View Fingerprint/)).toBeTruthy();
  });

  it('shows error and retries when loading fails', async () => {
    settingsService.getNetwork.mockRejectedValueOnce(new Error('boom'));
    settingsService.getNetwork.mockResolvedValue({
      id: 'net-1',
      name: 'Recovered',
      nick: 'nick',
      realname: 'Real',
      servers: [],
    });

    const { findByText, findByDisplayValue } = render(
      <NetworkSettingsScreen
        networkId="net-1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(settingsService.getNetwork).toHaveBeenCalled();
    });
    const retryBtn = await findByText('Retry');
    fireEvent.press(retryBtn);
    expect(await findByDisplayValue('Recovered')).toBeTruthy();
  });

  it('validates required fields before saving', async () => {
    const { findAllByText, findAllByDisplayValue } = render(
      <NetworkSettingsScreen onSave={jest.fn()} onCancel={jest.fn()} />,
    );

    fireEvent.changeText((await findAllByDisplayValue('AndroidIRCX'))[0], '');
    fireEvent.press((await findAllByText('Save'))[0]);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please fill in all required fields (Name, Nick, Realname)',
    );
  });

  it('saves a new network payload', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { findByText, findByDisplayValue, findByPlaceholderText } = render(
      <NetworkSettingsScreen onSave={onSave} onCancel={jest.fn()} />,
    );

    fireEvent.changeText(
      await findByPlaceholderText('e.g., dbase.in.rs'),
      'Libera',
    );
    fireEvent.changeText(await findByDisplayValue('AndroidIRCX'), 'tester');
    fireEvent.changeText(
      await findByDisplayValue('AndroidIRCX User'),
      'Tester Real',
    );
    fireEvent.changeText(
      await findByPlaceholderText('#channel1, #channel2'),
      '#chat, #help',
    );
    fireEvent.press(await findByText('Save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Libera',
          autoJoinChannels: ['#chat', '#help'],
        }),
      );
    });
  });

  it('saves proxy and sasl configuration', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { UNSAFE_getByType, findByPlaceholderText, findByText } = render(
      <NetworkSettingsScreen onSave={onSave} onCancel={jest.fn()} />,
    );

    fireEvent.changeText(
      await findByPlaceholderText('e.g., dbase.in.rs'),
      'ProxyNet',
    );
    fireEvent.changeText(
      await findByPlaceholderText('Your IRC nickname'),
      'nick',
    );
    fireEvent.changeText(
      await findByPlaceholderText('Your real name or description'),
      'Real',
    );

    const switchNode = await waitFor(() =>
      UNSAFE_getByType(require('react-native').Switch),
    );
    fireEvent(switchNode, 'valueChange', true);

    fireEvent.changeText(await findByPlaceholderText('tor'), 'socks5');
    fireEvent.changeText(
      await findByPlaceholderText('127.0.0.1 (Tor default)'),
      '10.0.0.1',
    );
    fireEvent.changeText(
      await findByPlaceholderText('9050 for Tor, 1080 for SOCKS5'),
      '1080',
    );
    fireEvent.changeText(
      await findByPlaceholderText('SASL account name'),
      'acc',
    );
    fireEvent.changeText(await findByPlaceholderText('SASL password'), 'pwd');
    fireEvent.press(await findByText('Select SCRAM-SHA-256'));
    fireEvent.press(await findByText('Save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          sasl: expect.objectContaining({
            account: 'acc',
            password: 'pwd',
            mechanism: 'SCRAM-SHA-256',
          }),
        }),
      );
    });
  });

  it('handles certificate generation and selection', async () => {
    const { findByText, findByDisplayValue, findAllByText } = render(
      <NetworkSettingsScreen onSave={jest.fn()} onCancel={jest.fn()} />,
    );

    fireEvent.press((await findAllByText(/Generate New/))[0]);
    fireEvent.press(await findByText('Complete Certificate Generation'));
    expect(await findByDisplayValue('generated-cert')).toBeTruthy();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      "Certificate generated and applied! Don't forget to add the fingerprint to NickServ.",
    );

    fireEvent.press((await findAllByText(/Select Existing/))[0]);
    fireEvent.press(await findByText('Select Certificate'));
    expect(await findByDisplayValue('selected-cert')).toBeTruthy();
  });

  it('shows certificate fingerprint action for valid cert', async () => {
    settingsService.getNetwork.mockResolvedValue({
      id: 'net-1',
      name: 'Freenode',
      nick: 'tester',
      realname: 'Real User',
      servers: [],
      clientCert: 'pem-cert',
      clientKey: 'pem-key',
    });

    const { findByText } = render(
      <NetworkSettingsScreen
        networkId="net-1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(await findByText(/View Fingerprint/)).toBeTruthy();
    expect(certificateManager.extractFingerprintFromPem).toHaveBeenCalledWith(
      'pem-cert',
    );
  });

  it('triggers identity profiles callback and cancel button', async () => {
    const onCancel = jest.fn();
    const onShowIdentityProfiles = jest.fn();
    const { findByText, findAllByText } = render(
      <NetworkSettingsScreen
        onSave={jest.fn()}
        onCancel={onCancel}
        onShowIdentityProfiles={onShowIdentityProfiles}
      />,
    );

    fireEvent.press(await findByText('Manage Identity Profiles'));
    expect(onShowIdentityProfiles).toHaveBeenCalledTimes(1);

    fireEvent.press((await findAllByText('Cancel'))[0]);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
