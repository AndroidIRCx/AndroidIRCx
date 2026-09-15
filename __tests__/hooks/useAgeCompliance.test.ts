/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useAgeCompliance hook
 */

import { renderHook, waitFor } from '@testing-library/react-native';

// Let any pending async work settle after unmount so we can assert the hook
// never touches state on an unmounted component.
const flushMicrotasks = () => new Promise(resolve => setImmediate(resolve));

// Mock the PlayAgeSignalsService the hook depends on.
const mockGetComplianceDecision = jest.fn();
const nullDecision = {
  allowed: true,
  restrictedMode: false,
  reason: 'not applicable',
  signal: null,
};

jest.mock('../../src/services/PlayAgeSignalsService', () => ({
  __esModule: true,
  evaluateAgeSignalCompliance: jest.fn(() => nullDecision),
  playAgeSignalsService: {
    getComplianceDecision: (...args: any[]) =>
      mockGetComplianceDecision(...args),
  },
}));

import { useAgeCompliance } from '../../src/hooks/useAgeCompliance';

describe('useAgeCompliance', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('starts in the checking state with the null-signal decision', async () => {
    // Never-resolving promise so the initial (checking) state is observable.
    mockGetComplianceDecision.mockReturnValue(new Promise(() => {}));

    const { result } = await renderHook(() => useAgeCompliance());

    expect(result.current.isChecking).toBe(true);
    expect(result.current.decision).toEqual(nullDecision);
  });

  it('resolves to the service decision on success', async () => {
    const allowedDecision = {
      allowed: true,
      restrictedMode: false,
      reason: 'user is old enough',
      signal: { userStatus: 'AGE_ALLOWED' },
    };
    mockGetComplianceDecision.mockResolvedValue(allowedDecision);

    const { result } = await renderHook(() => useAgeCompliance());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });
    expect(result.current.decision).toEqual(allowedDecision);
    expect(mockGetComplianceDecision).toHaveBeenCalledTimes(1);
  });

  it('applies a restricted decision from the service', async () => {
    const restricted = {
      allowed: false,
      restrictedMode: true,
      reason: 'under age',
      signal: { userStatus: 'AGE_RESTRICTED' },
    };
    mockGetComplianceDecision.mockResolvedValue(restricted);

    const { result } = await renderHook(() => useAgeCompliance());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });
    expect(result.current.decision).toEqual(restricted);
    expect(result.current.decision.restrictedMode).toBe(true);
  });

  it('falls back to the null-signal decision when the check throws', async () => {
    mockGetComplianceDecision.mockRejectedValue(new Error('native failure'));

    const { result } = await renderHook(() => useAgeCompliance());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });
    expect(result.current.decision).toEqual(nullDecision);
    expect(warnSpy).toHaveBeenCalledWith(
      'Age compliance check failed:',
      expect.any(Error),
    );
  });

  it('does not update state after unmount when the check resolves late', async () => {
    let resolveDecision: (d: any) => void = () => {};
    mockGetComplianceDecision.mockReturnValue(
      new Promise(resolve => {
        resolveDecision = resolve;
      }),
    );

    const { result, unmount } = await renderHook(() => useAgeCompliance());
    expect(result.current.isChecking).toBe(true);

    unmount();
    // Resolve after unmount — the cancelled guard must prevent a state update
    // (no act() is needed because no setState runs on the cancelled path).
    resolveDecision({
      allowed: false,
      restrictedMode: true,
      reason: 'late',
      signal: null,
    });
    await flushMicrotasks();

    // State is frozen at the last value seen before unmount.
    expect(result.current.isChecking).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not update state after unmount when the check rejects late', async () => {
    let rejectDecision: (e: any) => void = () => {};
    mockGetComplianceDecision.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectDecision = reject;
      }),
    );

    const { result, unmount } = await renderHook(() => useAgeCompliance());
    expect(result.current.isChecking).toBe(true);

    unmount();
    // Reject after unmount — the catch runs but the guard skips setState.
    rejectDecision(new Error('late failure'));
    await flushMicrotasks();

    expect(result.current.isChecking).toBe(true);
  });
});
