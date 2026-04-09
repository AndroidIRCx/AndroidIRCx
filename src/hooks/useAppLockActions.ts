/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback } from 'react';

interface UseAppLockActionsParams {
  appLockEnabled: boolean;
  appLockUseBiometric: boolean;
  appLocked: boolean;
  attemptBiometricUnlock: (isManualRetry?: boolean) => void;
  safeAlert: (title: string, message?: string, buttons?: any) => void;
  t: (key: string, options?: any) => string;
  setAppLocked: (value: boolean) => void;
  setAppUnlockModalVisible: (value: boolean) => void;
}

export const useAppLockActions = (params: UseAppLockActionsParams) => {
  const {
    appLockEnabled,
    appLockUseBiometric,
    appLocked,
    attemptBiometricUnlock,
    safeAlert,
    t,
    setAppLocked,
    setAppUnlockModalVisible,
  } = params;

  const handleLockButtonPress = useCallback(() => {
    if (!appLockEnabled) {
      safeAlert(
        t('App lock disabled', {
          _tags: 'screen:app,file:App.tsx,feature:lock',
        }),
        t('Enable app lock first.', {
          _tags: 'screen:app,file:App.tsx,feature:lock',
        }),
      );
      return;
    }
    if (appLocked) {
      if (appLockUseBiometric) {
        // User manually pressed lock button while locked - treat as manual retry
        attemptBiometricUnlock(true);
      } else {
        setAppUnlockModalVisible(true);
      }
      return;
    }
    setAppLocked(true);
    setAppUnlockModalVisible(true);
  }, [
    appLockEnabled,
    appLockUseBiometric,
    appLocked,
    attemptBiometricUnlock,
    safeAlert,
    setAppLocked,
    setAppUnlockModalVisible,
    t,
  ]);

  return { handleLockButtonPress };
};
