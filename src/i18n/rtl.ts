/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Which way the interface runs.
 *
 * The app's language is its own setting, independent of the device locale, so
 * `I18nManager.isRTL` — which follows the device — is not the answer on its
 * own. Someone running an English phone who picks Arabic in Settings has to
 * get an Arabic *layout*, not Arabic text in a left-to-right frame.
 *
 * React Native decides direction natively and caches it, so a change only
 * takes effect after the process restarts. That is why nothing here tries to
 * flip the live tree: it records what the direction should be, and reports
 * whether a restart is owed so the UI can say so plainly instead of leaving
 * half the screen mirrored.
 */

import { I18nManager } from 'react-native';

/**
 * Languages written right to left, by base code. Only ones this app could
 * plausibly ship are listed; the check is on the base, so 'ar-EG' counts.
 */
export const RTL_LOCALES: readonly string[] = [
  'ar', // Arabic
  'fa', // Persian
  'he', // Hebrew
  'iw', // Hebrew, old code still emitted by some Android versions
  'ur', // Urdu
  'ps', // Pashto
  'sd', // Sindhi
  'ug', // Uyghur
  'yi', // Yiddish
];

/** True when this locale is written right to left. */
export const isRtlLocale = (locale?: string): boolean => {
  if (!locale) return false;
  const base = locale.replace(/_/g, '-').toLowerCase().split('-')[0];
  return RTL_LOCALES.includes(base);
};

let restartPending = false;

/**
 * Point React Native at the direction this locale needs.
 *
 * Returns true when the screen is running the other way round from what this
 * locale needs, i.e. a restart is owed. A locale that already matches the
 * running direction returns false, so a caller that prompts on `true` does not
 * nag on every language-menu visit.
 *
 * `I18nManager.isRTL` is the direction this process started with; it does not
 * change until the restart. So the choice is always written, even when it
 * matches: picking Arabic and then English before restarting has to undo the
 * stored flip, or the app would come back right-to-left in English.
 */
export const applyLayoutDirection = (locale?: string): boolean => {
  const shouldBeRtl = isRtlLocale(locale);

  // Without this, forceRTL is ignored on a build that has never opted in.
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(shouldBeRtl);

  restartPending = I18nManager.isRTL !== shouldBeRtl;
  return restartPending;
};

/**
 * True when the direction has been changed but the process has not restarted,
 * so the interface on screen is still running the old way round.
 */
export const isLayoutRestartPending = (): boolean => restartPending;

/** Called once the app has actually restarted, or by tests. */
export const clearLayoutRestartPending = (): void => {
  restartPending = false;
};
