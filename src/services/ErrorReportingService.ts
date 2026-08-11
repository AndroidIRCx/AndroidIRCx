/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  getCrashlytics,
  setUserId as crashlyticsSetUserId,
  setAttribute as crashlyticsSetAttribute,
  log as crashlyticsLog,
  recordError as crashlyticsRecordError,
} from '@react-native-firebase/crashlytics';
import { Linking, Platform } from 'react-native';
import { logger } from './Logger';
import { tx } from '../i18n/transifex';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

// Patterns to sanitize sensitive data from Crashlytics extras
const SENSITIVE_KEYS = [
  'password',
  'pass',
  'secret',
  'token',
  'key',
  'auth',
  'credential',
  'sasl',
  'oauth',
  'apikey',
  'api_key',
  'bearer',
  'certificate',
  'cert',
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
const MAX_SANITIZE_DEPTH = 5;
const MAX_OBJECT_KEYS = 50;
const MAX_ARRAY_ITEMS = 25;
const MAX_STRING_LENGTH = 2048;

const REDACTED = '[REDACTED]';
const CIRCULAR = '[Circular]';
const TRUNCATED = '[TRUNCATED]';

function isSensitiveKey(key: string): boolean {
  const keyLower = key.toLowerCase();
  return SENSITIVE_KEYS.some(sensitive => keyLower.includes(sensitive));
}

function sanitizeString(value: string): string {
  let sanitizedValue = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    sanitizedValue = sanitizedValue.replace(pattern, REDACTED);
  }
  if (sanitizedValue.length > MAX_STRING_LENGTH) {
    return `${sanitizedValue.slice(0, MAX_STRING_LENGTH)}${TRUNCATED}`;
  }
  return sanitizedValue;
}

function sanitizeValue(
  value: any,
  key: string,
  depth: number,
  seen: WeakSet<object>,
): any {
  if (isSensitiveKey(key)) {
    return REDACTED;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    return `[${typeof value}]`;
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return TRUNCATED;
  }

  if (value instanceof Error) {
    return {
      name: sanitizeString(value.name),
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return CIRCULAR;
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const sanitizedArray = value
        .slice(0, MAX_ARRAY_ITEMS)
        .map(item => sanitizeValue(item, '', depth + 1, seen));
      if (value.length > MAX_ARRAY_ITEMS) {
        sanitizedArray.push(TRUNCATED);
      }
      return sanitizedArray;
    }

    const sanitized: Record<string, any> = {};
    const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
    for (const [entryKey, entryValue] of entries) {
      sanitized[entryKey] = sanitizeValue(
        entryValue,
        entryKey,
        depth + 1,
        seen,
      );
    }
    if (Object.keys(value).length > MAX_OBJECT_KEYS) {
      sanitized.__truncatedKeys = Object.keys(value).length - MAX_OBJECT_KEYS;
    }
    return sanitized;
  } finally {
    seen.delete(value);
  }
}

function safeStringify(value: any): string {
  try {
    return JSON.stringify(value) ?? JSON.stringify(TRUNCATED);
  } catch {
    return JSON.stringify(TRUNCATED);
  }
}

/**
 * Sanitize extras object to remove sensitive data before sending to Crashlytics
 */
function sanitizeExtras(extras: Record<string, any>): Record<string, any> {
  return sanitizeValue(extras, '', 0, new WeakSet<object>());
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
      await crashlyticsSetUserId(getCrashlytics(), userId);
    } catch {
      // ignore
    }
  }

  async report(error: any, context?: ErrorContext): Promise<void> {
    const normalizedError = this.normalizeError(error);
    const { fatal = false, source, tags, extras } = context || {};
    const sanitizedSource = source ? sanitizeString(source) : undefined;

    // Always keep a console log if logger is enabled
    logger.error(
      sanitizedSource || 'error',
      sanitizeString(normalizedError.message),
    );

    // Only push fatal crashes to Crashlytics; non-fatals stay local
    if (!fatal) return;

    try {
      if (tags) {
        Object.entries(tags).forEach(([key, value]) => {
          try {
            crashlyticsSetAttribute(
              getCrashlytics(),
              key,
              isSensitiveKey(key) ? REDACTED : sanitizeString(String(value)),
            );
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
            crashlyticsLog(getCrashlytics(), `${key}: ${safeStringify(value)}`);
          } catch {
            // ignore
          }
        });
      }

      if (sanitizedSource) {
        try {
          crashlyticsSetAttribute(getCrashlytics(), 'source', sanitizedSource);
        } catch {
          // ignore
        }
      }

      await crashlyticsRecordError(getCrashlytics(), normalizedError);
    } catch (err) {
      console.warn(
        'ErrorReportingService: Crashlytics failed, using mail fallback',
        err,
      );
      this.tryMailFallback(normalizedError, {
        ...(context || {}),
        source: sanitizedSource,
      });
    }
  }

  log(message: string): void {
    if (!this.enabled) return;
    try {
      crashlyticsLog(getCrashlytics(), sanitizeString(message));
    } catch {
      // ignore
    }
  }

  private normalizeError(error: any): Error {
    if (error instanceof Error) return error;
    if (typeof error === 'string') return new Error(error);
    if (error && typeof error === 'object') {
      const sanitized = sanitizeValue(error, '', 0, new WeakSet<object>());
      return new Error(safeStringify(sanitized));
    }
    return new Error(t('Unknown error'));
  }

  private async tryMailFallback(
    error: Error,
    context?: ErrorContext,
  ): Promise<void> {
    const fatalValue = context?.fatal ? t('Yes') : t('No');
    const safeMessage = sanitizeString(error.message);
    const safeStack = error.stack ? sanitizeString(error.stack) : t('n/a');
    const body = [
      t('Crash report fallback'),
      t('Platform: {platform}', { platform: Platform.OS }),
      t('Fatal: {value}', { value: fatalValue }),
      context?.source ? t('Source: {source}', { source: context.source }) : '',
      '',
      t('Message: {message}', { message: safeMessage }),
      t('Stack: {stack}', { stack: safeStack }),
    ]
      .filter(Boolean)
      .join('\n');

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
