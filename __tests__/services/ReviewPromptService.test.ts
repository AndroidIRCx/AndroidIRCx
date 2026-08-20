/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { reviewPromptService } from '../../src/services/ReviewPromptService';
import { APP_VERSION } from '../../src/config/appVersion';

const DAY_MS = 24 * 60 * 60 * 1000;
const STATE_KEY = '@AndroidIRCX:reviewPrompt';
const MARKET_URL = 'market://details?id=com.androidircx';
const WEB_URL = 'https://play.google.com/store/apps/details?id=com.androidircx';

// A fixed "now" so time-based eligibility is deterministic.
const NOW = 1_800_000_000_000;

describe('ReviewPromptService', () => {
  beforeEach(async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    await reviewPromptService.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Force the persisted state to a known shape and clear the in-memory cache. */
  const seed = async (partial: Record<string, unknown>) => {
    await AsyncStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        status: 'active',
        baselineVersion: APP_VERSION,
        launches: 0,
        firstSeenAt: 0,
        remindAfter: 0,
        lastPromptedAt: 0,
        ...partial,
      }),
    );
    await reviewPromptService.reset();
    // reset() wipes storage, so re-seed after clearing the cache.
    await AsyncStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        status: 'active',
        baselineVersion: APP_VERSION,
        launches: 0,
        firstSeenAt: 0,
        remindAfter: 0,
        lastPromptedAt: 0,
        ...partial,
      }),
    );
  };

  it('starts with a default active state at the current app version', async () => {
    const state = await reviewPromptService.getState();
    expect(state.status).toBe('active');
    expect(state.baselineVersion).toBe(APP_VERSION);
    expect(state.launches).toBe(0);
  });

  it('registerLaunch increments the count and stamps firstSeenAt once', async () => {
    await reviewPromptService.registerLaunch();
    let state = await reviewPromptService.getState();
    expect(state.launches).toBe(1);
    expect(state.firstSeenAt).toBe(NOW);

    (Date.now as jest.Mock).mockReturnValue(NOW + 10_000);
    await reviewPromptService.registerLaunch();
    state = await reviewPromptService.getState();
    expect(state.launches).toBe(2);
    expect(state.firstSeenAt).toBe(NOW); // unchanged
  });

  it('does not count launches once the user has a terminal status', async () => {
    await seed({ status: 'dismissed', launches: 3 });
    await reviewPromptService.registerLaunch();
    const state = await reviewPromptService.getState();
    expect(state.launches).toBe(3);
  });

  it('shouldPrompt is false before enough launches', async () => {
    await seed({ launches: 1, firstSeenAt: NOW - 5 * DAY_MS });
    expect(await reviewPromptService.shouldPrompt()).toBe(false);
  });

  it('shouldPrompt is false before enough days have passed', async () => {
    await seed({ launches: 10, firstSeenAt: NOW - 1 * DAY_MS });
    expect(await reviewPromptService.shouldPrompt()).toBe(false);
  });

  it('shouldPrompt is true once launches and elapsed time both qualify', async () => {
    await seed({ launches: 5, firstSeenAt: NOW - 3 * DAY_MS });
    expect(await reviewPromptService.shouldPrompt()).toBe(true);
  });

  it('shouldPrompt is false while snoozed and true after the snooze ends', async () => {
    await seed({
      launches: 5,
      firstSeenAt: NOW - 3 * DAY_MS,
      remindAfter: NOW + DAY_MS,
    });
    expect(await reviewPromptService.shouldPrompt()).toBe(false);

    (Date.now as jest.Mock).mockReturnValue(NOW + 2 * DAY_MS);
    expect(await reviewPromptService.shouldPrompt()).toBe(true);
  });

  it('rateNow marks rated and opens the market URL', async () => {
    await seed({ launches: 5, firstSeenAt: NOW - 3 * DAY_MS });
    const ok = await reviewPromptService.rateNow();
    expect(ok).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith(MARKET_URL);
    const state = await reviewPromptService.getState();
    expect(state.status).toBe('rated');
    expect(await reviewPromptService.shouldPrompt()).toBe(false);
  });

  it('rateNow falls back to the web URL when the store app is absent', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);
    await reviewPromptService.rateNow();
    expect(Linking.openURL).toHaveBeenCalledWith(WEB_URL);
  });

  it('openStoreListing recovers via web URL if the market open throws', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock)
      .mockRejectedValueOnce(new Error('no market'))
      .mockResolvedValueOnce(undefined);
    const ok = await reviewPromptService.openStoreListing();
    expect(ok).toBe(true);
    expect(Linking.openURL).toHaveBeenLastCalledWith(WEB_URL);
  });

  it('remindLater snoozes for seven days', async () => {
    await seed({ launches: 5, firstSeenAt: NOW - 3 * DAY_MS });
    await reviewPromptService.remindLater();
    const state = await reviewPromptService.getState();
    expect(state.remindAfter).toBe(NOW + 7 * DAY_MS);
    expect(await reviewPromptService.shouldPrompt()).toBe(false);
  });

  it('dismissForever opts out permanently', async () => {
    await seed({ launches: 5, firstSeenAt: NOW - 3 * DAY_MS });
    await reviewPromptService.dismissForever();
    const state = await reviewPromptService.getState();
    expect(state.status).toBe('dismissed');
    expect(await reviewPromptService.shouldPrompt()).toBe(false);
  });

  it('reset clears persisted state', async () => {
    await seed({ status: 'rated', launches: 9 });
    await reviewPromptService.reset();
    const state = await reviewPromptService.getState();
    expect(state.status).toBe('active');
    expect(state.launches).toBe(0);
  });

  it('markPrompted records the display time', async () => {
    await reviewPromptService.markPrompted();
    const state = await reviewPromptService.getState();
    expect(state.lastPromptedAt).toBe(NOW);
  });

  it('falls back to defaults when the storage read throws', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error('boom'),
    );
    const state = await reviewPromptService.getState();
    expect(state.status).toBe('active');
  });

  it('falls back to defaults when the stored JSON is corrupt', async () => {
    await AsyncStorage.setItem(STATE_KEY, 'not-json{');
    const state = await reviewPromptService.getState();
    expect(state.status).toBe('active');
    expect(state.launches).toBe(0);
  });

  it('swallows storage write errors', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('boom'),
    );
    await expect(reviewPromptService.registerLaunch()).resolves.toBeUndefined();
  });

  it('returns false when both the market and web opens fail', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('nope'));
    const ok = await reviewPromptService.openStoreListing();
    expect(ok).toBe(false);
  });

  it('swallows storage errors during reset', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
      new Error('boom'),
    );
    await expect(reviewPromptService.reset()).resolves.toBeUndefined();
  });
});
