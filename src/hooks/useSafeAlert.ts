/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import type { MutableRefObject } from 'react';

interface PendingAlertPayload {
  title: string;
  message?: string;
  buttons?: any;
}

interface UseSafeAlertParams {
  appStateRef: MutableRefObject<string>;
  pendingAlertRef: MutableRefObject<PendingAlertPayload | null>;
}

export const useSafeAlert = (params: UseSafeAlertParams) => {
  const { appStateRef, pendingAlertRef } = params;

  const safeAlert = useCallback(
    (title: string, message?: string, buttons?: any) => {
      const payload: PendingAlertPayload = {
        title: String(title),
        message: message ? String(message) : undefined,
        buttons,
      };
      if (appStateRef.current === 'active') {
        Alert.alert(payload.title, payload.message, payload.buttons);
        return;
      }
      pendingAlertRef.current = payload;
    },
    [appStateRef, pendingAlertRef],
  );

  return { safeAlert };
};
