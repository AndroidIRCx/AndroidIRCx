/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * What these stores read off the disk is whatever the last version of the app
 * wrote, or whatever survived a half-finished write, or — for anyone who has
 * restored a backup — something written by a build that no longer exists.
 *
 * A store that trusts it either crashes on launch or, worse, quietly drops the
 * user's providers and addon settings and carries on as if they were never
 * there. Both halves of every validation matter, so both are exercised here.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../src/services/Logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { AddonConfigStore } from '../../src/services/scripting/AddonConfigStore';
import { aiProviderStore } from '../../src/services/ai/AIProviderStore';

const CONFIG_KEY = '@AndroidIRCX:addonConfig:v1';
const PROVIDERS_KEY = '@AndroidIRCX:aiProviders';
const DEFAULT_KEY = '@AndroidIRCX:aiDefaultProvider';

const CHECKSUM = 'a'.repeat(64);

beforeEach(async () => {
  (AsyncStorage as any).__reset?.();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('addon configuration read back from disk', () => {
  const store = () => new AddonConfigStore();

  const write = (value: unknown) =>
    AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(value));

  it('reads back what it wrote', async () => {
    const first = store();
    await first.initialize();
    await first.set('rs.androidircx.demo', { theme: 'dark' });

    const reopened = store();
    await reopened.initialize();
    expect(reopened.get('rs.androidircx.demo')).toEqual({ theme: 'dark' });
  });

  it('starts empty when nothing was ever stored', async () => {
    const fresh = store();
    await fresh.initialize();
    expect(fresh.get('rs.androidircx.demo')).toEqual({});
  });

  it('initializes once however often it is asked', async () => {
    const fresh = store();
    await fresh.initialize();
    await fresh.set('rs.androidircx.demo', { a: 1 });
    await fresh.initialize();
    expect(fresh.get('rs.androidircx.demo')).toEqual({ a: 1 });
  });

  it('keeps a snapshot and puts it back', async () => {
    const fresh = store();
    await fresh.initialize();
    await fresh.set('rs.androidircx.demo', { theme: 'dark' });
    await fresh.snapshot('rs.androidircx.demo', CHECKSUM);

    await fresh.set('rs.androidircx.demo', { theme: 'light' });
    await fresh.restoreSnapshot('rs.androidircx.demo', CHECKSUM);

    expect(fresh.get('rs.androidircx.demo')).toEqual({ theme: 'dark' });
  });

  it.each([[null], [[]], ['a string'], [42], [true]])(
    'refuses a registry that is not an object (%p)',
    async stored => {
      await write(stored);
      await expect(store().initialize()).rejects.toThrow(/corrupt/i);
    },
  );

  it('refuses an addon id that could escape its own key', async () => {
    await write({ '../etc/passwd': { current: {}, snapshots: {} } });
    await expect(store().initialize()).rejects.toThrow(/Invalid addon id/i);
  });

  it.each([[null], ['nope'], [[]], [{}], [{ snapshots: 'no' }]])(
    'refuses a record without a snapshots object (%p)',
    async candidate => {
      await write({ 'rs.androidircx.demo': candidate });
      await expect(store().initialize()).rejects.toThrow();
    },
  );

  it('refuses a snapshot filed under something that is not a checksum', async () => {
    await write({
      'rs.androidircx.demo': { current: {}, snapshots: { 'not-hex': {} } },
    });
    await expect(store().initialize()).rejects.toThrow(/checksum/i);
  });
});

describe('AI providers read back from disk', () => {
  const reset = () => {
    (aiProviderStore as any).loaded = false;
    (aiProviderStore as any).providers = [];
    (aiProviderStore as any).defaultProviderId = null;
  };

  beforeEach(reset);

  it('keeps the entries that look like providers and drops the rest', async () => {
    await AsyncStorage.setItem(
      PROVIDERS_KEY,
      JSON.stringify([
        { id: 'good', name: 'Good', kind: 'openai-compatible', model: 'm' },
        null,
        'a string',
        42,
        {},
        { name: 'no id at all' },
        { id: 42 },
      ]),
    );

    const list = await aiProviderStore.list();

    // One usable provider is better than refusing to start.
    expect(list.map(p => p.id)).toEqual(['good']);
  });

  it('ignores a stored list that is not a list', async () => {
    await AsyncStorage.setItem(PROVIDERS_KEY, JSON.stringify({ id: 'lonely' }));
    expect(await aiProviderStore.list()).toEqual([]);
  });

  it('survives a stored list that is not even JSON', async () => {
    await AsyncStorage.setItem(PROVIDERS_KEY, '{ this is not json');
    expect(await aiProviderStore.list()).toEqual([]);
    expect(await aiProviderStore.getDefaultId()).toBeNull();
  });

  it('remembers the default provider, and copes with none', async () => {
    await AsyncStorage.setItem(PROVIDERS_KEY, JSON.stringify([{ id: 'a' }]));
    await AsyncStorage.setItem(DEFAULT_KEY, 'a');
    expect(await aiProviderStore.getDefaultId()).toBe('a');

    reset();
    await AsyncStorage.removeItem(DEFAULT_KEY);
    expect(await aiProviderStore.getDefaultId()).toBeNull();
  });
});

describe('changing a provider', () => {
  const reset = () => {
    (aiProviderStore as any).loaded = false;
    (aiProviderStore as any).providers = [];
    (aiProviderStore as any).defaultProviderId = null;
  };

  beforeEach(reset);

  const addOne = () =>
    aiProviderStore.add({
      name: 'Mine',
      kind: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'some-model',
    } as any);

  it('changes nothing for an id that is not there', async () => {
    expect(await aiProviderStore.update('ghost', { name: 'x' })).toBeNull();
    expect(await aiProviderStore.remove('ghost')).toBe(false);
    expect(await aiProviderStore.setDefault('ghost')).toBe(false);
  });

  it('keeps the fields the caller did not mention', async () => {
    const created = await addOne();

    const updated = await aiProviderStore.update(created.id, {});

    expect(updated).toMatchObject({
      name: 'Mine',
      model: 'some-model',
      baseUrl: 'https://api.example.com/v1',
    });
  });

  it('trims and caps what it is given', async () => {
    const created = await addOne();

    const updated = await aiProviderStore.update(created.id, {
      name: `  ${'n'.repeat(120)}  `,
      model: `  ${'m'.repeat(200)}  `,
    } as any);

    expect(updated!.name).toHaveLength(60);
    expect(updated!.model).toHaveLength(120);
  });

  it('refuses a base URL that is not http(s) for a kind that needs one', async () => {
    const created = await addOne();

    await expect(
      aiProviderStore.update(created.id, { baseUrl: 'not a url' } as any),
    ).rejects.toThrow(/base URL/i);
  });

  it('drops the base URL for a kind that has no use for one', async () => {
    const created = await addOne();

    const updated = await aiProviderStore.update(created.id, {
      kind: 'anthropic',
    } as any);

    expect(updated!.baseUrl).toBeUndefined();
  });

  it('turns a provider off and on again', async () => {
    const created = await addOne();

    expect(
      (await aiProviderStore.update(created.id, { enabled: false }))!.enabled,
    ).toBe(false);
    expect(
      (await aiProviderStore.update(created.id, { enabled: true }))!.enabled,
    ).toBe(true);
  });
});
