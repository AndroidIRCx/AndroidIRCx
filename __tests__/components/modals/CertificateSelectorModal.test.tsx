import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { CertificateSelectorModal } from '../../../src/components/modals/CertificateSelectorModal';

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: ({ visible, children }: any) =>
      visible ? React.createElement(React.Fragment, null, children) : null,
  };
});

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: ({ data, renderItem, ListEmptyComponent, keyExtractor }: any) => {
      if (!data || data.length === 0) {
        if (!ListEmptyComponent) {
          return null;
        }

        return typeof ListEmptyComponent === 'function'
          ? React.createElement(ListEmptyComponent)
          : ListEmptyComponent;
      }

      return React.createElement(
        React.Fragment,
        null,
        data.map((item: any, index: number) =>
          React.createElement(
            React.Fragment,
            { key: keyExtractor ? keyExtractor(item, index) : String(index) },
            renderItem({ item, index })
          )
        )
      );
    },
  };
});

const mockListCertificates = jest.fn();
const mockValidateCertificate = jest.fn();
const mockGetCertificate = jest.fn();
const mockDeleteCertificate = jest.fn();
const t = (key: string) => key;

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
  useT: () => t,
}));

describe('CertificateSelectorModal', () => {
  const flushUi = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

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
    const screen = render(<CertificateSelectorModal visible onClose={onClose} onSelect={onSelect} />);

    await flushUi();
    await waitFor(() => expect(screen.queryByText('Work Cert')).toBeTruthy());
    const certButton = screen.getByText('Work Cert');
    expect(certButton).toBeTruthy();
    expect(screen.getByText('Valid')).toBeTruthy();

    await act(async () => {
      fireEvent.press((certButton.parent as any)?.parent ?? certButton);
    });

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks expired certificate selection', async () => {
    mockValidateCertificate.mockReturnValue({ isExpired: true, daysUntilExpiry: -1 });
    const screen = render(
      <CertificateSelectorModal visible onClose={jest.fn()} onSelect={jest.fn()} />
    );

    await flushUi();
    await waitFor(() => expect(screen.queryByText('Work Cert')).toBeTruthy());
    const certButton = screen.getByText('Work Cert');
    expect(certButton).toBeTruthy();

    fireEvent.press((certButton.parent as any)?.parent ?? certButton);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Certificate Expired',
      'This certificate has expired. Please generate a new one.',
      [{ text: 'OK' }]
    );
  });

  it('deletes certificate through confirmation action', async () => {
    const screen = render(
      <CertificateSelectorModal visible onClose={jest.fn()} onSelect={jest.fn()} />
    );

    await flushUi();
    await waitFor(() => expect(screen.queryByText('🗑️')).toBeTruthy());
    const deleteButton = screen.getByText('🗑️');
    expect(deleteButton).toBeTruthy();

    fireEvent.press((deleteButton.parent as any) ?? deleteButton);

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
