/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AISettingsScreen } from '../../src/screens/AISettingsScreen';
import { AIError } from '../../src/services/ai/types';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      surface: '#111',
      surfaceVariant: '#222',
      text: '#fff',
      textSecondary: '#bbb',
      primary: '#4caf50',
      onPrimary: '#fff',
      border: '#444',
      error: '#f44336',
      warning: '#ff9800',
    },
  }),
}));

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => {
    if (!params) return key;
    return Object.entries(params).reduce(
      (result, [paramKey, value]) =>
        result.replace(`{${paramKey}}`, String(value)),
      key,
    );
  },
}));

jest.mock('../../src/services/ai/AIService', () => ({
  aiService: {
    loadSettings: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
    setEnabled: jest.fn().mockResolvedValue(undefined),
    isAvailable: jest.fn().mockResolvedValue(true),
    listModels: jest.fn(),
    supportedKinds: jest.fn().mockReturnValue(['openai-compatible', 'local']),
    hasConsent: jest.fn().mockReturnValue(true),
    setConsent: jest.fn().mockResolvedValue(undefined),
    isRedactionEnabled: jest.fn().mockReturnValue(true),
    setRedactionEnabled: jest.fn(),
    listAllowedChannels: jest.fn().mockReturnValue([]),
    setChannelAllowed: jest.fn().mockResolvedValue(undefined),
    supportsMcp: jest.fn((kind: string) => kind === 'anthropic'),
    diagnose: jest
      .fn()
      .mockResolvedValue({ code: 'ok', ready: true, reason: '', where: '' }),
  },
}));

// The MCP server pulls in AgentTools -> ConnectionManager -> IRCService,
// which has no business loading in a settings-screen test.
jest.mock('../../src/services/ai/McpServerService', () => ({
  mcpServerService: {
    isSupported: jest.fn(() => false),
    getStatus: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    describeEndpoint: jest.fn(() => 'http://127.0.0.1:8765/mcp'),
  },
}));

jest.mock('../../src/services/ai/AIProviderStore', () => ({
  DEFAULT_MAX_TOKENS: 1024,
  MAX_ALLOWED_TOKENS: 8192,
  aiProviderStore: {
    list: jest.fn(),
    getDefaultId: jest.fn(),
    requiresKey: jest.fn((kind: string) => kind !== 'local'),
    add: jest.fn(),
    update: jest.fn().mockResolvedValue(null),
    remove: jest.fn().mockResolvedValue(true),
    setDefault: jest.fn().mockResolvedValue(true),
    setKey: jest.fn().mockResolvedValue(undefined),
    setMcpServers: jest.fn().mockResolvedValue(null),
    setMcpToken: jest.fn().mockResolvedValue(undefined),
  },
}));

const { aiService } = require('../../src/services/ai/AIService');
const { aiProviderStore } = require('../../src/services/ai/AIProviderStore');

const providerFixture = (overrides = {}) => ({
  id: 'p1',
  name: 'My OpenAI',
  kind: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  model: 'some-model',
  hasKey: true,
  maxTokens: 1024,
  enabled: true,
  ...overrides,
});

const renderScreen = () =>
  render(<AISettingsScreen visible onClose={jest.fn()} />);

describe('AISettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    aiService.isEnabled.mockReturnValue(true);
    aiService.isAvailable.mockResolvedValue(true);
    aiService.supportedKinds.mockReturnValue(['openai-compatible', 'local']);
    aiService.hasConsent.mockReturnValue(true);
    aiService.isRedactionEnabled.mockReturnValue(true);
    aiService.listAllowedChannels.mockReturnValue([]);
    aiService.diagnose.mockResolvedValue({
      code: 'ok',
      ready: true,
      reason: '',
      where: '',
    });
    aiService.supportsMcp.mockImplementation(
      (kind: string) => kind === 'anthropic',
    );
    aiProviderStore.list.mockResolvedValue([providerFixture()]);
    aiProviderStore.getDefaultId.mockResolvedValue('p1');
  });

  it('tells the user a subscription will not work', async () => {
    const { findByText } = await renderScreen();

    // The single most predictable support question — it must be on screen.
    await findByText(/Claude Pro or ChatGPT Plus subscription cannot be used/);
  });

  it('lists providers with their default badge', async () => {
    const { findByText } = await renderScreen();

    await findByText('My OpenAI');
    await findByText('DEFAULT');
    await findByText(/OpenAI-compatible/);
  });

  it('flags a cloud provider that has no key stored', async () => {
    aiProviderStore.list.mockResolvedValue([
      providerFixture({ hasKey: false }),
    ]);

    const { findByText } = await renderScreen();

    await findByText('No API key stored');
  });

  it('does not flag a keyless local provider', async () => {
    aiProviderStore.list.mockResolvedValue([
      providerFixture({ kind: 'local', hasKey: false }),
    ]);

    const { queryByText, findByText } = await renderScreen();

    await findByText('My OpenAI');
    expect(queryByText('No API key stored')).toBeNull();
  });

  it('shows an empty state when nothing is configured', async () => {
    aiProviderStore.list.mockResolvedValue([]);
    aiService.isAvailable.mockResolvedValue(false);

    const { findByText } = await renderScreen();

    await findByText('No providers yet. Tap Add to set one up.');
  });

  it('flips the kill switch through the service', async () => {
    const { UNSAFE_getAllByType } = await renderScreen();
    const { Switch } = require('react-native');

    await waitFor(() => expect(aiProviderStore.list).toHaveBeenCalled());
    const masterSwitch = UNSAFE_getAllByType(Switch)[0];
    await fireEvent(masterSwitch, 'valueChange', false);

    expect(aiService.setEnabled).toHaveBeenCalledWith(false);
  });

  it('reports a working connection with the model count', async () => {
    aiService.listModels.mockResolvedValue(['a', 'b', 'c']);

    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Test'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Connection works',
        'The provider answered with 3 models.',
      ),
    );
  });

  it('translates a rejected key into plain language', async () => {
    aiService.listModels.mockRejectedValue(
      new AIError('auth_failed', 'HTTP 401: Incorrect API key', 401),
    );

    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Test'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Connection failed',
        'The API key was rejected by the provider.',
      ),
    );
  });

  it('confirms before removing a provider, then deletes it', async () => {
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Remove'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Remove My OpenAI?',
      'The stored API key is deleted with it.',
      expect.any(Array),
    );

    // Take the destructive button the alert offered and run it.
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await buttons[1].onPress();

    await waitFor(() =>
      expect(aiProviderStore.remove).toHaveBeenCalledWith('p1'),
    );
  });

  it('promotes another provider to default', async () => {
    aiProviderStore.list.mockResolvedValue([
      providerFixture(),
      providerFixture({ id: 'p2', name: 'Groq' }),
    ]);

    const { findAllByText } = await renderScreen();
    const promote = await findAllByText('Make default');
    await fireEvent.press(promote[0]);

    await waitFor(() =>
      expect(aiProviderStore.setDefault).toHaveBeenCalledWith('p2'),
    );
  });

  it('creates a provider with the typed key', async () => {
    aiProviderStore.add.mockResolvedValue(providerFixture({ id: 'new1' }));

    const { findByText, findByPlaceholderText } = await renderScreen();
    await fireEvent.press(await findByText('Add'));

    fireEvent.changeText(await findByPlaceholderText('My provider'), 'Groq');
    fireEvent.changeText(await findByPlaceholderText('sk-…'), 'sk-live-key');
    await fireEvent.press(await findByText('Save'));

    await waitFor(() =>
      expect(aiProviderStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Groq', kind: 'openai-compatible' }),
        'sk-live-key',
      ),
    );
  });

  it('leaves a stored key alone when the key field is left blank', async () => {
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Edit'));
    await fireEvent.press(await findByText('Save'));

    await waitFor(() => expect(aiProviderStore.update).toHaveBeenCalled());
    expect(aiProviderStore.setKey).not.toHaveBeenCalled();
  });

  it('asks for explicit agreement before enabling consent', async () => {
    aiService.hasConsent.mockReturnValue(false);

    const { UNSAFE_getAllByType } = await renderScreen();
    const { Switch } = require('react-native');
    await waitFor(() => expect(aiProviderStore.list).toHaveBeenCalled());

    // [0] is the kill switch, [1] the consent switch.
    await fireEvent(UNSAFE_getAllByType(Switch)[1], 'valueChange', true);

    // Consent must not be recorded from the tap alone.
    expect(aiService.setConsent).not.toHaveBeenCalled();
    const [title, body, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('Send messages to an AI provider?');
    expect(body).toContain('written by other people');

    await buttons[1].onPress();
    expect(aiService.setConsent).toHaveBeenCalledWith(true);
  });

  it('withdraws consent without a confirmation step', async () => {
    const { UNSAFE_getAllByType } = await renderScreen();
    const { Switch } = require('react-native');
    await waitFor(() => expect(aiProviderStore.list).toHaveBeenCalled());

    await fireEvent(UNSAFE_getAllByType(Switch)[1], 'valueChange', false);

    expect(aiService.setConsent).toHaveBeenCalledWith(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('lists the channels AI may read and revokes one', async () => {
    aiService.listAllowedChannels.mockReturnValue(['net1::#chat']);

    const { findByText } = await renderScreen();
    await findByText('net1::#chat');
    await fireEvent.press(await findByText('Revoke'));

    await waitFor(() =>
      expect(aiService.setChannelAllowed).toHaveBeenCalledWith(
        '#chat',
        false,
        'net1',
      ),
    );
  });

  it('explains a consent refusal in plain language', async () => {
    aiService.listModels.mockRejectedValue(
      new AIError('consent_required', 'not agreed'),
    );

    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Test'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Connection failed',
        'You have not agreed to send conversation content to this provider yet.',
      ),
    );
  });

  it('offers MCP only for a provider kind that can reach it', async () => {
    aiProviderStore.list.mockResolvedValue([
      providerFixture({ kind: 'anthropic', model: 'claude-opus-5' }),
    ]);

    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Edit'));

    await findByText('MCP servers');
    // The app is not an MCP client; only the provider-side path exists.
    await findByText(/Local \(stdio\) servers cannot be used from a phone/);
  });

  it('hides MCP for a provider kind that cannot', async () => {
    const { findByText, queryByText } = await renderScreen();
    await fireEvent.press(await findByText('Edit'));

    await findByText('Model');
    expect(queryByText('MCP servers')).toBeNull();
  });

  it('offers presets, with the free ones marked', async () => {
    aiService.supportedKinds.mockReturnValue([
      'openai-compatible',
      'local',
      'anthropic',
      'gemini',
    ]);

    const { findByText, findAllByText } = await renderScreen();
    await fireEvent.press(await findByText('Add'));

    await findByText('Google Gemini');
    await findByText('DeepSeek');
    await findByText('Claude (Anthropic)');
    await findByText('ChatGPT (OpenAI)');
    expect((await findAllByText('FREE')).length).toBeGreaterThan(0);
  });

  it('hides a preset whose kind has no adapter', async () => {
    // supportedKinds is the two-kind default from beforeEach.
    const { findByText, queryByText } = await renderScreen();
    await fireEvent.press(await findByText('Add'));

    await findByText('DeepSeek');
    expect(queryByText('Claude (Anthropic)')).toBeNull();
    expect(queryByText('Google Gemini')).toBeNull();
  });

  it('fills the form from a preset and creates the provider', async () => {
    aiProviderStore.add.mockResolvedValue(providerFixture({ id: 'new1' }));

    const { findByText, findByPlaceholderText } = await renderScreen();
    await fireEvent.press(await findByText('Add'));
    await fireEvent.press(await findByText('DeepSeek'));

    fireEvent.changeText(await findByPlaceholderText('sk-…'), 'sk-deepseek');
    await fireEvent.press(await findByText('Save'));

    await waitFor(() =>
      expect(aiProviderStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DeepSeek',
          kind: 'openai-compatible',
          baseUrl: 'https://api.deepseek.com/v1',
        }),
        'sk-deepseek',
      ),
    );
  });

  it('does not overwrite a name the user already typed', async () => {
    aiProviderStore.add.mockResolvedValue(providerFixture({ id: 'new1' }));

    const { findByText, findByPlaceholderText } = await renderScreen();
    await fireEvent.press(await findByText('Add'));
    fireEvent.changeText(await findByPlaceholderText('My provider'), 'Mine');
    await fireEvent.press(await findByText('DeepSeek'));
    await fireEvent.press(await findByText('Save'));

    await waitFor(() =>
      expect(aiProviderStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Mine' }),
        undefined,
      ),
    );
  });

  it('offers exactly the kinds the service reports an adapter for', async () => {
    const { findByText, queryByText } = await renderScreen();
    await fireEvent.press(await findByText('Add'));

    await findByText('OpenAI-compatible');
    await findByText('Local / LAN');
    // The mock reports only those two. A kind with no registered adapter must
    // never be offerable, or the user could save a provider that cannot run.
    expect(queryByText('Claude')).toBeNull();
    expect(queryByText('Gemini')).toBeNull();
  });

  it('picks up a newly registered adapter with no UI change', async () => {
    aiService.supportedKinds.mockReturnValue([
      'openai-compatible',
      'local',
      'anthropic',
      'gemini',
    ]);

    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Add'));

    await findByText('Claude');
    await findByText('Gemini');
  });
});
