/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ErrorReportingService
 */

import { errorReportingService, ErrorContext } from '../../src/services/ErrorReportingService';
import { Linking } from 'react-native';

// Mock dependencies
const mockCrashlytics = {
  setUserId: jest.fn().mockResolvedValue(undefined),
  setAttribute: jest.fn().mockResolvedValue(undefined),
  log: jest.fn().mockResolvedValue(undefined),
  recordError: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@react-native-firebase/crashlytics', () => {
  return () => mockCrashlytics;
});

jest.mock('../../src/services/Logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string, params?: any) => {
      if (params) {
        return key.replace(/\{(\w+)\}/g, (_, k) => params[k] || '');
      }
      return key;
    },
  },
}));

const { logger } = require('../../src/services/Logger');

describe('ErrorReportingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (errorReportingService as any).enabled = false;
  });

  describe('initialize', () => {
    it('should initialize and enable service', async () => {
      await errorReportingService.initialize();

      expect((errorReportingService as any).enabled).toBe(true);
    });

    it('should not throw on initialization', async () => {
      await expect(errorReportingService.initialize()).resolves.not.toThrow();
    });
  });

  describe('setUserId', () => {
    beforeEach(async () => {
      await errorReportingService.initialize();
    });

    it('should set user ID in crashlytics', async () => {
      await errorReportingService.setUserId('user123');

      expect(mockCrashlytics.setUserId).toHaveBeenCalledWith('user123');
    });

    it('should handle null user ID', async () => {
      await errorReportingService.setUserId(null);

      expect(mockCrashlytics.setUserId).not.toHaveBeenCalled();
    });

    it('should handle crashlytics errors gracefully', async () => {
      mockCrashlytics.setUserId.mockRejectedValueOnce(new Error('Crashlytics error'));

      await expect(errorReportingService.setUserId('user123')).resolves.not.toThrow();
    });

    it('should not call crashlytics when disabled', async () => {
      (errorReportingService as any).enabled = false;

      await errorReportingService.setUserId('user123');

      expect(mockCrashlytics.setUserId).not.toHaveBeenCalled();
    });
  });

  describe('report', () => {
    beforeEach(async () => {
      await errorReportingService.initialize();
    });

    it('should log error to logger', async () => {
      const error = new Error('Test error');
      await errorReportingService.report(error);

      expect(logger.error).toHaveBeenCalledWith('error', 'Test error');
    });

    it('should use custom source when provided', async () => {
      const error = new Error('Test error');
      const context: ErrorContext = { source: 'custom-source' };

      await errorReportingService.report(error, context);

      expect(logger.error).toHaveBeenCalledWith('custom-source', 'Test error');
    });

    it('should only report fatal errors to crashlytics', async () => {
      const error = new Error('Non-fatal error');
      await errorReportingService.report(error, { fatal: false });

      expect(mockCrashlytics.recordError).not.toHaveBeenCalled();

      const fatalError = new Error('Fatal error');
      await errorReportingService.report(fatalError, { fatal: true });

      expect(mockCrashlytics.recordError).toHaveBeenCalledWith(fatalError);
    });

    it('should set tags in crashlytics for fatal errors', async () => {
      const error = new Error('Fatal error');
      const context: ErrorContext = {
        fatal: true,
        tags: { environment: 'production', version: '1.0.0' },
      };

      await errorReportingService.report(error, context);

      expect(mockCrashlytics.setAttribute).toHaveBeenCalledWith('environment', 'production');
      expect(mockCrashlytics.setAttribute).toHaveBeenCalledWith('version', '1.0.0');
    });

    it('should log extras to crashlytics for fatal errors', async () => {
      const error = new Error('Fatal error');
      const context: ErrorContext = {
        fatal: true,
        extras: { userId: 123, metadata: { test: true } },
      };

      await errorReportingService.report(error, context);

      expect(mockCrashlytics.log).toHaveBeenCalledWith('userId: 123');
      expect(mockCrashlytics.log).toHaveBeenCalledWith(expect.stringContaining('"test":true'));
    });

    it('should redact sensitive keys and values before logging extras', async () => {
      const error = new Error('Fatal error');
      const context: ErrorContext = {
        fatal: true,
        extras: {
          password: 'supersecret',
          tokenInfo: 'token=abc123',
          nested: {
            api_key: 'key-123',
            authHeader: 'Bearer my-token',
          },
        },
      };

      await errorReportingService.report(error, context);

      expect(mockCrashlytics.log).toHaveBeenCalledWith('password: "[REDACTED]"');
      expect(mockCrashlytics.log).toHaveBeenCalledWith(
        expect.stringContaining('tokenInfo: "[REDACTED]"')
      );
      expect(mockCrashlytics.log).toHaveBeenCalledWith(
        expect.stringContaining('"api_key":"[REDACTED]"')
      );
      expect(mockCrashlytics.log).toHaveBeenCalledWith(
        expect.stringContaining('"authHeader":"[REDACTED]"')
      );
    });

    it('should set source attribute when provided', async () => {
      const error = new Error('Fatal error');
      const context: ErrorContext = {
        fatal: true,
        source: 'test-component',
      };

      await errorReportingService.report(error, context);

      expect(mockCrashlytics.setAttribute).toHaveBeenCalledWith('source', 'test-component');
    });

    it('should normalize string errors', async () => {
      await errorReportingService.report('String error', { fatal: true });

      expect(mockCrashlytics.recordError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'String error',
      }));
    });

    it('should normalize object errors', async () => {
      const errorObj = { code: 'ERR_001', message: 'Custom error' };
      await errorReportingService.report(errorObj, { fatal: true });

      expect(mockCrashlytics.recordError).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('ERR_001'),
      }));
    });

    it('should handle unknown error types', async () => {
      await errorReportingService.report(undefined, { fatal: true });

      expect(mockCrashlytics.recordError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Unknown error',
      }));
    });

    it('should skip mail open when fallback mailto cannot be opened', async () => {
      mockCrashlytics.recordError.mockRejectedValueOnce(new Error('Crashlytics failed'));
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(false);

      const error = new Error('Test error');
      await errorReportingService.report(error, { fatal: true, source: 'test-source' });

      expect(Linking.canOpenURL).toHaveBeenCalled();
      expect(Linking.openURL).not.toHaveBeenCalled();
    });

    it('should handle crashlytics errors with mail fallback', async () => {
      mockCrashlytics.recordError.mockRejectedValueOnce(new Error('Crashlytics failed'));
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);
      (Linking.openURL as jest.Mock).mockResolvedValueOnce(undefined);

      const error = new Error('Test error');
      await errorReportingService.report(error, { fatal: true });

      expect(Linking.canOpenURL).toHaveBeenCalled();
    });

    it('should handle mail fallback errors gracefully', async () => {
      mockCrashlytics.recordError.mockRejectedValueOnce(new Error('Crashlytics failed'));
      (Linking.canOpenURL as jest.Mock).mockRejectedValueOnce(new Error('Linking failed'));

      const error = new Error('Test error');
      await expect(errorReportingService.report(error, { fatal: true })).resolves.not.toThrow();
    });
  });

  describe('log', () => {
    beforeEach(async () => {
      await errorReportingService.initialize();
    });

    it('should log message to crashlytics', () => {
      errorReportingService.log('Test log message');

      expect(mockCrashlytics.log).toHaveBeenCalledWith('Test log message');
    });

    it('should handle crashlytics errors gracefully', () => {
      mockCrashlytics.log.mockImplementationOnce(() => {
        throw new Error('Crashlytics error');
      });

      expect(() => errorReportingService.log('Test message')).not.toThrow();
    });

    it('should not log when disabled', () => {
      (errorReportingService as any).enabled = false;

      errorReportingService.log('Test message');

      expect(mockCrashlytics.log).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await errorReportingService.initialize();
    });

    it('should handle errors with very long messages', async () => {
      const longMessage = 'a'.repeat(10000);
      const error = new Error(longMessage);

      await expect(errorReportingService.report(error)).resolves.not.toThrow();
    });

    it('should handle errors with special characters', async () => {
      const error = new Error('Error with "quotes" and \'apostrophes\' & <symbols>');

      await expect(errorReportingService.report(error)).resolves.not.toThrow();
    });

    it('should handle errors with newlines', async () => {
      const error = new Error('Error\nwith\nmultiple\nlines');

      await expect(errorReportingService.report(error)).resolves.not.toThrow();
    });

    it('should handle multiple rapid error reports', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(errorReportingService.report(new Error(`Error ${i}`)));
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalledTimes(10);
    });

    it('should handle empty tags object', async () => {
      const error = new Error('Test error');
      await errorReportingService.report(error, { fatal: true, tags: {} });

      expect(mockCrashlytics.recordError).toHaveBeenCalled();
    });

    it('should handle empty extras object', async () => {
      const error = new Error('Test error');
      await errorReportingService.report(error, { fatal: true, extras: {} });

      expect(mockCrashlytics.recordError).toHaveBeenCalled();
    });

    it('should handle circular references in extras', async () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      const error = new Error('Test error');

      // Should not throw on circular reference
      await expect(
        errorReportingService.report(error, { fatal: true, extras: { circular } })
      ).resolves.not.toThrow();
    });

    it('should continue reporting when setAttribute throws for tags and source', async () => {
      mockCrashlytics.setAttribute
        .mockImplementationOnce(() => {
          throw new Error('tag failed');
        })
        .mockImplementationOnce(() => {
          throw new Error('source failed');
        });

      await errorReportingService.report(new Error('Fatal error'), {
        fatal: true,
        source: 'test-source',
        tags: { env: 'prod' },
      });

      expect(mockCrashlytics.recordError).toHaveBeenCalled();
    });

    it('should continue reporting when crashlytics log throws for extras', async () => {
      mockCrashlytics.log.mockImplementationOnce(() => {
        throw new Error('log failed');
      });

      await errorReportingService.report(new Error('Fatal error'), {
        fatal: true,
        extras: { note: 'hello' },
      });

      expect(mockCrashlytics.recordError).toHaveBeenCalled();
    });
  });

  describe('error normalization', () => {
    beforeEach(async () => {
      await errorReportingService.initialize();
    });

    it('should preserve Error instances', async () => {
      const error = new Error('Test error');
      await errorReportingService.report(error, { fatal: true });

      expect(mockCrashlytics.recordError).toHaveBeenCalledWith(error);
    });

    it('should convert strings to Error objects', async () => {
      await errorReportingService.report('String error', { fatal: true });

      const recordedError = (mockCrashlytics.recordError as jest.Mock).mock.calls[0][0];
      expect(recordedError).toBeInstanceOf(Error);
      expect(recordedError.message).toBe('String error');
    });

    it('should convert objects to Error with JSON string', async () => {
      const errorObj = { code: 500, message: 'Server error' };
      await errorReportingService.report(errorObj, { fatal: true });

      const recordedError = (mockCrashlytics.recordError as jest.Mock).mock.calls[0][0];
      expect(recordedError).toBeInstanceOf(Error);
      expect(recordedError.message).toContain('500');
      expect(recordedError.message).toContain('Server error');
    });

    it('should handle null/undefined errors', async () => {
      await errorReportingService.report(null, { fatal: true });
      await errorReportingService.report(undefined, { fatal: true });

      expect(mockCrashlytics.recordError).toHaveBeenCalledTimes(2);
    });
  });
});
