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

  it('treats everything this app ships today as left to right', () => {
    // All 29 shipped languages are LTR; the day that stops being true, this
    // fails and whoever added the language is told to check the layout.
    for (const locale of SUPPORTED_LOCALES) {
      expect(isRtlLocale(locale)).toBe(false);
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
  let isRTL = false;

  beforeEach(() => {
    isRTL = false;
    clearLayoutRestartPending();
    allowRTL = jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
    forceRTL = jest
      .spyOn(I18nManager, 'forceRTL')
      .mockImplementation((next: boolean) => {
        isRTL = next;
      });
    Object.defineProperty(I18nManager, 'isRTL', {
      configurable: true,
      get: () => isRTL,
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
    applyLayoutDirection('ar');
    clearLayoutRestartPending();
    forceRTL.mockClear();

    expect(applyLayoutDirection('en')).toBe(true);
    expect(forceRTL).toHaveBeenCalledWith(false);
  });

  it('does nothing when the direction is already right', () => {
    applyLayoutDirection('en');
    forceRTL.mockClear();
    clearLayoutRestartPending();

    // Re-applying the same language must not ask for a restart again, or the
    // prompt would come back on every language-menu visit.
    expect(applyLayoutDirection('en')).toBe(false);
    expect(applyLayoutDirection('de')).toBe(false);
    expect(forceRTL).not.toHaveBeenCalled();
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
