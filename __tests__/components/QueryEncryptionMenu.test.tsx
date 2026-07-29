import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
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
  CodeScanner: (props: any) => {
    (global as any).__scannerProps = props;
    return null;
  },
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

  // The component defers its offline "Share Your Key?" prompt via
  // setTimeout(fn, 500). Capture that callback instead of letting a real timer
  // fire Alert.alert after the Jest env is torn down (which throws). Every other
  // timer (e.g. RNTL waitFor internals) is delegated to the real implementation.
  const deferredShareBackTimers: Array<() => void> = [];
  const flushShareBackTimers = () => {
    deferredShareBackTimers.splice(0).forEach(cb => cb());
  };
  let setTimeoutSpy: jest.SpyInstance | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    deferredShareBackTimers.length = 0;
    const realSetTimeout = global.setTimeout;
    setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: any, delay?: number, ...args: any[]) => {
        if (delay === 500) {
          deferredShareBackTimers.push(() => fn(...args));
          return 0 as any;
        }
        return (realSetTimeout as any)(fn, delay, ...args);
      }) as any);

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

  afterEach(() => {
    // Drop any deferred share-back callbacks that a test didn't flush so they
    // can never fire after the environment is torn down, then restore setTimeout.
    deferredShareBackTimers.length = 0;
    setTimeoutSpy?.mockRestore();
    setTimeoutSpy = undefined;
  });

  it('renders menu and closes', async () => {
    const onClose = jest.fn();
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={onClose}
        nick="alice"
        network="net-1"
      />,
    );

    expect(getByText('E2E Encryption - alice')).toBeTruthy();
    await fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shares dm key and sends request', async () => {
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Share DM Key'));
    await fireEvent.press(getByText('Request DM Key (36s)'));

    await waitFor(async () => {
      expect(sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('PRIVMSG alice :!enc-offer'),
      );
      expect(sendRaw).toHaveBeenCalledWith('PRIVMSG alice :!enc-req');
    });
    expect(mockAwaitBundleForNick).toHaveBeenCalledWith('alice', 36000);
  });

  it('handles verify action with missing fingerprint', async () => {
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Verify DM Key'));

    await waitFor(async () => {
      expect(getByText('No DM key for alice')).toBeTruthy();
    });
  });

  it('handles verify action with fingerprint and copy callback', async () => {
    mockGetVerificationStatus.mockResolvedValue({
      verified: false,
      fingerprint: 'ff00',
    });

    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Verify DM Key'));

    await waitFor(async () => {
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
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Share Key Bundle QR'));
    await waitFor(() => expect(getByText('Share Key Bundle')).toBeTruthy());

    await fireEvent.press(getByText('Copy Payload'));
    expect(mockSetString).toHaveBeenCalledWith('payload-bundle');
  });

  it('shares key file and cleans temp file', async () => {
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Share Key File'));

    await waitFor(async () => {
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
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Import Key File'));

    await waitFor(async () => {
      expect(mockPick).toHaveBeenCalled();
      expect(mockReadFile).toHaveBeenCalledWith('/tmp/key.json', 'utf8');
      expect(mockParseExternalPayload).toHaveBeenCalledWith(
        '{"type":"encdm-bundle"}',
      );
    });
  });

  it('shows nfc unsupported feedback', async () => {
    mockNfcIsSupported.mockResolvedValue(false);
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Share via NFC'));
    await waitFor(async () => {
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

    await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await waitFor(async () => {
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

    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Import Key File'));

    await waitFor(async () => {
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

    const { getByText, queryByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Import Key File'));

    await waitFor(async () => {
      expect(mockPick).toHaveBeenCalled();
    });
    expect(queryByText('Failed to import key file')).toBeNull();
  });

  it('shows import error feedback on non-cancel import failure', async () => {
    mockPick.mockRejectedValue(new Error('io-fail'));
    mockIsErrorWithCode.mockReturnValue(false);

    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Import Key File'));

    await waitFor(async () => {
      expect(getByText('Failed to import key file')).toBeTruthy();
    });
  });

  it('runs nfc share success path', async () => {
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Share via NFC'));

    await waitFor(async () => {
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
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Receive via NFC'));

    await waitFor(async () => {
      expect(getByText('No NFC payload')).toBeTruthy();
    });
  });

  it('handles qr scan permission denial path', async () => {
    mockHasCameraPermission = false;
    mockRequestCameraPermission.mockResolvedValue('denied');
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Scan QR Code'));

    await waitFor(async () => {
      expect(getByText('Camera permission denied')).toBeTruthy();
    });
  });

  it('shows verify load error feedback', async () => {
    mockGetVerificationStatus.mockRejectedValue(new Error('verify-fail'));
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Verify DM Key'));

    await waitFor(async () => {
      expect(getByText('Failed to load fingerprints')).toBeTruthy();
    });
  });

  it('reacts to settings-change subscriptions toggling groups off', async () => {
    const handlers: Record<string, (v: unknown) => void> = {};
    mockOnSettingChange.mockImplementation(
      (key: string, cb: (v: unknown) => void) => {
        handlers[key] = cb;
        return () => {};
      },
    );

    const { queryByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await waitFor(() =>
      expect(mockGetSetting).toHaveBeenCalledWith(
        'securityAllowNfcExchange',
        true,
      ),
    );
    // Flush the async load() so its setState calls don't overwrite our toggles
    await act(async () => {});
    expect(queryByText('Scan QR Code')).toBeTruthy();

    await act(async () => {
      handlers.securityAllowQrVerification?.(false);
      handlers.securityAllowFileExchange?.(false);
      handlers.securityAllowNfcExchange?.(false);
    });

    await waitFor(() => {
      expect(queryByText('Scan QR Code')).toBeNull();
      expect(queryByText('Import Key File')).toBeNull();
      expect(queryByText('Share via NFC')).toBeNull();
    });
  });

  it('shows fingerprint QR and handles generate failure', async () => {
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Show Fingerprint QR (Verify)'));
    await waitFor(() => expect(getByText('Fingerprint QR')).toBeTruthy());

    // Close the QR modal by pressing the overlay
    await fireEvent.press(getByText('Fingerprint QR'));
  });

  it('shows share-key failure when export bundle rejects', async () => {
    mockExportBundle.mockRejectedValue(new Error('nope'));
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Share DM Key'));
    await waitFor(() => expect(getByText('Failed to share key')).toBeTruthy());
  });

  it('shows request-key timeout feedback', async () => {
    mockAwaitBundleForNick.mockRejectedValue(new Error('timeout'));
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Request DM Key (36s)'));
    await waitFor(() =>
      expect(getByText('Key not received (timeout)')).toBeTruthy(),
    );
  });

  it('shows request-key saved feedback on resolve', async () => {
    mockAwaitBundleForNick.mockResolvedValue(undefined);
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Request DM Key (36s)'));
    await waitFor(() => expect(getByText('Key saved for alice')).toBeTruthy());
  });

  it('shows generate-QR failure feedback for bundle QR', async () => {
    mockExportBundlePayload.mockRejectedValue(new Error('bad'));
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Share Key Bundle QR'));
    await waitFor(() =>
      expect(getByText('Failed to generate QR')).toBeTruthy(),
    );
  });

  it('shows share-key-file failure when write fails', async () => {
    mockWriteFile.mockRejectedValue(new Error('io'));
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Share Key File'));
    await waitFor(() =>
      expect(getByText('Failed to share key file')).toBeTruthy(),
    );
  });

  it('imports a copied file and cleans up the temp copy', async () => {
    mockPick.mockResolvedValue([
      { uri: 'content://orig', fileCopyUri: 'file:///cache/copy.json' },
    ]);
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Import Key File'));
    await waitFor(() => {
      expect(mockReadFile).toHaveBeenCalledWith('/cache/copy.json', 'utf8');
      expect(mockUnlink).toHaveBeenCalledWith('/cache/copy.json');
    });
  });

  it('opens the camera scanner and processes a scanned payload', async () => {
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Scan QR Code'));
    await waitFor(() =>
      expect(getByText('Scan a fingerprint QR')).toBeTruthy(),
    );

    const props = (global as any).__scannerProps;
    expect(props).toBeTruthy();
    // Trigger a scanner error first
    await props.onError(new Error('scan-broke'));
    // Then a successful scan
    await props.onBarcodeScanned([{ rawValue: 'scanned-code' }]);

    await waitFor(() =>
      expect(mockParseExternalPayload).toHaveBeenCalledWith('scanned-code'),
    );
  });

  it('shows camera-open failure when permission request throws', async () => {
    mockHasCameraPermission = false;
    mockRequestCameraPermission.mockRejectedValue(new Error('boom'));
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Scan QR Code'));
    await waitFor(() =>
      expect(getByText('Failed to open camera')).toBeTruthy(),
    );
  });

  it('imports a fingerprint payload and reports mismatch', async () => {
    mockParseExternalPayload.mockReturnValue({
      type: 'encdm-fingerprint',
      fingerprint: 'zz99',
      nick: 'alice',
    });
    mockGetBundleFingerprintForNetwork.mockResolvedValue('aa11');
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Import Key File'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Fingerprint Check',
        expect.any(String),
        expect.any(Array),
      ),
    );
  });

  it('imports a fingerprint payload, marks verified on match', async () => {
    mockParseExternalPayload.mockReturnValue({
      type: 'encdm-fingerprint',
      fingerprint: 'aa11',
      nick: 'alice',
    });
    mockGetBundleFingerprintForNetwork.mockResolvedValue('aa11');
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Import Key File'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Fingerprint Check',
        expect.any(String),
        expect.any(Array),
      ),
    );

    const buttons = (Alert.alert as jest.Mock).mock.calls.slice(-1)[0][2];
    const markVerified = buttons.find((b: any) => b.text === 'Mark Verified');
    await markVerified.onPress();
    expect(mockSetVerifiedForNetwork).toHaveBeenCalledWith(
      'net-1',
      'alice',
      true,
    );
  });

  it('imports a fingerprint payload with no stored key', async () => {
    mockParseExternalPayload.mockReturnValue({
      type: 'encdm-fingerprint',
      fingerprint: 'aa11',
      nick: 'alice',
    });
    mockGetBundleFingerprintForNetwork.mockResolvedValue(null);
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Import Key File'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('No Key', expect.any(String)),
    );
  });

  it('imports a new bundle key, accepts it, and shows the share-back QR prompt', async () => {
    mockParseExternalPayload.mockReturnValue({
      type: 'encdm-bundle',
      fingerprint: 'newfp',
      bundle: { pub: 'x' },
      nick: 'alice',
    });
    mockGetBundleFingerprintForNetwork.mockResolvedValue(null);
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Import Key File'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Import DM Key',
        expect.any(String),
        expect.any(Array),
      ),
    );

    const buttons = (Alert.alert as jest.Mock).mock.calls.find(
      c => c[0] === 'Import DM Key',
    )?.[2];
    const accept = buttons.find((b: any) => b.text === 'Accept');
    await accept.onPress();
    expect(mockAcceptExternalBundleForNetwork).toHaveBeenCalledWith(
      'net-1',
      'alice',
      { pub: 'x' },
      false,
    );

    // The follow-up "Share Your Key?" prompt is deferred via setTimeout(…, 500);
    // flush the captured callback so it runs during the test (not post-teardown).
    flushShareBackTimers();
    const shareBackPrompt = (Alert.alert as jest.Mock).mock.calls.find(
      c => c[0] === 'Share Your Key?',
    );
    expect(shareBackPrompt).toBeTruthy();
    const showQr = shareBackPrompt[2].find(
      (b: any) => b.text === 'Show QR Code',
    );
    await showQr.onPress();
    expect(mockExportBundlePayload).toHaveBeenCalled();
  });

  it('shows generate-QR failure feedback for fingerprint QR', async () => {
    mockExportFingerprintPayload.mockRejectedValue(new Error('bad'));
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Show Fingerprint QR (Verify)'));
    await waitFor(() =>
      expect(getByText('Failed to generate QR')).toBeTruthy(),
    );
  });

  it('renders the camera fallback when permission is granted but hook lacks it', async () => {
    mockHasCameraPermission = false;
    mockRequestCameraPermission.mockResolvedValue('granted');
    const { getByText, getAllByText, queryByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Scan QR Code'));
    await waitFor(() => expect(getByText('Camera unavailable')).toBeTruthy());

    // Close the scan modal via the overlay close button (last "Close" on screen)
    const closes = getAllByText('Close');
    await fireEvent.press(closes[closes.length - 1]);
    await waitFor(() => expect(queryByText('Camera unavailable')).toBeNull());
  });

  it('imports a changed bundle key and replaces it, then shows QR', async () => {
    mockParseExternalPayload.mockReturnValue({
      type: 'encdm-bundle',
      fingerprint: 'newfp',
      bundle: { pub: 'x' },
      nick: 'alice',
    });
    mockGetBundleFingerprintForNetwork.mockResolvedValue('oldfp');
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Import Key File'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Replace DM Key',
        expect.any(String),
        expect.any(Array),
      ),
    );

    const replaceButtons = (Alert.alert as jest.Mock).mock.calls.slice(-1)[0][2];
    const replace = replaceButtons.find((b: any) => b.text === 'Replace');
    await replace.onPress();
    expect(mockAcceptExternalBundleForNetwork).toHaveBeenCalledWith(
      'net-1',
      'alice',
      { pub: 'x' },
      true,
    );
  });

  it('shows invalid-payload feedback when parsing throws', async () => {
    mockParseExternalPayload.mockImplementation(() => {
      throw new Error('bad payload');
    });
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Import Key File'));
    await waitFor(() =>
      expect(getByText('Invalid key payload')).toBeTruthy(),
    );
  });

  it('handles NFC share failure after supported check', async () => {
    mockExportBundlePayload.mockRejectedValue(new Error('export fail'));
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Share via NFC'));
    await waitFor(() =>
      expect(getByText('Failed to share via NFC')).toBeTruthy(),
    );
  });

  it('receives an NFC payload successfully', async () => {
    mockNfcGetTag.mockResolvedValue({ ndefMessage: [{ payload: [1, 2, 3] }] });
    mockNdefDecodePayload.mockReturnValue('nfc-payload');
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Receive via NFC'));
    await waitFor(() =>
      expect(mockParseExternalPayload).toHaveBeenCalledWith('nfc-payload'),
    );
  });

  it('reports NFC unsupported when receiving', async () => {
    mockNfcIsSupported.mockResolvedValue(false);
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Receive via NFC'));
    await waitFor(() => expect(getByText('NFC not supported')).toBeTruthy());
  });

  it('reports failure to read NFC on error', async () => {
    mockNfcGetTag.mockRejectedValue(new Error('read fail'));
    const { getByText } = await render(
      <QueryEncryptionMenu
        visible
        onClose={jest.fn()}
        nick="alice"
        network="net-1"
      />,
    );

    await fireEvent.press(getByText('Receive via NFC'));
    await waitFor(() => expect(getByText('Failed to read NFC')).toBeTruthy());
  });

  it('falls back to the global ircService when no network prop', async () => {
    const { getByText } = await render(
      <QueryEncryptionMenu visible onClose={jest.fn()} nick="alice" />,
    );

    await fireEvent.press(getByText('Verify DM Key'));
    await waitFor(() => expect(mockGetVerificationStatus).toHaveBeenCalled());
  });
});
