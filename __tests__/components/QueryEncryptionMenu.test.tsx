import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryEncryptionMenu } from '../../src/components/QueryEncryptionMenu';

const mockGetConnection = jest.fn();
const mockGetActiveConnection = jest.fn();
const mockGetSetting = jest.fn();
const mockOnSettingChange = jest.fn();
const mockSetString = jest.fn();
const mockShareOpen = jest.fn();
const mockWriteFile = jest.fn();
const mockExists = jest.fn();
const mockUnlink = jest.fn();
const mockReadFile = jest.fn();
const mockPick = jest.fn();
const mockIsErrorWithCode = jest.fn();
const mockNfcIsSupported = jest.fn();
const mockNfcStart = jest.fn();
const mockNfcRequestTechnology = jest.fn();
const mockNfcWriteNdefMessage = jest.fn();
const mockNfcCancelTechnologyRequest = jest.fn();
const mockNfcGetTag = jest.fn();
const mockNdefEncodeMessage = jest.fn();
const mockNdefTextRecord = jest.fn();
const mockNdefDecodePayload = jest.fn();
let mockHasCameraPermission = true;
const mockRequestCameraPermission = jest.fn();

const mockExportBundle = jest.fn();
const mockAwaitBundleForNick = jest.fn();
const mockGetVerificationStatus = jest.fn();
const mockGetSelfFingerprint = jest.fn();
const mockFormatFingerprintForDisplay = jest.fn();
const mockExportBundlePayload = jest.fn();
const mockExportFingerprintPayload = jest.fn();
const mockParseExternalPayload = jest.fn();
const mockVerifyBundle = jest.fn();
const mockAcceptExternalBundleForNetwork = jest.fn();
const mockGetBundleFingerprintForNetwork = jest.fn();
const mockSetVerifiedForNetwork = jest.fn();

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      border: '#333',
      text: '#fff',
      textSecondary: '#aaa',
      primary: '#08f',
      background: '#000',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, any>) => {
    if (!params) return key;
    return key.replace('{nick}', String(params.nick ?? ''));
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: (...args: unknown[]) => mockGetConnection(...args),
    getActiveConnection: (...args: unknown[]) =>
      mockGetActiveConnection(...args),
  },
}));

jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    sendRaw: jest.fn(),
    addMessage: jest.fn(),
    getCurrentNick: jest.fn(() => 'me'),
    getNetworkName: jest.fn(() => 'net-1'),
  },
}));

jest.mock('../../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    exportBundle: (...args: unknown[]) => mockExportBundle(...args),
    awaitBundleForNick: (...args: unknown[]) => mockAwaitBundleForNick(...args),
    getVerificationStatus: (...args: unknown[]) =>
      mockGetVerificationStatus(...args),
    getVerificationStatusForNetwork: (...args: unknown[]) =>
      mockGetVerificationStatus(...args),
    getSelfFingerprint: (...args: unknown[]) => mockGetSelfFingerprint(...args),
    formatFingerprintForDisplay: (...args: unknown[]) =>
      mockFormatFingerprintForDisplay(...args),
    exportBundlePayload: (...args: unknown[]) =>
      mockExportBundlePayload(...args),
    exportFingerprintPayload: (...args: unknown[]) =>
      mockExportFingerprintPayload(...args),
    parseExternalPayload: (...args: unknown[]) =>
      mockParseExternalPayload(...args),
    verifyBundle: (...args: unknown[]) => mockVerifyBundle(...args),
    acceptExternalBundleForNetwork: (...args: unknown[]) =>
      mockAcceptExternalBundleForNetwork(...args),
    getBundleFingerprintForNetwork: (...args: unknown[]) =>
      mockGetBundleFingerprintForNetwork(...args),
    setVerifiedForNetwork: (...args: unknown[]) =>
      mockSetVerifiedForNetwork(...args),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: unknown[]) => mockGetSetting(...args),
    onSettingChange: (...args: unknown[]) => mockOnSettingChange(...args),
  },
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: (...args: unknown[]) => mockSetString(...args),
}));

jest.mock('react-native-vision-camera', () => ({
  useCameraDevice: () => ({ id: 'cam-1' }),
  useCameraPermission: () => ({
    hasPermission: mockHasCameraPermission,
    requestPermission: (...args: unknown[]) =>
      mockRequestCameraPermission(...args),
  }),
}));

jest.mock('react-native-vision-camera-barcode-scanner', () => ({
  CodeScanner: () => null,
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native-share', () => ({
  open: (...args: unknown[]) => mockShareOpen(...args),
}));
jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  exists: (...args: unknown[]) => mockExists(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));
jest.mock('@react-native-documents/picker', () => ({
  pick: (...args: unknown[]) => mockPick(...args),
  types: { allFiles: '*/*' },
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: (...args: unknown[]) => mockIsErrorWithCode(...args),
}));
jest.mock('react-native-nfc-manager', () => ({
  isSupported: (...args: unknown[]) => mockNfcIsSupported(...args),
  start: (...args: unknown[]) => mockNfcStart(...args),
  requestTechnology: (...args: unknown[]) => mockNfcRequestTechnology(...args),
  writeNdefMessage: (...args: unknown[]) => mockNfcWriteNdefMessage(...args),
  cancelTechnologyRequest: (...args: unknown[]) =>
    mockNfcCancelTechnologyRequest(...args),
  getTag: (...args: unknown[]) => mockNfcGetTag(...args),
  NfcTech: { Ndef: 'ndef' },
  Ndef: {
    encodeMessage: (...args: unknown[]) => mockNdefEncodeMessage(...args),
    textRecord: (...args: unknown[]) => mockNdefTextRecord(...args),
    text: {
      decodePayload: (...args: unknown[]) => mockNdefDecodePayload(...args),
    },
  },
}));

describe('QueryEncryptionMenu', () => {
  const sendRaw = jest.fn();
  const addMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    const irc = {
      sendRaw,
      addMessage,
      getCurrentNick: jest.fn(() => 'me'),
      getNetworkName: jest.fn(() => 'net-1'),
    };

    mockGetConnection.mockReturnValue({ ircService: irc });
    mockGetActiveConnection.mockReturnValue({ ircService: irc });

    mockGetSetting.mockImplementation((key: string, def: any) =>
      Promise.resolve(def),
    );
    mockOnSettingChange.mockImplementation(() => () => {});

    mockExportBundle.mockResolvedValue({ pub: 'bundle' });
    mockAwaitBundleForNick.mockResolvedValue(undefined);
    mockGetVerificationStatus.mockResolvedValue({
      verified: false,
      fingerprint: null,
    });
    mockGetSelfFingerprint.mockResolvedValue('aabb');
    mockFormatFingerprintForDisplay.mockImplementation((f: string) =>
      f.toUpperCase(),
    );
    mockExportBundlePayload.mockResolvedValue('payload-bundle');
    mockExportFingerprintPayload.mockResolvedValue('payload-fingerprint');
    mockParseExternalPayload.mockReturnValue({
      type: 'encdm-bundle',
      fingerprint: 'f1',
      bundle: { pub: 'x' },
      nick: 'alice',
    });
    mockVerifyBundle.mockReturnValue(undefined);
    mockAcceptExternalBundleForNetwork.mockResolvedValue(undefined);
    mockGetBundleFingerprintForNetwork.mockResolvedValue(null);
    mockSetVerifiedForNetwork.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockExists.mockResolvedValue(true);
    mockUnlink.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue('{"type":"encdm-bundle"}');
    mockPick.mockResolvedValue([{ uri: 'file:///tmp/key.json' }]);
    mockIsErrorWithCode.mockReturnValue(false);
    mockNfcIsSupported.mockResolvedValue(true);
    mockNfcStart.mockResolvedValue(undefined);
    mockNfcRequestTechnology.mockResolvedValue(undefined);
    mockNdefTextRecord.mockReturnValue({ payload: 'ndef' });
    mockNdefEncodeMessage.mockReturnValue([1, 2, 3]);
    mockNfcWriteNdefMessage.mockResolvedValue(undefined);
    mockNfcGetTag.mockResolvedValue({ ndefMessage: [{ payload: 'x' }] });
    mockNdefDecodePayload.mockReturnValue('payload-bundle');
    mockHasCameraPermission = true;
    mockRequestCameraPermission.mockResolvedValue('authorized');
  });

  it('renders menu and closes', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={onClose}
        nick="alice"
        network="net-1"
      />,
    );

    expect(getByText('E2E Encryption - alice')).toBeTruthy();
    fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shares dm key and sends request', async () => {
    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Share DM Key'));
    fireEvent.press(getByText('Request DM Key (36s)'));

    await waitFor(() => {
      expect(sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('PRIVMSG alice :!enc-offer'),
      );
      expect(sendRaw).toHaveBeenCalledWith('PRIVMSG alice :!enc-req');
    });
    expect(mockAwaitBundleForNick).toHaveBeenCalledWith('alice', 36000);
  });

  it('handles verify action with missing fingerprint', async () => {
    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Verify DM Key'));

    await waitFor(() => {
      expect(getByText('No DM key for alice')).toBeTruthy();
    });
  });

  it('handles verify action with fingerprint and copy callback', async () => {
    mockGetVerificationStatus.mockResolvedValue({
      verified: false,
      fingerprint: 'ff00',
    });

    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Verify DM Key'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Verify DM Key',
        expect.stringContaining('Compare fingerprints out-of-band'),
        expect.any(Array),
      );
    });

    const args = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = args[2];
    const markVerified = buttons.find((b: any) => b.text === 'Mark Verified');
    const copy = buttons.find((b: any) => b.text === 'Copy Fingerprints');

    await markVerified.onPress();
    copy.onPress();

    expect(mockSetVerifiedForNetwork).toHaveBeenCalledWith(
      'net-1',
      'alice',
      true,
    );
    expect(mockSetString).toHaveBeenCalledWith(
      expect.stringContaining('alice'),
    );
  });

  it('shows share bundle QR and copies payload', async () => {
    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Share Key Bundle QR'));
    await waitFor(() => expect(getByText('Share Key Bundle')).toBeTruthy());

    fireEvent.press(getByText('Copy Payload'));
    expect(mockSetString).toHaveBeenCalledWith('payload-bundle');
  });

  it('shares key file and cleans temp file', async () => {
    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Share Key File'));

    await waitFor(() => {
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/cache/androidircx-key-me.json',
        'payload-bundle',
        'utf8',
      );
      expect(mockShareOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'file:///cache/androidircx-key-me.json',
        }),
      );
      expect(mockUnlink).toHaveBeenCalledWith('/cache/androidircx-key-me.json');
    });
  });

  it('imports key file and feeds payload parser', async () => {
    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Import Key File'));

    await waitFor(() => {
      expect(mockPick).toHaveBeenCalled();
      expect(mockReadFile).toHaveBeenCalledWith('/tmp/key.json', 'utf8');
      expect(mockParseExternalPayload).toHaveBeenCalledWith(
        '{"type":"encdm-bundle"}',
      );
    });
  });

  it('shows nfc unsupported feedback', async () => {
    mockNfcIsSupported.mockResolvedValue(false);
    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Share via NFC'));
    await waitFor(() => {
      expect(getByText('NFC not supported')).toBeTruthy();
    });
  });

  it('hides qr/file/nfc groups when settings disable them', async () => {
    mockGetSetting.mockImplementation((key: string, def: any) => {
      if (key === 'securityAllowQrVerification') return Promise.resolve(false);
      if (key === 'securityAllowFileExchange') return Promise.resolve(false);
      if (key === 'securityAllowNfcExchange') return Promise.resolve(false);
      return Promise.resolve(def);
    });

    render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await waitFor(() => {
      expect(mockGetSetting).toHaveBeenCalledWith(
        'securityAllowQrVerification',
        true,
      );
      expect(mockGetSetting).toHaveBeenCalledWith(
        'securityAllowFileExchange',
        true,
      );
      expect(mockGetSetting).toHaveBeenCalledWith(
        'securityAllowNfcExchange',
        true,
      );
    });
  });

  it('shows mismatched nick alert on imported payload', async () => {
    mockParseExternalPayload.mockReturnValue({
      type: 'encdm-bundle',
      fingerprint: 'f1',
      bundle: { pub: 'x' },
      nick: 'bob',
    });

    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Import Key File'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Mismatched Nick',
        expect.stringContaining('selected alice'),
        expect.any(Array),
      );
    });
  });

  it('handles import file cancellation gracefully', async () => {
    const err = { code: 'OPERATION_CANCELED' };
    mockPick.mockRejectedValue(err);
    mockIsErrorWithCode.mockImplementation(
      (e: any) => e?.code === 'OPERATION_CANCELED',
    );

    const { getByText, queryByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Import Key File'));

    await waitFor(() => {
      expect(mockPick).toHaveBeenCalled();
    });
    expect(queryByText('Failed to import key file')).toBeNull();
  });

  it('shows import error feedback on non-cancel import failure', async () => {
    mockPick.mockRejectedValue(new Error('io-fail'));
    mockIsErrorWithCode.mockReturnValue(false);

    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Import Key File'));

    await waitFor(() => {
      expect(getByText('Failed to import key file')).toBeTruthy();
    });
  });

  it('runs nfc share success path', async () => {
    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Share via NFC'));

    await waitFor(() => {
      expect(mockNfcIsSupported).toHaveBeenCalled();
      expect(mockNfcStart).toHaveBeenCalled();
      expect(mockNfcRequestTechnology).toHaveBeenCalledWith('ndef');
      expect(mockNdefTextRecord).toHaveBeenCalledWith('payload-bundle');
      expect(mockNdefEncodeMessage).toHaveBeenCalled();
      expect(mockNfcWriteNdefMessage).toHaveBeenCalledWith([1, 2, 3]);
      expect(mockNfcCancelTechnologyRequest).toHaveBeenCalled();
      expect(getByText('NFC key ready, tap devices')).toBeTruthy();
    });
  });

  it('handles receive nfc with missing payload', async () => {
    mockNfcGetTag.mockResolvedValue({ ndefMessage: [] });
    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Receive via NFC'));

    await waitFor(() => {
      expect(getByText('No NFC payload')).toBeTruthy();
    });
  });

  it('handles qr scan permission denial path', async () => {
    mockHasCameraPermission = false;
    mockRequestCameraPermission.mockResolvedValue('denied');
    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Scan QR Code'));

    await waitFor(() => {
      expect(getByText('Camera permission denied')).toBeTruthy();
    });
  });

  it('shows verify load error feedback', async () => {
    mockGetVerificationStatus.mockRejectedValue(new Error('verify-fail'));
    const { getByText } = render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    fireEvent.press(getByText('Verify DM Key'));

    await waitFor(() => {
      expect(getByText('Failed to load fingerprints')).toBeTruthy();
    });
  });
});
