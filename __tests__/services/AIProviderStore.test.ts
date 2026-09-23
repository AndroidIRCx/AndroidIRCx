/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Keychain from 'react-native-keychain';
import { secureStorageService } from '../../src/services/SecureStorageService';
import {
  aiProviderStore,
  AI_SECRET_PREFIX,
  MAX_ALLOWED_TOKENS,
} from '../../src/services/ai/AIProviderStore';

const openAIInput = {
  name: 'My OpenAI',
  kind: 'openai-compatible' as const,
  baseUrl: 'https://api.openai.com/v1',
  model: 'some-model',
};

describe('AIProviderStore', () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset();
    (Keychain as any).__reset();
    aiProviderStore.resetForTests();
  });

  it('adds a provider and stores its key outside AsyncStorage', async () => {
    const provider = await aiProviderStore.add(openAIInput, 'sk-secret-123');

    expect(provider.hasKey).toBe(true);
    expect(await aiProviderStore.getKey(provider.id)).toBe('sk-secret-123');

    // The key must never be reachable from the provider metadata blob.
    const raw = (await AsyncStorage.getItem('@AndroidIRCX:aiProviders')) ?? '';
    expect(raw).not.toContain('sk-secret-123');
    expect(JSON.parse(raw)[0]).not.toHaveProperty('apiKey');
  });

  it('rejects providers without a name, model, or valid base URL', async () => {
    await expect(
      aiProviderStore.add({ ...openAIInput, name: '  ' }),
    ).rejects.toThrow('name is required');

    await expect(
      aiProviderStore.add({ ...openAIInput, model: '' }),
    ).rejects.toThrow('Model is required');

    await expect(
      aiProviderStore.add({ ...openAIInput, baseUrl: 'ftp://nope' }),
    ).rejects.toThrow('base URL');

    await expect(
      aiProviderStore.add({ ...openAIInput, baseUrl: undefined }),
    ).rejects.toThrow('base URL');
  });

  it('normalizes the base URL and clamps maxTokens', async () => {
    const provider = await aiProviderStore.add({
      ...openAIInput,
      baseUrl: '  https://api.openai.com/v1///  ',
      maxTokens: 99999,
    });

    expect(provider.baseUrl).toBe('https://api.openai.com/v1');
    expect(provider.maxTokens).toBe(MAX_ALLOWED_TOKENS);
  });

  it('does not require a base URL for anthropic', async () => {
    const provider = await aiProviderStore.add(
      { name: 'Claude', kind: 'anthropic', model: 'claude-opus-5' },
      'sk-ant-key',
    );

    expect(provider.baseUrl).toBeUndefined();
    expect(provider.hasKey).toBe(true);
  });

  it('removes the stored key when the provider is deleted', async () => {
    const provider = await aiProviderStore.add(openAIInput, 'sk-secret-123');

    expect(await aiProviderStore.remove(provider.id)).toBe(true);
    expect(await aiProviderStore.getKey(provider.id)).toBeNull();
    expect((Keychain as any).__STORE.size).toBe(0);
    expect(await aiProviderStore.list()).toHaveLength(0);
  });

  it('clears a key when an empty value is set', async () => {
    const provider = await aiProviderStore.add(openAIInput, 'sk-secret-123');

    await aiProviderStore.setKey(provider.id, '   ');

    expect(await aiProviderStore.getKey(provider.id)).toBeNull();
    expect((await aiProviderStore.get(provider.id))?.hasKey).toBe(false);
  });

  it('resolves the default provider, then the first enabled one', async () => {
    const first = await aiProviderStore.add(openAIInput, 'k1');
    const second = await aiProviderStore.add(
      { ...openAIInput, name: 'Second' },
      'k2',
    );

    // First added becomes the default automatically.
    expect((await aiProviderStore.resolve())?.id).toBe(first.id);

    await aiProviderStore.setDefault(second.id);
    expect((await aiProviderStore.resolve())?.id).toBe(second.id);

    // A disabled default falls through to the next enabled provider.
    await aiProviderStore.update(second.id, { enabled: false });
    expect((await aiProviderStore.resolve())?.id).toBe(first.id);
  });

  it('never resolves a disabled provider, even when named', async () => {
    const provider = await aiProviderStore.add(openAIInput, 'k1');
    await aiProviderStore.update(provider.id, { enabled: false });

    expect(await aiProviderStore.resolve(provider.id)).toBeNull();
    expect(await aiProviderStore.isDisabled(provider.id)).toBe(true);
  });

  it('hides keys and internals from the script-facing list', async () => {
    const enabled = await aiProviderStore.add(openAIInput, 'k1');
    const disabled = await aiProviderStore.add(
      { ...openAIInput, name: 'Off' },
      'k2',
    );
    await aiProviderStore.update(disabled.id, { enabled: false });

    const forScripts = await aiProviderStore.listForScripts();

    expect(forScripts).toEqual([
      { id: enabled.id, name: 'My OpenAI', model: 'some-model' },
    ]);
    expect(Object.keys(forScripts[0])).not.toContain('baseUrl');
    expect(Object.keys(forScripts[0])).not.toContain('hasKey');
  });

  it('reassigns the default when the default provider is removed', async () => {
    const first = await aiProviderStore.add(openAIInput, 'k1');
    const second = await aiProviderStore.add(
      { ...openAIInput, name: 'Second' },
      'k2',
    );

    await aiProviderStore.remove(first.id);

    expect(await aiProviderStore.getDefaultId()).toBe(second.id);
  });

  it('persists across a reload', async () => {
    const provider = await aiProviderStore.add(openAIInput, 'sk-secret-123');

    aiProviderStore.resetForTests();
    const reloaded = await aiProviderStore.get(provider.id);

    expect(reloaded?.name).toBe('My OpenAI');
    expect(reloaded?.hasKey).toBe(true);
    // The Keychain entry survives independently of the metadata.
    expect(await aiProviderStore.getKey(provider.id)).toBe('sk-secret-123');
  });

  it('exposes which kinds require a key', () => {
    expect(aiProviderStore.requiresKey('anthropic')).toBe(true);
    expect(aiProviderStore.requiresKey('openai-compatible')).toBe(true);
    expect(aiProviderStore.requiresKey('gemini')).toBe(true);
    expect(aiProviderStore.requiresKey('local')).toBe(false);
  });

  it('namespaces secrets under the documented prefix', async () => {
    const provider = await aiProviderStore.add(openAIInput, 'sk-secret-123');
    const keys = await secureStorageService.getAllSecretKeys();

    expect(keys).toContain(`${AI_SECRET_PREFIX}${provider.id}`);
  });
});
