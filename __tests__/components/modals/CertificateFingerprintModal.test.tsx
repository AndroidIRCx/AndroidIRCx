import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { CertificateFingerprintModal } from '../../../src/components/modals/CertificateFingerprintModal';

const mockSetString = jest.fn();
const mockFormatFingerprint = jest.fn();

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: (...args: unknown[]) => mockSetString(...args),
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('../../../src/services/CertificateManagerService', () => ({
  certificateManager: {
    formatFingerprint: (...args: unknown[]) => mockFormatFingerprint(...args),
  },
}));

jest.mock('../../../src/i18n/localization', () => ({
  useT: () => (key: string, params?: Record<string, string>) => {
    if (params?.service) return `${key}:${params.service}`;
    return key;
  },
}));

describe('CertificateFingerprintModal', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockFormatFingerprint.mockImplementation((fp: string) => fp.toUpperCase());
  });

  it('copies fingerprint and command', async () => {
    const { getByText } = await render(
      <CertificateFingerprintModal
        visible
        onClose={jest.fn()}
        fingerprint="aabbcc"
      />,
    );

    await fireEvent.press(getByText('Copy Fingerprint'));
    await fireEvent.press(getByText('Copy Command'));

    expect(mockSetString).toHaveBeenCalledWith('AABBCC');
    expect(mockSetString).toHaveBeenCalledWith('/msg NickServ CERT ADD AABBCC');
  });

  it('sends command to selected service and closes', async () => {
    const onSendToNickServ = jest.fn();
    const onClose = jest.fn();

    const { getByText } = await render(
      <CertificateFingerprintModal
        visible
        onClose={onClose}
        fingerprint="ddee"
        onSendToNickServ={onSendToNickServ}
      />,
    );

    await fireEvent.press(getByText('HostServ'));
    await fireEvent.press(getByText('Send to {{service}}:HostServ'));

    expect(onSendToNickServ).toHaveBeenCalledWith(
      '/msg HostServ CERT ADD DDEE',
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('hides qr section when disabled', async () => {
    const { queryByText } = await render(
      <CertificateFingerprintModal
        visible
        onClose={jest.fn()}
        fingerprint="ddee"
        showQRCode={false}
      />,
    );

    expect(queryByText('QR Code')).toBeNull();
  });
});
