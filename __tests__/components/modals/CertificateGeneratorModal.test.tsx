import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { CertificateGeneratorModal } from '../../../src/components/modals/CertificateGeneratorModal';

const mockSetString = jest.fn();
const mockGenerateCertificate = jest.fn();
const mockFormatFingerprint = jest.fn();

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: (...args: unknown[]) => mockSetString(...args),
}));

jest.mock('../../../src/services/CertificateManagerService', () => ({
  certificateManager: {
    generateCertificate: (...args: unknown[]) =>
      mockGenerateCertificate(...args),
    formatFingerprint: (...args: unknown[]) => mockFormatFingerprint(...args),
  },
}));

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

describe('CertificateGeneratorModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockFormatFingerprint.mockReturnValue('AA:BB:CC');
    (global as any).requestAnimationFrame = (cb: (ts?: number) => void) => {
      cb(0);
      return 1;
    };
  });

  it('validates required fields and years range', async () => {
    const { getAllByText, getByDisplayValue, getByPlaceholderText } = render(
      <CertificateGeneratorModal
        visible
        onClose={jest.fn()}
        defaultName=""
        defaultCommonName=""
      />,
    );
    const generateButton = getAllByText('Generate Certificate').slice(-1)[0];

    await act(async () => {
      fireEvent.press(generateButton);
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Certificate name is required',
    );

    fireEvent.changeText(
      getByPlaceholderText('e.g., My IRC Certificate'),
      'My Cert',
    );
    fireEvent.changeText(
      getByPlaceholderText('e.g., nick@irc.network'),
      'nick@test',
    );
    fireEvent.changeText(getByDisplayValue('1'), '99');

    await act(async () => {
      fireEvent.press(generateButton);
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Validity period must be between 1 and 10 years',
    );
  });

  it('generates certificate and copies fingerprint', async () => {
    const cert = {
      id: 'c1',
      name: 'My Cert',
      commonName: 'nick@test',
      fingerprint: 'aabbcc',
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2027-01-01'),
      pemCert: 'pem',
      pemKey: 'key',
      createdAt: new Date('2026-01-01'),
    };
    mockGenerateCertificate.mockResolvedValue(cert);

    const onCertificateGenerated = jest.fn();
    const { getAllByText, getByText, getByPlaceholderText } = render(
      <CertificateGeneratorModal
        visible
        onClose={jest.fn()}
        onCertificateGenerated={onCertificateGenerated}
      />,
    );
    const generateButton = getAllByText('Generate Certificate').slice(-1)[0];

    fireEvent.changeText(
      getByPlaceholderText('e.g., My IRC Certificate'),
      'My Cert',
    );
    fireEvent.changeText(
      getByPlaceholderText('e.g., nick@irc.network'),
      'nick@test',
    );

    await act(async () => {
      fireEvent.press(generateButton);
    });

    expect(mockGenerateCertificate).toHaveBeenCalledWith({
      name: 'My Cert',
      commonName: 'nick@test',
      validityYears: 1,
    });
    expect(onCertificateGenerated).toHaveBeenCalledWith(cert);
    expect(getByText('Certificate Generated Successfully!')).toBeTruthy();

    fireEvent.press(getByText('📋 Copy Fingerprint'));
    expect(mockSetString).toHaveBeenCalledWith('AA:BB:CC');
  });
});
