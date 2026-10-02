/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { I18nManager } from 'react-native';
import {
  applyLayoutDirection,
  clearLayoutRestartPending,
  isLayoutRestartPending,
  isRtlLocale,
  RTL_LOCALES,
} from '../../src/i18n/rtl';
import { SUPPORTED_LOCALES } from '../../src/i18n/config';

describe('knowing which way a language runs', () => {
  it('knows the right-to-left languages, by base code', () => {
    for (const locale of RTL_LOCALES) {
      expect(isRtlLocale(locale)).toBe(true);
    }
    // A region or script suffix does not change the direction.
    expect(isRtlLocale('ar-EG')).toBe(true);
    expect(isRtlLocale('he_IL')).toBe(true);
    expect(isRtlLocale('FA')).toBe(true);
  });

  it('keeps shipped LTR and RTL languages classified explicitly', () => {
    const shippedRtlLocales = new Set(['ar', 'fa', 'ur', 'he']);

    for (const locale of SUPPORTED_LOCALES) {
      expect(isRtlLocale(locale)).toBe(shippedRtlLocales.has(locale));
    }
  });

  it('says no when it is given nothing', () => {
    expect(isRtlLocale()).toBe(false);
    expect(isRtlLocale('')).toBe(false);
  });
});

describe('pointing React Native at a direction', () => {
  let allowRTL: jest.SpyInstance;
  let forceRTL: jest.SpyInstance;
  // The direction this process launched with. Like the real I18nManager, it
  // does not move when forceRTL is called; only a restart would change it.
  let launchedRtl = false;

  beforeEach(() => {
    launchedRtl = false;
    clearLayoutRestartPending();
    allowRTL = jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
    forceRTL = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
    Object.defineProperty(I18nManager, 'isRTL', {
      configurable: true,
      get: () => launchedRtl,
    });
  });

  afterEach(() => {
    allowRTL.mockRestore();
    forceRTL.mockRestore();
    clearLayoutRestartPending();
  });

  it('opts the build in before asking for anything', () => {
    applyLayoutDirection('en');
    // forceRTL is ignored on a build that never called allowRTL.
    expect(allowRTL).toHaveBeenCalledWith(true);
  });

  it('turns the layout around for a right-to-left language', () => {
    expect(applyLayoutDirection('ar')).toBe(true);

    expect(forceRTL).toHaveBeenCalledWith(true);
    // The change only lands on the next launch, so somebody has to be told.
    expect(isLayoutRestartPending()).toBe(true);
  });

  it('turns it back for a left-to-right one', () => {
    launchedRtl = true;

    expect(applyLayoutDirection('en')).toBe(true);
    expect(forceRTL).toHaveBeenCalledWith(false);
  });

  it('does not ask for a restart when the direction is already right', () => {
    // Re-applying a language must not ask for a restart again, or the prompt
    // would come back on every language-menu visit.
    expect(applyLayoutDirection('en')).toBe(false);
    expect(applyLayoutDirection('de')).toBe(false);
    expect(isLayoutRestartPending()).toBe(false);

    launchedRtl = true;
    expect(applyLayoutDirection('he')).toBe(false);
    expect(isLayoutRestartPending()).toBe(false);
  });

  it('undoes a flip that was chosen and then taken back before restarting', () => {
    // Arabic, then English again, all in one LTR session: the stored flip has
    // to be reverted, or the next launch comes up right-to-left in English.
    expect(applyLayoutDirection('ar')).toBe(true);
    expect(applyLayoutDirection('en')).toBe(false);

    expect(forceRTL).toHaveBeenLastCalledWith(false);
    expect(isLayoutRestartPending()).toBe(false);
  });

  it('stays pending until something says the restart happened', () => {
    applyLayoutDirection('he');
    expect(isLayoutRestartPending()).toBe(true);

    applyLayoutDirection('he');
    expect(isLayoutRestartPending()).toBe(true);

    clearLayoutRestartPending();
    expect(isLayoutRestartPending()).toBe(false);
  });
});
