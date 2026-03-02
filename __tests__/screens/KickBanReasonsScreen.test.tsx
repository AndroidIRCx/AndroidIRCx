/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import KickBanReasonsScreen from '../../src/screens/KickBanReasonsScreen';
import { banService } from '../../src/services/BanService';

jest.mock('../../src/services/BanService', () => ({
  banService: {
    initialize: jest.fn(),
    getPredefinedReasons: jest.fn(),
    setPredefinedReasons: jest.fn(),
    resetToDefaultReasons: jest.fn(),
  },
}));

describe('KickBanReasonsScreen', () => {
  const mockReasons = [
    { id: '1', text: 'Spam' },
    { id: '2', text: 'Flood' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (banService.initialize as jest.Mock).mockResolvedValue(undefined);
    (banService.getPredefinedReasons as jest.Mock).mockReturnValue(mockReasons);
    (banService.setPredefinedReasons as jest.Mock).mockResolvedValue(undefined);
    (banService.resetToDefaultReasons as jest.Mock).mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('loads and renders predefined reasons', async () => {
    const { findByText, getByText } = render(
      <KickBanReasonsScreen navigation={{}} route={{}} />
    );

    expect(await findByText('Predefined Kick/Ban Reasons')).toBeTruthy();
    expect(getByText('Spam')).toBeTruthy();
    expect(getByText('Flood')).toBeTruthy();

    expect(banService.initialize).toHaveBeenCalled();
  });

  it('shows validation alert when adding empty reason', async () => {
    const { getByText } = render(
      <KickBanReasonsScreen navigation={{}} route={{}} />
    );

    await waitFor(() => expect(getByText('Add Reason')).toBeTruthy());
    fireEvent.press(getByText('Add Reason'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a reason to add.');
  });

  it('adds a new reason', async () => {
    const { getByPlaceholderText, getByText } = render(
      <KickBanReasonsScreen navigation={{}} route={{}} />
    );

    await waitFor(() => expect(getByText('Add Reason')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Enter new reason...'), 'Caps abuse');
    fireEvent.press(getByText('Add Reason'));

    await waitFor(() => {
      expect(banService.setPredefinedReasons).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ text: 'Caps abuse' })])
      );
    });
  });

  it('enters and cancels edit mode', async () => {
    const { getAllByText, getByDisplayValue, queryByDisplayValue } = render(
      <KickBanReasonsScreen navigation={{}} route={{}} />
    );

    await waitFor(() => expect(getAllByText('Edit').length).toBeGreaterThan(0));
    fireEvent.press(getAllByText('Edit')[0]);

    expect(getByDisplayValue('Spam')).toBeTruthy();
    fireEvent.press(getAllByText('Cancel')[0]);
    expect(queryByDisplayValue('Spam')).toBeNull();
  });

  it('saves edited reason', async () => {
    const { getAllByText, getByDisplayValue } = render(
      <KickBanReasonsScreen navigation={{}} route={{}} />
    );

    await waitFor(() => expect(getAllByText('Edit').length).toBeGreaterThan(0));
    fireEvent.press(getAllByText('Edit')[0]);
    fireEvent.changeText(getByDisplayValue('Spam'), 'Severe spam');
    fireEvent.press(getAllByText('Save')[0]);

    await waitFor(() => {
      expect(banService.setPredefinedReasons).toHaveBeenCalledWith([
        { id: '1', text: 'Severe spam' },
        { id: '2', text: 'Flood' },
      ]);
    });
  });

  it('moves a reason down', async () => {
    const { getAllByText } = render(
      <KickBanReasonsScreen navigation={{}} route={{}} />
    );

    await waitFor(() => expect(getAllByText('↓').length).toBeGreaterThan(0));
    fireEvent.press(getAllByText('↓')[0]);

    await waitFor(() => {
      expect(banService.setPredefinedReasons).toHaveBeenCalledWith([
        { id: '2', text: 'Flood' },
        { id: '1', text: 'Spam' },
      ]);
    });
  });

  it('opens delete confirmation and executes delete action', async () => {
    const { getAllByText } = render(
      <KickBanReasonsScreen navigation={{}} route={{}} />
    );

    await waitFor(() => expect(getAllByText('Delete').length).toBeGreaterThan(0));
    fireEvent.press(getAllByText('Delete')[0]);

    const deleteCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Delete Reason'
    );
    expect(deleteCall).toBeTruthy();

    const deleteButton = deleteCall?.[2]?.[1];
    await act(async () => {
      await deleteButton.onPress();
    });

    expect(banService.setPredefinedReasons).toHaveBeenCalledWith([
      { id: '2', text: 'Flood' },
    ]);
  });

  it('opens reset confirmation and resets to defaults', async () => {
    const resetReasons = [{ id: 'd1', text: 'Default reason' }];
    (banService.getPredefinedReasons as jest.Mock).mockReturnValue(resetReasons);

    const { getByText } = render(
      <KickBanReasonsScreen navigation={{}} route={{}} />
    );

    await waitFor(() => expect(getByText('Reset to Defaults')).toBeTruthy());
    fireEvent.press(getByText('Reset to Defaults'));

    const resetCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Reset to Defaults'
    );
    expect(resetCall).toBeTruthy();

    const resetButton = resetCall?.[2]?.[1];
    await act(async () => {
      await resetButton.onPress();
    });

    expect(banService.resetToDefaultReasons).toHaveBeenCalled();
    expect(banService.getPredefinedReasons).toHaveBeenCalled();
  });
});
