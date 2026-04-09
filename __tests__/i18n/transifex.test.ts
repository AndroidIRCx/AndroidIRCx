/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

type Mocks = {
  token?: string;
  bestLanguageTag?: string | undefined;
  appLanguage?: string;
  bundled?: Record<string, Record<string, unknown>>;
  withLocaleApi?: boolean;
  fetchReject?: boolean;
};

const loadModule = (mocks: Mocks = {}) => {
  const mockTx = {
    init: jest.fn(),
    setCurrentLocale: jest.fn().mockResolvedValue(undefined),
    fetchTranslations: mocks.fetchReject
      ? jest.fn().mockRejectedValue(new Error('fetch-fail'))
      : jest.fn().mockResolvedValue(undefined),
    cache: { update: jest.fn() },
    translate: jest.fn((k: string) => `tr:${k}`),
  } as any;

  const mockSettingsService = {
    getSetting: jest.fn().mockResolvedValue(mocks.appLanguage ?? 'system'),
  };

  const addEventListener = jest.fn();
  const removeEventListener = jest.fn();

  jest.resetModules();

  jest.doMock('@transifex/native', () => ({
    tx: mockTx,
    SourceErrorPolicy: class SourceErrorPolicy {},
    SourceStringPolicy: class SourceStringPolicy {},
    normalizeLocale: (locale: string) => locale.toLowerCase(),
  }));

  jest.doMock('@transifex/react', () => ({
    TXProvider: ({ children }: { children: unknown }) => children,
    useT: () => (k: string) => k,
  }));

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
    SUPPORTED_LOCALES: ['en', 'de', 'sr'],
    TRANSIFEX_CDS_HOST: 'https://cds.example',
    TRANSIFEX_NATIVE_TOKEN: mocks.token ?? 'token-1',
  }));

  jest.doMock('../../src/i18n/translations', () => ({
    bundledTranslations: mocks.bundled ?? {
      en: { hello: 'Hello', nested: { string: 'Nested' }, bad: 42 },
      de: {},
    },
  }));

  jest.doMock('../../src/services/SettingsService', () => ({
    settingsService: mockSettingsService,
  }));

  const mod = require('../../src/i18n/transifex');
  return {
    mod,
    mockTx,
    mockSettingsService,
    addEventListener,
    removeEventListener,
  };
};

describe('i18n/transifex', () => {
  it('initTransifex initializes SDK and preloads bundled translations before dynamic import boundary', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { mod, mockTx, mockSettingsService } = loadModule({
      token: '',
      bestLanguageTag: 'SR',
      bundled: {
        en: {
          hello: 'Hello',
          nested: { string: 'Nested' },
          invalid: { nope: 1 },
        },
        sr: { zdravo: 'Zdravo' },
      },
      appLanguage: 'system',
    });

    await expect(mod.initTransifex()).rejects.toThrow(
      'A dynamic import callback was invoked without --experimental-vm-modules',
    );

    expect(mockTx.init).toHaveBeenCalledWith(
      expect.objectContaining({
        token: '',
        cdsHost: 'https://cds.example',
      }),
    );
    expect(mockTx.cache.update).toHaveBeenCalledWith('en', {
      hello: 'Hello',
      nested: 'Nested',
    });
    expect(mockTx.cache.update).toHaveBeenCalledWith('sr', {
      zdravo: 'Zdravo',
    });
    expect(mockSettingsService.getSetting).not.toHaveBeenCalled();
    expect(mockTx.setCurrentLocale).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Transifex Native token missing; translations will use source strings.',
    );
    warnSpy.mockRestore();
  });

  it('exports tx.t fallback bound to translate', () => {
    const { mod, mockTx } = loadModule();
    expect(typeof mod.tx.t).toBe('function');
    expect(mod.tx.t('hello')).toBe('tr:hello');
    expect(mockTx.translate).toHaveBeenCalledWith('hello');
  });

  it('applyTransifexLocale resolves system locale and skips remote fetch when token missing', async () => {
    const { mod, mockTx } = loadModule({
      token: '',
      bestLanguageTag: 'DE',
    });

    await mod.applyTransifexLocale('system');
    expect(mockTx.setCurrentLocale).toHaveBeenCalledWith('de');
    expect(mockTx.fetchTranslations).not.toHaveBeenCalled();
  });

  it('applyTransifexLocale fetches when locale bundle is missing and handles fetch errors', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { mod, mockTx } = loadModule({
      token: 'token-yes',
      bundled: { en: { hello: 'Hello' }, de: {} },
      fetchReject: true,
    });

    await mod.applyTransifexLocale('de');

    expect(mockTx.setCurrentLocale).toHaveBeenCalledWith('de');
    expect(mockTx.fetchTranslations).toHaveBeenCalledWith('de', {
      refresh: true,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Transifex translation fetch failed:',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('applyTransifexLocale skips fetch when explicit preferred locale has bundled translations', async () => {
    const { mod, mockTx } = loadModule({
      token: 'token-yes',
      bundled: { en: { hello: 'Hello' }, sr: { zdravo: 'Zdravo' } },
    });

    await mod.applyTransifexLocale('SR');
    expect(mockTx.setCurrentLocale).toHaveBeenCalledWith('sr');
    expect(mockTx.fetchTranslations).not.toHaveBeenCalled();
  });

  it('listenToLocaleChanges returns noop when localize listener API is unavailable', () => {
    const { mod } = loadModule({ withLocaleApi: false });
    const unsub = mod.listenToLocaleChanges();
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });

  it('listenToLocaleChanges subscribes and returns proper unsubscribe callback', () => {
    const { mod, addEventListener, removeEventListener } = loadModule({
      token: 'token-yes',
    });

    const unsub = mod.listenToLocaleChanges();
    expect(addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );

    unsub();
    const changeHandler = addEventListener.mock.calls[0][1];
    expect(removeEventListener).toHaveBeenCalledWith('change', changeHandler);
  });

  it('listenToLocaleChanges handler safely catches async dynamic import failures', async () => {
    const { mod, addEventListener } = loadModule({
      token: 'token-yes',
    });

    mod.listenToLocaleChanges();
    const changeHandler = addEventListener.mock.calls[0][1];
    expect(() => changeHandler()).not.toThrow();
    await Promise.resolve();
  });

  it('listenToLocaleChanges ignores system apply when user picked non-system locale', async () => {
    const { mod, addEventListener, mockTx } = loadModule({
      token: 'token-yes',
      appLanguage: 'de',
    });

    mod.listenToLocaleChanges();
    const changeHandler = addEventListener.mock.calls[0][1];
    changeHandler();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockTx.setCurrentLocale).not.toHaveBeenCalled();
  });

  it('exports TXProvider/useT bindings', () => {
    const { mod } = loadModule();
    expect(mod.TXProvider).toBeDefined();
    expect(mod.useT).toBeDefined();
  });
});
