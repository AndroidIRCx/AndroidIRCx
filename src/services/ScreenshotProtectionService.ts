/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NativeModules, Platform } from 'react-native';

interface ScreenshotProtectionNativeModule {
  setScreenshotProtectionEnabled: (enabled: boolean) => Promise<void>;
}

const getScreenshotProtectionModule = ():
  ScreenshotProtectionNativeModule | undefined => {
  if (Platform.OS !== 'android') {
    return undefined;
  }

  return NativeModules?.ScreenshotProtectionModule;
};

class ScreenshotProtectionService {
  async setAllowScreenshots(allowScreenshots: boolean): Promise<void> {
    const screenshotProtectionModule = getScreenshotProtectionModule();
    if (!screenshotProtectionModule) {
      return;
    }

    try {
      // Native API uses "protection enabled" semantics, while this service uses
      // "allow screenshots" semantics.
      const enableProtection = !allowScreenshots;
      await screenshotProtectionModule.setScreenshotProtectionEnabled(
        enableProtection,
      );
    } catch (error) {
      console.warn(
        '[ScreenshotProtectionService] Failed to update screenshot protection:',
        error,
      );
    }
  }
}

export const screenshotProtectionService = new ScreenshotProtectionService();
