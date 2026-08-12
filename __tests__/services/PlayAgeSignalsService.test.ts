/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for PlayAgeSignalsService
 * Covers the pure compliance/normalization helpers and the singleton service
 * (availability probing, retry behaviour, caching, and error paths) without a
 * full React Native environment.
 */

// Mutable native-module holder so individual tests can install or remove the
// PlayAgeSignalsModule and toggle the platform.
const mockCheckAgeSignals = jest.fn();
const mockIsAvailable = jest.fn();

jest.mock('react-native', () => {
  return {
    NativeModules: {},
    Platform: {
      OS: 'android',
      select: jest.fn((obj: any) => obj.android),
    },
  };
});

// Import after mocks
import {
  evaluateAgeSignalCompliance,
  normalizeAgeSignalsError,
  playAgeSignalsService,
} from '../../src/services/PlayAgeSignalsService';

const RN = require('react-native');

const installNativeModule = () => {
  RN.NativeModules.PlayAgeSignalsModule = {
    checkAgeSignals: mockCheckAgeSignals,
    isAvailable: mockIsAvailable,
  };
};

const removeNativeModule = () => {
  delete RN.NativeModules.PlayAgeSignalsModule;
};

const baseSignal = {
  userStatus: 'VERIFIED' as const,
  userStatusCode: 0,
  ageLower: 18,
  ageUpper: null,
  installId: null,
  mostRecentApprovalDate: null,
};

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  RN.Platform.OS = 'android';
  installNativeModule();
  // Neutralise the exponential backoff so retry tests do not rely on timers.
  jest
    .spyOn(playAgeSignalsService as any, 'delay')
    .mockResolvedValue(undefined);
  // Reset cached state on the singleton.
  (playAgeSignalsService as any).lastSignal = null;
  (playAgeSignalsService as any).lastDecision = null;
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('evaluateAgeSignalCompliance', () => {
  it('allows users when Play returns no applicable/shared age signal', () => {
    const decision = evaluateAgeSignalCompliance(null);

    expect(decision.allowed).toBe(true);
    expect(decision.restrictedMode).toBe(false);
    expect(decision.signal).toBeNull();
  });

  it('allows users when the signal has a null userStatus', () => {
    const decision = evaluateAgeSignalCompliance({
      ...baseSignal,
      userStatus: null,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.restrictedMode).toBe(false);
  });

  it('blocks supervised accounts when parent approval is denied', () => {
    const decision = evaluateAgeSignalCompliance({
      ...baseSignal,
      userStatus: 'SUPERVISED_APPROVAL_DENIED',
      userStatusCode: 3,
      ageLower: 13,
      ageUpper: 15,
      installId: 'install-id',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.restrictedMode).toBe(true);
  });

  it('blocks age ranges entirely below 13', () => {
    const decision = evaluateAgeSignalCompliance({
      ...baseSignal,
      userStatus: 'DECLARED',
      userStatusCode: 5,
      ageLower: 0,
      ageUpper: 12,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.restrictedMode).toBe(true);
  });

  it('allows but flags pending or unknown statuses as restricted mode', () => {
    const pending = evaluateAgeSignalCompliance({
      ...baseSignal,
      userStatus: 'SUPERVISED_APPROVAL_PENDING',
      userStatusCode: 2,
    });
    const unknown = evaluateAgeSignalCompliance({
      ...baseSignal,
      userStatus: 'UNKNOWN',
      userStatusCode: 4,
      ageLower: null,
      ageUpper: null,
    });

    expect(pending.allowed).toBe(true);
    expect(pending.restrictedMode).toBe(true);
    expect(unknown.allowed).toBe(true);
    expect(unknown.restrictedMode).toBe(true);
  });

  it('allows normal access for a verified adult signal', () => {
    const decision = evaluateAgeSignalCompliance({
      ...baseSignal,
      userStatus: 'VERIFIED',
      ageLower: 18,
      ageUpper: 25,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.restrictedMode).toBe(false);
    expect(decision.reason).toContain('normal access');
  });

  it('does not block when ageUpper equals the minimum allowed age', () => {
    const decision = evaluateAgeSignalCompliance({
      ...baseSignal,
      userStatus: 'DECLARED',
      ageLower: 13,
      ageUpper: 13,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.restrictedMode).toBe(false);
  });
});

describe('normalizeAgeSignalsError', () => {
  it('marks known negative codes as retryable', () => {
    const result = normalizeAgeSignalsError({
      code: '-3',
      message: 'transient failure',
    });

    expect(result.code).toBe('-3');
    expect(result.message).toBe('transient failure');
    expect(result.retryable).toBe(true);
  });

  it('extracts the trailing numeric code from a prefixed code', () => {
    const result = normalizeAgeSignalsError({ code: 'ERR-2' });

    expect(result.code).toBe('ERR-2');
    expect(result.retryable).toBe(true);
  });

  it('falls back to nativeErrorCode when code is absent', () => {
    const result = normalizeAgeSignalsError({ nativeErrorCode: '-8' });

    expect(result.code).toBe('-8');
    expect(result.retryable).toBe(true);
  });

  it('treats unknown/non-numeric codes as non-retryable', () => {
    const result = normalizeAgeSignalsError({ code: 'FATAL' });

    expect(result.code).toBe('FATAL');
    expect(result.retryable).toBe(false);
  });

  it('treats out-of-range numeric codes as non-retryable', () => {
    const result = normalizeAgeSignalsError({ code: '-99' });

    expect(result.retryable).toBe(false);
  });

  it('uses default code/message when the error is null', () => {
    const result = normalizeAgeSignalsError(null);

    expect(result.code).toBe('UNKNOWN');
    expect(result.message).toBe('Play Age Signals request failed');
    expect(result.retryable).toBe(false);
  });
});

describe('PlayAgeSignalsService.checkAvailability', () => {
  it('returns false on non-Android platforms', async () => {
    RN.Platform.OS = 'ios';

    await expect(playAgeSignalsService.checkAvailability()).resolves.toBe(
      false,
    );
    expect(mockIsAvailable).not.toHaveBeenCalled();
  });

  it('returns false when the native module is missing', async () => {
    removeNativeModule();

    await expect(playAgeSignalsService.checkAvailability()).resolves.toBe(
      false,
    );
  });

  it('returns the native isAvailable result', async () => {
    mockIsAvailable.mockResolvedValue(true);

    await expect(playAgeSignalsService.checkAvailability()).resolves.toBe(true);
    expect(mockIsAvailable).toHaveBeenCalledTimes(1);
  });

  it('returns false when the native isAvailable call rejects', async () => {
    mockIsAvailable.mockRejectedValue(new Error('boom'));

    await expect(playAgeSignalsService.checkAvailability()).resolves.toBe(
      false,
    );
  });
});

describe('PlayAgeSignalsService.requestAgeSignals', () => {
  it('returns null on non-Android platforms', async () => {
    RN.Platform.OS = 'ios';

    await expect(playAgeSignalsService.requestAgeSignals()).resolves.toBeNull();
    expect(mockCheckAgeSignals).not.toHaveBeenCalled();
  });

  it('returns null when the native module is missing', async () => {
    removeNativeModule();

    await expect(playAgeSignalsService.requestAgeSignals()).resolves.toBeNull();
  });

  it('returns the signal and caches signal/decision on success', async () => {
    const signal = {
      ...baseSignal,
      userStatus: 'VERIFIED' as const,
      ageUpper: 30,
    };
    mockCheckAgeSignals.mockResolvedValue(signal);

    const result = await playAgeSignalsService.requestAgeSignals();

    expect(result).toBe(signal);
    expect(playAgeSignalsService.getLastSignal()).toBe(signal);
    expect(playAgeSignalsService.getLastDecision()?.allowed).toBe(true);
    expect(mockCheckAgeSignals).toHaveBeenCalledTimes(1);
  });

  it('retries on a retryable error and succeeds on a later attempt', async () => {
    const signal = { ...baseSignal };
    mockCheckAgeSignals
      .mockRejectedValueOnce({ code: '-1', message: 'retry me' })
      .mockResolvedValueOnce(signal);

    const result = await playAgeSignalsService.requestAgeSignals(3);

    expect(result).toBe(signal);
    expect(mockCheckAgeSignals).toHaveBeenCalledTimes(2);
    expect((playAgeSignalsService as any).delay).toHaveBeenCalledTimes(1);
  });

  it('stops immediately on a non-retryable error and clears cached state', async () => {
    mockCheckAgeSignals.mockRejectedValue({ code: 'FATAL', message: 'nope' });

    const result = await playAgeSignalsService.requestAgeSignals(3);

    expect(result).toBeNull();
    expect(mockCheckAgeSignals).toHaveBeenCalledTimes(1);
    expect(playAgeSignalsService.getLastSignal()).toBeNull();
    expect(playAgeSignalsService.getLastDecision()?.allowed).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('exhausts all attempts on repeated retryable errors', async () => {
    mockCheckAgeSignals.mockRejectedValue({ code: '-2', message: 'again' });

    const result = await playAgeSignalsService.requestAgeSignals(2);

    expect(result).toBeNull();
    expect(mockCheckAgeSignals).toHaveBeenCalledTimes(2);
    // Backoff only runs between attempts, not after the last one.
    expect((playAgeSignalsService as any).delay).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('PlayAgeSignalsService.getComplianceDecision', () => {
  it('derives and caches a decision from a fresh signal', async () => {
    const signal = {
      ...baseSignal,
      userStatus: 'SUPERVISED_APPROVAL_DENIED' as const,
      ageLower: 13,
      ageUpper: 15,
    };
    mockCheckAgeSignals.mockResolvedValue(signal);

    const decision = await playAgeSignalsService.getComplianceDecision();

    expect(decision.allowed).toBe(false);
    expect(decision.restrictedMode).toBe(true);
    expect(playAgeSignalsService.getLastDecision()).toBe(decision);
  });

  it('returns an allow decision when no signal is available', async () => {
    removeNativeModule();

    const decision = await playAgeSignalsService.getComplianceDecision();

    expect(decision.allowed).toBe(true);
    expect(decision.restrictedMode).toBe(false);
    expect(decision.signal).toBeNull();
  });
});

describe('PlayAgeSignalsService cache accessors', () => {
  it('returns null before any request is made', () => {
    expect(playAgeSignalsService.getLastSignal()).toBeNull();
    expect(playAgeSignalsService.getLastDecision()).toBeNull();
  });
});

describe('PlayAgeSignalsService.delay', () => {
  it('resolves after the requested time using a real timer', async () => {
    jest.useFakeTimers();
    // Undo the suite-level stub so the genuine implementation runs.
    (playAgeSignalsService as any).delay.mockRestore();

    const promise = (playAgeSignalsService as any).delay(500) as Promise<void>;
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    jest.advanceTimersByTime(500);
    await promise;

    expect(resolved).toBe(true);
    jest.useRealTimers();
  });
});
