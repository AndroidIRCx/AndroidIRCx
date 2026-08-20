/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * ReviewPromptService.ts
 *
 * Drives the in-app "rate this app" questionnaire. Introduced in the version
 * recorded as `baselineVersion` on first launch, so it only ever targets users
 * running this build or newer (older builds simply don't contain the code).
 *
 * The prompt is a plain modal with three choices — Rate now / Remind me later /
 * Don't ask again — and, when the user chooses to rate, it deep-links to the
 * Play Store listing. It never conditions or blocks anything on the rating, and
 * the user's terminal choice (rated or dismissed) is remembered forever, so a
 * happy user is nudged once while an annoyed user is never bothered again.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { logger } from './Logger';
import { APP_VERSION } from '../config/appVersion';

const STATE_KEY = '@AndroidIRCX:reviewPrompt';
const PACKAGE_NAME = 'com.androidircx';

// `market://` opens the Play Store app straight on the listing; the https URL is
// the fallback for devices without the Play Store app (opens a browser / Play).
const MARKET_URL = `market://details?id=${PACKAGE_NAME}`;
const WEB_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`;

const DAY_MS = 24 * 60 * 60 * 1000;

// Eligibility knobs. Primarily TIME-based: the first prompt appears ~2 days
// after the install/update, on the user's next open. The launch floor is just
// an "install-and-bounce" guard (opened at least twice) so we don't prompt
// someone who never really used the app — it is NOT meant to delay past 2 days.
const MIN_LAUNCHES = 2; // qualifying app opens before the first prompt
const MIN_DAYS_SINCE_FIRST = 2; // and at least this long after we started counting
const REMIND_LATER_DAYS = 7; // "remind me later" snoozes the prompt this long

export type ReviewPromptStatus = 'active' | 'rated' | 'dismissed';

export interface ReviewPromptState {
  /** `active` = still eligible; `rated`/`dismissed` are terminal. */
  status: ReviewPromptStatus;
  /** App version at which the questionnaire first appeared for this install. */
  baselineVersion: string;
  /** Number of qualifying app opens counted so far. */
  launches: number;
  /** Epoch ms of the first launch under this feature (0 = not set yet). */
  firstSeenAt: number;
  /** Epoch ms before which we must not prompt (0 = no snooze). */
  remindAfter: number;
  /** Epoch ms the modal was last shown. */
  lastPromptedAt: number;
}

const createDefaultState = (): ReviewPromptState => ({
  status: 'active',
  baselineVersion: APP_VERSION,
  launches: 0,
  firstSeenAt: 0,
  remindAfter: 0,
  lastPromptedAt: 0,
});

class ReviewPromptService {
  private cache: ReviewPromptState | null = null;

  private async load(): Promise<ReviewPromptState> {
    if (this.cache) {
      return this.cache;
    }
    try {
      const raw = await AsyncStorage.getItem(STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ReviewPromptState>;
        this.cache = { ...createDefaultState(), ...parsed };
      } else {
        this.cache = createDefaultState();
      }
    } catch (error) {
      logger.error('review', `Failed to load review state: ${String(error)}`);
      this.cache = createDefaultState();
    }
    return this.cache;
  }

  private async save(state: ReviewPromptState): Promise<void> {
    this.cache = state;
    try {
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (error) {
      logger.error('review', `Failed to save review state: ${String(error)}`);
    }
  }

  /**
   * Count one app launch. Sets the baseline/first-seen timestamp on the very
   * first call. Terminal states are left untouched so counting stops once the
   * user has rated or opted out.
   */
  async registerLaunch(): Promise<void> {
    const state = await this.load();
    if (state.status !== 'active') {
      return;
    }
    const next: ReviewPromptState = {
      ...state,
      launches: state.launches + 1,
      firstSeenAt: state.firstSeenAt || Date.now(),
    };
    await this.save(next);
  }

  /** Whether the prompt should be shown right now. */
  async shouldPrompt(): Promise<boolean> {
    const state = await this.load();
    if (state.status !== 'active') {
      return false;
    }
    const now = Date.now();
    if (now < state.remindAfter) {
      return false;
    }
    if (state.launches < MIN_LAUNCHES) {
      return false;
    }
    if (
      state.firstSeenAt === 0 ||
      now - state.firstSeenAt < MIN_DAYS_SINCE_FIRST * DAY_MS
    ) {
      return false;
    }
    return true;
  }

  /** Record that the modal was displayed (used for analytics/back-off). */
  async markPrompted(): Promise<void> {
    const state = await this.load();
    await this.save({ ...state, lastPromptedAt: Date.now() });
  }

  /**
   * Open the Play Store listing and remember the user rated, so we never ask
   * again. Returns whether a store URL could be opened.
   */
  async rateNow(): Promise<boolean> {
    const state = await this.load();
    await this.save({ ...state, status: 'rated' });
    return this.openStoreListing();
  }

  /** Open the Play Store listing without changing the questionnaire state. */
  async openStoreListing(): Promise<boolean> {
    try {
      const canOpenMarket = await Linking.canOpenURL(MARKET_URL);
      await Linking.openURL(canOpenMarket ? MARKET_URL : WEB_URL);
      return true;
    } catch (error) {
      logger.warn('review', `Failed to open market URL: ${String(error)}`);
      try {
        await Linking.openURL(WEB_URL);
        return true;
      } catch (fallbackError) {
        logger.error(
          'review',
          `Failed to open web store URL: ${String(fallbackError)}`,
        );
        return false;
      }
    }
  }

  /** Snooze the prompt for a week. */
  async remindLater(): Promise<void> {
    const state = await this.load();
    await this.save({
      ...state,
      remindAfter: Date.now() + REMIND_LATER_DAYS * DAY_MS,
    });
  }

  /** Permanently opt out ("don't ask again"). */
  async dismissForever(): Promise<void> {
    const state = await this.load();
    await this.save({ ...state, status: 'dismissed' });
  }

  /** Current persisted state (loads it if needed). */
  async getState(): Promise<ReviewPromptState> {
    return this.load();
  }

  /** Reset everything (debug / settings "reset"). */
  async reset(): Promise<void> {
    this.cache = null;
    try {
      await AsyncStorage.removeItem(STATE_KEY);
    } catch (error) {
      logger.error('review', `Failed to reset review state: ${String(error)}`);
    }
  }
}

export const reviewPromptService = new ReviewPromptService();
