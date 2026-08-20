/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useReviewPrompt.ts
 *
 * Counts one app launch and, if the user is eligible, shows the review
 * questionnaire once per app session. Runs only after the app is ready so the
 * dialog never races the first-run/setup flow.
 */

import { useEffect, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';
import { reviewPromptService } from '../services/ReviewPromptService';

interface UseReviewPromptParams {
  /** True once initial data has loaded and the UI is interactive. */
  ready: boolean;
}

export const useReviewPrompt = ({ ready }: UseReviewPromptParams): void => {
  const setShowReviewPrompt = useUIStore(state => state.setShowReviewPrompt);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!ready || ranRef.current) {
      return;
    }
    ranRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        await reviewPromptService.registerLaunch();
        const shouldPrompt = await reviewPromptService.shouldPrompt();
        if (shouldPrompt && !cancelled) {
          await reviewPromptService.markPrompted();
          setShowReviewPrompt(true);
        }
      } catch {
        // Never let a rating nudge break app startup.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, setShowReviewPrompt]);
};
