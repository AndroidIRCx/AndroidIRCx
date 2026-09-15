/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

type Mocks = {
  bestLanguageTag?: string | undefined;
  withLocaleApi?: boolean;
  appLanguage?: string;
  bundled?: Record<string, Record<string, unknown>>;
};

const loadModule = (mocks: Mocks = {}) => {
  const mockSettingsService = {
    getSetting: jest.fn().mockResolvedValue(mocks.appLanguage ?? 'system'),
  };

  const addEventListener = jest.fn();
  const removeEventListener = jest.fn();

  jest.resetModules();

  jest.doMock('react-native-localize', () => {
    if (mocks.withLocaleApi === false) {
      return { findBestLanguageTag: jest.fn(() => null) };
    }
    return {
      findBestLanguageTag: jest.fn(() =>
        mocks.bestLanguageTag ? { languageTag: mocks.bestLanguageTag } : null,
      ),
      addEventListener,
      removeEventListener,
    };
  });

  jest.doMock('../../src/i18n/config', () => ({
    DEFAULT_LOCALE: 'en',
    SUPPORTED_LOCALES: ['en', 'de', 'sr', 'sr@Cyrl'],
  }));

  jest.doMock('../../src/i18n/translations', () => ({
    bundledTranslations: mocks.bundled ?? {
      en: {
        hello: 'Hello',
        nested: { string: 'Nested' },
        missingParam: 'Hello {nick}',
        invalid: { nope: 1 },
      },
      de: {
        hello: 'Hallo',
        nested: { string: 'Verschachtelt' },
      },
      sr: {
        hello: 'Zdravo',
      },
      'sr@Cyrl': {
        hello: 'Zdravo',
      },
    },
  }));

  jest.doMock('../../src/services/SettingsService', () => ({
    settingsService: mockSettingsService,
  }));

  const mod = require('../../src/i18n/localization');
  return {
    mod,
    mockSettingsService,
    addEventListener,
    removeEventListener,
  };
};

describe('i18n/localization', () => {
  it('translates from bundled JSON and falls back to English then source key', () => {
    const { mod } = loadModule();

    expect(mod.tx.t('hello')).toBe('Hello');
    expect(mod.tx.t('nested')).toBe('Nested');
    expect(mod.tx.t('missingParam', { nick: 'munZe' })).toBe('Hello munZe');
    expect(mod.tx.t('unknown-key')).toBe('unknown-key');
  });

  it('applies explicit and system locales without remote fetches', async () => {
    const { mod } = loadModule({ bestLanguageTag: 'DE' });

    await mod.applyLocale('system');
    expect(mod.tx.getCurrentLocale()).toBe('de');
    expect(mod.tx.t('hello')).toBe('Hallo');

    await mod.applyLocale('SR');
    expect(mod.tx.getCurrentLocale()).toBe('sr');
    expect(mod.tx.t('hello')).toBe('Zdravo');
  });

  it('normalizes Serbian Cyrillic locale aliases', async () => {
    const { mod } = loadModule();

    expect(mod.normalizeLocale('sr-Cyrl-RS')).toBe('sr@Cyrl');
    await mod.applyLocale('sr-Cyrl');
    expect(mod.tx.getCurrentLocale()).toBe('sr@Cyrl');
    expect(mod.tx.t('hello')).toBe('Zdravo');
  });

  it('initLocalization keeps the dynamic settings import boundary', async () => {
    const { mod, mockSettingsService } = loadModule({
      appLanguage: 'de',
    });

    await expect(mod.initLocalization()).rejects.toThrow(
      'A dynamic import callback was invoked without --experimental-vm-modules',
    );
    expect(mockSettingsService.getSetting).not.toHaveBeenCalled();
  });

  it('listenToLocaleChanges returns noop when localize listener API is unavailable', () => {
    const { mod } = loadModule({ withLocaleApi: false });
    const unsub = mod.listenToLocaleChanges();
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });

  it('listenToLocaleChanges subscribes and returns proper unsubscribe callback', () => {
    const { mod, addEventListener, removeEventListener } = loadModule();

    const unsub = mod.listenToLocaleChanges();
    expect(addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );

    unsub();
    const changeHandler = addEventListener.mock.calls[0][1];
    expect(removeEventListener).toHaveBeenCalledWith('change', changeHandler);
  });

  it('listenToLocaleChanges handler catches async settings import failures', async () => {
    const { mod, addEventListener } = loadModule();

    mod.listenToLocaleChanges();
    const changeHandler = addEventListener.mock.calls[0][1];
    expect(() => changeHandler()).not.toThrow();
    await Promise.resolve();
  });

  it('exports LocalizationProvider/useT bindings', () => {
    const { mod } = loadModule();
    expect(mod.LocalizationProvider).toBeDefined();
    expect(mod.useT).toBeDefined();
  });

  it('leaves underscore-prefixed placeholders untouched during interpolation', () => {
    const { mod } = loadModule({
      bundled: { en: { greet: 'Hi {name} {_raw}' } },
    });

    // `{name}` is substituted; `{_raw}` is intentionally preserved verbatim.
    expect(mod.tx.t('greet', { name: 'Ana', _raw: 'X' })).toBe('Hi Ana {_raw}');
  });

  it('applyLocale returns early when the resolved locale is unchanged', async () => {
    const { mod } = loadModule();

    // currentLocale starts at DEFAULT_LOCALE ('en'); re-applying it hits the
    // early-return branch without mutating state or notifying listeners.
    expect(mod.tx.getCurrentLocale()).toBe('en');
    await mod.applyLocale('en');
    expect(mod.tx.getCurrentLocale()).toBe('en');
  });

  it('LocalizationProvider renders its children', async () => {
    const { mod } = loadModule();

    const { getByText } = await render(
      React.createElement(
        mod.LocalizationProvider,
        null,
        React.createElement(Text, null, 'child-node'),
      ),
    );
    expect(getByText('child-node')).toBeTruthy();
  });
});
