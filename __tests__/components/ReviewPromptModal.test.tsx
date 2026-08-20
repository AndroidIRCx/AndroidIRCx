/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ReviewPromptModal component.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ReviewPromptModal } from '../../src/components/ReviewPromptModal';
import { reviewPromptService } from '../../src/services/ReviewPromptService';

jest.mock('../../src/services/ReviewPromptService', () => ({
  reviewPromptService: {
    rateNow: jest.fn().mockResolvedValue(true),
    remindLater: jest.fn().mockResolvedValue(undefined),
    dismissForever: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('ReviewPromptModal', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the three choices when visible', async () => {
    const { getByText } = await render(
      <ReviewPromptModal visible onClose={onClose} />,
    );
    expect(getByText('Rate on Play Store')).toBeTruthy();
    expect(getByText('Remind me later')).toBeTruthy();
    expect(getByText("Don't ask again")).toBeTruthy();
  });

  it('rates and closes when the primary button is pressed', async () => {
    const { getByText } = await render(
      <ReviewPromptModal visible onClose={onClose} />,
    );
    fireEvent.press(getByText('Rate on Play Store'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(reviewPromptService.rateNow).toHaveBeenCalledTimes(1),
    );
  });

  it('snoozes and closes when "Remind me later" is pressed', async () => {
    const { getByText } = await render(
      <ReviewPromptModal visible onClose={onClose} />,
    );
    fireEvent.press(getByText('Remind me later'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(reviewPromptService.remindLater).toHaveBeenCalledTimes(1),
    );
  });

  it('opts out and closes when "Don\'t ask again" is pressed', async () => {
    const { getByText } = await render(
      <ReviewPromptModal visible onClose={onClose} />,
    );
    fireEvent.press(getByText("Don't ask again"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(reviewPromptService.dismissForever).toHaveBeenCalledTimes(1),
    );
  });
});
