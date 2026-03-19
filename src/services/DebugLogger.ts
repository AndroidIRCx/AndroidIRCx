/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DebugLogCategory, performanceService } from './PerformanceService';

class DebugLogger {
  private shouldLog(category: DebugLogCategory): boolean {
    const service = performanceService as {
      isDebugLoggingEnabled?: (logCategory: DebugLogCategory) => boolean;
      getConfig?: () => {
        debugLoggingEnabled?: boolean;
        debugLogCategories?: Partial<Record<DebugLogCategory, boolean>>;
      };
    };

    if (typeof service.isDebugLoggingEnabled === 'function') {
      return service.isDebugLoggingEnabled(category);
    }

    return false;
  }

  debug(category: DebugLogCategory, ...args: unknown[]): void {
    if (!this.shouldLog(category)) {
      return;
    }
    console.log(`[${category}]`, ...args);
  }

  warn(category: DebugLogCategory, ...args: unknown[]): void {
    if (!this.shouldLog(category)) {
      return;
    }
    console.warn(`[${category}]`, ...args);
  }
}

export const debugLogger = new DebugLogger();
