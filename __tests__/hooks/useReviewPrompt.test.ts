/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useReviewPrompt } from '../../src/hooks/useReviewPrompt';
import { reviewPromptService } from '../../src/services/ReviewPromptService';
import { useUIStore } from '../../src/stores/uiStore';

jest.mock('../../src/services/ReviewPromptService', () => ({
  reviewPromptService: {
    registerLaunch: jest.fn().mockResolvedValue(undefined),
    shouldPrompt: jest.fn().mockResolvedValue(false),
    markPrompted: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('useReviewPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUIStore.getState().setShowReviewPrompt(false);
  });

  it('does nothing until the app is ready', async () => {
    await renderHook(() => useReviewPrompt({ ready: false }));
    expect(reviewPromptService.registerLaunch).not.toHaveBeenCalled();
    expect(useUIStore.getState().showReviewPrompt).toBe(false);
  });

  it('counts a launch but does not prompt when ineligible', async () => {
    (reviewPromptService.shouldPrompt as jest.Mock).mockResolvedValue(false);
    await renderHook(() => useReviewPrompt({ ready: true }));
    await waitFor(() =>
      expect(reviewPromptService.registerLaunch).toHaveBeenCalledTimes(1),
    );
    expect(reviewPromptService.markPrompted).not.toHaveBeenCalled();
    expect(useUIStore.getState().showReviewPrompt).toBe(false);
  });

  it('shows the prompt once when eligible', async () => {
    (reviewPromptService.shouldPrompt as jest.Mock).mockResolvedValue(true);
    await renderHook(() => useReviewPrompt({ ready: true }));
    await waitFor(() =>
      expect(useUIStore.getState().showReviewPrompt).toBe(true),
    );
    expect(reviewPromptService.markPrompted).toHaveBeenCalledTimes(1);
  });

  it('only runs the eligibility check once per session', async () => {
    (reviewPromptService.shouldPrompt as jest.Mock).mockResolvedValue(false);
    const { rerender } = await renderHook(
      ({ ready }) => useReviewPrompt({ ready }),
      { initialProps: { ready: true } },
    );
    await waitFor(() =>
      expect(reviewPromptService.registerLaunch).toHaveBeenCalledTimes(1),
    );
    rerender({ ready: true });
    expect(reviewPromptService.registerLaunch).toHaveBeenCalledTimes(1);
  });
});
