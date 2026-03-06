import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { CertificateSelectorModal } from '../../../src/components/modals/CertificateSelectorModal';

const mockListCertificates = jest.fn();
const mockValidateCertificate = jest.fn();
const mockGetCertificate = jest.fn();
const mockDeleteCertificate = jest.fn();

jest.mock('../../../src/services/CertificateManagerService', () => ({
  certificateManager: {
    listCertificates: (...args: unknown[]) => mockListCertificates(...args),
    validateCertificate: (...args: unknown[]) => mockValidateCertificate(...args),
    getCertificate: (...args: unknown[]) => mockGetCertificate(...args),
    deleteCertificate: (...args: unknown[]) => mockDeleteCertificate(...args),
  },
}));

jest.mock('../../../src/components/modals/CertificateGeneratorModal', () => ({
  CertificateGeneratorModal: () => null,
}));

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

describe('CertificateSelectorModal', () => {
  const certMeta = {
    id: 'c1',
    name: 'Work Cert',
    commonName: 'nick@test',
    fingerprint: 'aabbccddeeff001122334455',
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2027-01-01'),
    createdAt: new Date('2026-01-02'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockListCertificates.mockResolvedValue([certMeta]);
    mockValidateCertificate.mockReturnValue({ isExpired: false, daysUntilExpiry: 100 });
    mockGetCertificate.mockResolvedValue({ ...certMeta, pemCert: 'pem', pemKey: 'key' });
    mockDeleteCertificate.mockResolvedValue(undefined);
  });

  it('loads certs and selects valid certificate', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    const { getByText } = render(
      <CertificateSelectorModal visible onClose={onClose} onSelect={onSelect} />
    );

    await waitFor(() => {
      expect(getByText('Work Cert')).toBeTruthy();
      expect(getByText('Valid')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('Work Cert'));
    });

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks expired certificate selection', async () => {
    mockValidateCertificate.mockReturnValue({ isExpired: true, daysUntilExpiry: -1 });

    const { getByText } = render(
      <CertificateSelectorModal visible onClose={jest.fn()} onSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(getByText('Work Cert')).toBeTruthy();
    });

    fireEvent.press(getByText('Work Cert'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Certificate Expired',
      'This certificate has expired. Please generate a new one.',
      [{ text: 'OK' }]
    );
  });

  it('deletes certificate through confirmation action', async () => {
    const { getByText } = render(
      <CertificateSelectorModal visible onClose={jest.fn()} onSelect={jest.fn()} />
    );

    await waitFor(() => {
      expect(getByText('🗑️')).toBeTruthy();
    });

    fireEvent.press(getByText('🗑️'));

    const deleteAction = (Alert.alert as jest.Mock).mock.calls.find(
      c => c[0] === 'Delete Certificate'
    )?.[2]?.[1];

    await act(async () => {
      await deleteAction.onPress();
    });

    expect(mockDeleteCertificate).toHaveBeenCalledWith('c1');
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Certificate deleted');
  });
});
