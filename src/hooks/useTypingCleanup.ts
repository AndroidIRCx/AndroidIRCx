/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect } from 'react';
import { useMessageStore } from '../stores/messageStore';

export const useTypingCleanup = () => {
  useEffect(() => {
    const TYPING_TIMEOUT = 5000; // 5 seconds
    const interval = setInterval(() => {
      useMessageStore.getState().cleanupStaleTyping(TYPING_TIMEOUT);
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, []);
};
