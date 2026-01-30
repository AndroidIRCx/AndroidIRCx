/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crashlytics from '@react-native-firebase/crashlytics';
import { Linking, Platform } from 'react-native';
import { logger } from './Logger';
import { tx } from '../i18n/transifex';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

// Patterns to sanitize sensitive data from Crashlytics extras
const SENSITIVE_KEYS = [
  'password', 'pass', 'secret', 'token', 'key', 'auth', 'credential',
  'sasl', 'oauth', 'apikey', 'api_key', 'bearer', 'certificate', 'cert',
];
const SENSITIVE_VALUE_PATTERNS = [
  /password[=:\s]+\S+/gi,
  /pass[=:\s]+\S+/gi,
  /token[=:\s]+\S+/gi,
  /oauth[=:\s]+\S+/gi,
  /api[_-]?key[=:\s]+\S+/gi,
  /bearer\s+\S+/gi,
  /AUTHENTICATE\s+\S+/gi,
  /IDENTIFY\s+\S+/gi,
  /PASS\s+\S+/gi,
  /-----BEGIN[^-]+-----[\s\S]*?-----END[^-]+-----/g,
  /:[A-Za-z0-9+/=]{20,}/g, // Base64 credentials
];

/**
 * Sanitize extras object to remove sensitive data before sending to Crashlytics
 */
function sanitizeExtras(extras: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(extras)) {
    // Check if key contains sensitive words
    const keyLower = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sensitive => keyLower.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Sanitize string values
    if (typeof value === 'string') {
      let sanitizedValue = value;
      for (const pattern of SENSITIVE_VALUE_PATTERNS) {
        sanitizedValue = sanitizedValue.replace(pattern, '[REDACTED]');
      }
      sanitized[key] = sanitizedValue;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeExtras(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export interface ErrorContext {
  fatal?: boolean;
  source?: string;
  tags?: Record<string, string>;
  extras?: Record<string, any>;
}

class ErrorReportingService {
  private enabled = false;
  private fallbackEmail = 'admin@dbase.in.rs';

  async initialize(): Promise<void> {
    // Crashlytics collection is enabled by default; avoid deprecated setter warnings.
    this.enabled = true;
  }

  async setUserId(userId: string | null): Promise<void> {
    if (!this.enabled || !userId) return;
    try {
      await crashlytics().setUserId(userId);
    } catch {
      // ignore
    }
  }

  async report(error: any, context?: ErrorContext): Promise<void> {
    const normalizedError = this.normalizeError(error);
    const { fatal = false, source, tags, extras } = context || {};

    // Always keep a console log if logger is enabled
    logger.error(source || 'error', normalizedError.message);

    // Only push fatal crashes to Crashlytics; non-fatals stay local
    if (!fatal) return;

    try {
      if (tags) {
        Object.entries(tags).forEach(([key, value]) => {
          try {
            crashlytics().setAttribute(key, String(value));
          } catch {
            // ignore
          }
        });
      }

      if (extras) {
        // Sanitize extras to remove any sensitive data before sending to Crashlytics
        const sanitizedExtras = sanitizeExtras(extras);
        Object.entries(sanitizedExtras).forEach(([key, value]) => {
          try {
            crashlytics().log(`${key}: ${JSON.stringify(value)}`);
          } catch {
            // ignore
          }
        });
      }

      if (source) {
        try {
          crashlytics().setAttribute('source', source);
        } catch {
          // ignore
        }
      }

      await crashlytics().recordError(normalizedError);
    } catch (err) {
      console.warn('ErrorReportingService: Crashlytics failed, using mail fallback', err);
      this.tryMailFallback(normalizedError, context);
    }
  }

  log(message: string): void {
    if (!this.enabled) return;
    try {
      crashlytics().log(message);
    } catch {
      // ignore
    }
  }

  private normalizeError(error: any): Error {
    if (error instanceof Error) return error;
    if (typeof error === 'string') return new Error(error);
    if (error && typeof error === 'object') {
      return new Error(JSON.stringify(error));
    }
    return new Error(t('Unknown error'));
  }

  private async tryMailFallback(error: Error, context?: ErrorContext): Promise<void> {
    const fatalValue = context?.fatal ? t('Yes') : t('No');
    const body = [
      t('Crash report fallback'),
      t('Platform: {platform}', { platform: Platform.OS }),
      t('Fatal: {value}', { value: fatalValue }),
      context?.source ? t('Source: {source}', { source: context.source }) : '',
      '',
      t('Message: {message}', { message: error.message }),
      t('Stack: {stack}', { stack: error.stack || t('n/a') }),
    ].filter(Boolean).join('\n');

    const mailto = `mailto:${this.fallbackEmail}?subject=${encodeURIComponent(t('AndroidIRCX Crash Report'))}&body=${encodeURIComponent(body)}`;
    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (canOpen) {
        Linking.openURL(mailto);
      }
    } catch (err) {
      console.warn('ErrorReportingService: Mail fallback failed', err);
    }
  }
}

export const errorReportingService = new ErrorReportingService();
