import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NetworkPickerModal } from '../../../src/components/modals/NetworkPickerModal';

const mockLoadNetworks = jest.fn();

jest.mock('../../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: (...args: unknown[]) => mockLoadNetworks(...args),
  },
}));

jest.mock('../../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      surface: '#111',
      border: '#222',
      text: '#fff',
      textSecondary: '#999',
      primary: '#08f',
    },
  }),
}));

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

describe('NetworkPickerModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and renders networks with recommended first', async () => {
    mockLoadNetworks.mockResolvedValue([
      { name: 'Zeta', nick: 'z', servers: [{ connectionType: 'plain' }] },
      { name: 'DBase', nick: 'd', servers: [{ connectionType: 'znc' }] },
      { name: 'Alpha', nick: 'a', servers: [] },
    ]);

    const onSelectNetwork = jest.fn();
    const { getByText } = render(
      <NetworkPickerModal
        visible
        onClose={jest.fn()}
        onSelectNetwork={onSelectNetwork}
        onCreateNew={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(getByText('DBase')).toBeTruthy();
      expect(getByText('Alpha')).toBeTruthy();
      expect(getByText('Zeta')).toBeTruthy();
    });

    fireEvent.press(getByText('DBase'));
    expect(onSelectNetwork).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'DBase' })
    );
    expect(getByText('Recommended')).toBeTruthy();
  });

  it('shows empty state and supports create new + cancel', async () => {
    mockLoadNetworks.mockResolvedValue([]);

    const onCreateNew = jest.fn();
    const onClose = jest.fn();

    const { getByText } = render(
      <NetworkPickerModal
        visible
        onClose={onClose}
        onSelectNetwork={jest.fn()}
        onCreateNew={onCreateNew}
      />
    );

    await waitFor(() => {
      expect(getByText('No Networks')).toBeTruthy();
    });

    fireEvent.press(getByText('Create New Network'));
    fireEvent.press(getByText('Cancel'));

    expect(onCreateNew).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
