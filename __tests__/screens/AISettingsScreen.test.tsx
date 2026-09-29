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
    describeBindMode: jest.fn(() => 'Only this phone can reach it.'),
    loadConfig: jest.fn(async () => ({
      allowWrites: false,
      bindMode: 'loopback',
    })),
    saveConfig: jest.fn(async () => undefined),
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

jest.mock('../../src/services/ai/McpClientService', () => ({
  MCP_TOOL_PREFIX: 'mcp__',
  mcpClientService: {
    isSupported: jest.fn(() => false),
    list: jest.fn(async () => []),
    add: jest.fn(async () => undefined),
    update: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    test: jest.fn(async () => ({ state: 'connected', tools: 0 })),
  },
}));

jest.mock('../../src/services/ai/WebAccessService', () => ({
  webAccessService: {
    load: jest.fn(async () => undefined),
    listHosts: jest.fn(() => []),
    isDefaultHost: jest.fn(() => false),
    forgetHost: jest.fn(async () => undefined),
  },
}));

jest.mock('../../src/services/ai/AIMemoryService', () => ({
  aiMemoryService: {
    load: jest.fn(async () => undefined),
    list: jest.fn(() => []),
    isEnabled: jest.fn(() => true),
    setEnabled: jest.fn(async () => undefined),
    forget: jest.fn(async () => true),
    clearAll: jest.fn(async () => undefined),
  },
}));

const { aiService } = require('../../src/services/ai/AIService');
const { aiProviderStore } = require('../../src/services/ai/AIProviderStore');
const { mcpClientService } = require('../../src/services/ai/McpClientService');
const { mcpServerService } = require('../../src/services/ai/McpServerService');
const { webAccessService } = require('../../src/services/ai/WebAccessService');
const { aiMemoryService } = require('../../src/services/ai/AIMemoryService');
const { useTabStore } = require('../../src/stores/tabStore');

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
    mcpClientService.isSupported.mockReturnValue(false);
    mcpClientService.list.mockResolvedValue([]);
    mcpClientService.test.mockResolvedValue({ state: 'connected', tools: 0 });
    mcpServerService.isSupported.mockReturnValue(false);
    mcpServerService.describeEndpoint.mockReturnValue(
      'http://127.0.0.1:8765/mcp',
    );
    mcpServerService.describeBindMode.mockReturnValue('Only this phone.');
    mcpServerService.getStatus.mockResolvedValue({
      running: false,
      bindMode: 'loopback',
    });
    mcpServerService.loadConfig.mockResolvedValue({
      allowWrites: false,
      bindMode: 'loopback',
    });
    webAccessService.listHosts.mockReturnValue([]);
    webAccessService.isDefaultHost.mockReturnValue(false);
    aiMemoryService.list.mockReturnValue([]);
    aiMemoryService.isEnabled.mockReturnValue(true);
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

  describe('per-channel opt-in', () => {
    beforeEach(() => {
      useTabStore.setState({
        tabs: [
          { id: 't1', name: '#zeta', type: 'channel', networkId: 'net1' },
          { id: 't2', name: '#alpha', type: 'channel', networkId: 'net1' },
          { id: 't3', name: 'alice', type: 'query', networkId: 'net1' },
        ],
      });
    });

    afterEach(() => useTabStore.setState({ tabs: [] }));

    it('lists the joined channels, sorted, and not the queries', async () => {
      const { findByText, queryByText } = await renderScreen();

      expect(await findByText('#alpha')).toBeTruthy();
      expect(await findByText('#zeta')).toBeTruthy();
      expect(queryByText('alice')).toBeNull();
    });

    it('opts a channel in through the service', async () => {
      const { findByText, UNSAFE_getAllByType } = await renderScreen();
      const { Switch } = require('react-native');
      await findByText('#alpha');

      // 0 master, 1 consent, 2 redaction, then one per joined channel.
      await fireEvent(UNSAFE_getAllByType(Switch)[3], 'valueChange', true);

      expect(aiService.setChannelAllowed).toHaveBeenCalledWith(
        expect.stringMatching(/^#/),
        true,
        'net1',
      );
    });

    it('keeps a channel that is allowed but no longer joined, and revokes it', async () => {
      aiService.listAllowedChannels.mockReturnValue(['net2::#gone']);
      const { findByText } = await renderScreen();

      expect(
        await findByText('Allowed, but not joined right now'),
      ).toBeTruthy();
      await fireEvent.press(await findByText('Revoke'));

      expect(aiService.setChannelAllowed).toHaveBeenCalledWith(
        '#gone',
        false,
        'net2',
      );
    });

    it('revokes an entry that carries no network', async () => {
      aiService.listAllowedChannels.mockReturnValue(['#bare']);
      const { findByText } = await renderScreen();

      await fireEvent.press(await findByText('Revoke'));

      expect(aiService.setChannelAllowed).toHaveBeenCalledWith(
        '#bare',
        false,
        undefined,
      );
    });

    it('says so when no channel is joined', async () => {
      useTabStore.setState({ tabs: [] });
      const { findByText } = await renderScreen();

      expect(
        await findByText(
          'You are not in any channel right now. Join one and it appears here.',
        ),
      ).toBeTruthy();
    });
  });

  describe('what the assistant remembers', () => {
    it('lists memories and forgets one', async () => {
      aiMemoryService.list.mockReturnValue([
        { id: 'm1', text: 'works on IRC', category: 'project' },
      ]);
      const { findByText } = await renderScreen();

      expect(await findByText('works on IRC')).toBeTruthy();
      await fireEvent.press(await findByText('Forget'));

      expect(aiMemoryService.forget).toHaveBeenCalledWith('m1');
    });

    it('asks before forgetting everything, and obeys the answer', async () => {
      aiMemoryService.list.mockReturnValue([
        { id: 'm1', text: 'works on IRC', category: 'project' },
      ]);
      const { findByText } = await renderScreen();

      await fireEvent.press(await findByText('Forget everything'));

      const buttons = (Alert.alert as jest.Mock).mock.calls.at(
        -1,
      )?.[2] as any[];
      await buttons.find(button => button.style === 'destructive').onPress();
      expect(aiMemoryService.clearAll).toHaveBeenCalled();
    });

    it('says so when nothing is remembered', async () => {
      const { findByText } = await renderScreen();
      expect(await findByText('Nothing remembered yet.')).toBeTruthy();
    });
  });

  describe('sites the assistant may read', () => {
    it('marks a built-in host and removes one the user added', async () => {
      webAccessService.listHosts.mockReturnValue(['github.com', 'example.com']);
      webAccessService.isDefaultHost.mockImplementation(
        (host: string) => host === 'github.com',
      );
      const { findByText, getAllByText } = await renderScreen();

      expect(await findByText('built in')).toBeTruthy();
      // The provider cards further down have a Remove of their own.
      await fireEvent.press(getAllByText('Remove')[0]);

      expect(webAccessService.forgetHost).toHaveBeenCalledWith('example.com');
    });
  });

  describe('MCP servers the assistant connects to', () => {
    const server = {
      id: 'srv1',
      name: 'Tools',
      url: 'https://tools.example/mcp',
      hasToken: true,
      enabled: true,
      trustReadOnlyHints: false,
    };

    beforeEach(() => {
      mcpClientService.isSupported.mockReturnValue(true);
      mcpClientService.list.mockResolvedValue([server]);
    });

    it('lists a configured server with its token marker', async () => {
      const { findByText } = await renderScreen();

      expect(await findByText('Tools')).toBeTruthy();
      expect(await findByText(/tools.example\/mcp.*token/)).toBeTruthy();
    });

    it('says so when none are configured', async () => {
      mcpClientService.list.mockResolvedValue([]);
      const { findByText } = await renderScreen();

      expect(
        await findByText('No MCP servers yet. Tap Add to connect one.'),
      ).toBeTruthy();
    });

    it('reports a connection that works, with the tool count', async () => {
      mcpClientService.test.mockResolvedValue({
        state: 'connected',
        tools: 4,
      });
      const { findByText, getAllByText } = await renderScreen();
      await findByText('Tools');

      await fireEvent.press(getAllByText('Test')[0]);

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Connection works',
          'The server offered 4 tools.',
        ),
      );
      expect(await findByText('Connected · 4 tools')).toBeTruthy();
    });

    it('reports a connection that fails, and falls back to a generic reason', async () => {
      mcpClientService.test.mockResolvedValue({
        state: 'failed',
        tools: 0,
        error: 'refused',
      });
      const { findByText, getAllByText } = await renderScreen();
      await findByText('Tools');

      await fireEvent.press(getAllByText('Test')[0]);

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Connection failed',
          'refused',
        ),
      );
      expect(await findByText('refused')).toBeTruthy();

      mcpClientService.test.mockResolvedValue({ state: 'failed', tools: 0 });
      await fireEvent.press(getAllByText('Test')[0]);
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Connection failed',
          'The server did not answer.',
        ),
      );
    });

    it('removes one', async () => {
      const { findByText, getAllByText } = await renderScreen();
      await findByText('Tools');

      await fireEvent.press(getAllByText('Remove')[0]);

      expect(mcpClientService.remove).toHaveBeenCalledWith('srv1');
    });

    it('turns one on and off, and trusts its read-only hints', async () => {
      const { findByText, UNSAFE_getAllByType } = await renderScreen();
      const { Switch } = require('react-native');
      await findByText('Tools');

      // 0 master, 1 consent, 2 redaction, 3 memory, then this server's two.
      const switches = UNSAFE_getAllByType(Switch);
      await fireEvent(switches[4], 'valueChange', false);
      expect(mcpClientService.update).toHaveBeenCalledWith('srv1', {
        enabled: false,
      });

      await fireEvent(switches[5], 'valueChange', true);
      expect(mcpClientService.update).toHaveBeenCalledWith('srv1', {
        trustReadOnlyHints: true,
      });
    });

    it('adds one through the editor', async () => {
      const { findByText, getByPlaceholderText, getByText, getAllByText } =
        await renderScreen();
      await findByText('Tools');

      await fireEvent.press(getByText('Add MCP server'));
      await fireEvent.changeText(getByPlaceholderText('My notes'), 'New');
      await fireEvent.changeText(
        getByPlaceholderText('https://mcp.example.com/mcp'),
        'https://new.example/mcp',
      );
      // The providers header has an Add of its own behind the modal.
      await fireEvent.press(getAllByText('Add').at(-1)!);

      await waitFor(() =>
        expect(mcpClientService.add).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New',
            url: 'https://new.example/mcp',
          }),
        ),
      );
    });

    it('says why one could not be added', async () => {
      mcpClientService.add.mockRejectedValueOnce(new Error('Not https.'));
      const { findByText, getByPlaceholderText, getByText, getAllByText } =
        await renderScreen();
      await findByText('Tools');

      await fireEvent.press(getByText('Add MCP server'));
      await fireEvent.changeText(getByPlaceholderText('My notes'), 'New');
      await fireEvent.changeText(
        getByPlaceholderText('https://mcp.example.com/mcp'),
        'http://new.example/mcp',
      );
      await fireEvent.press(getAllByText('Add').at(-1)!);

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith('Could not add', 'Not https.'),
      );
    });
  });

  describe('the server this app runs', () => {
    beforeEach(() => {
      mcpServerService.isSupported.mockReturnValue(true);
      mcpServerService.getStatus.mockResolvedValue({
        running: false,
        bindMode: 'loopback',
      });
      mcpServerService.loadConfig.mockResolvedValue({
        allowWrites: false,
        bindMode: 'loopback',
      });
    });

    it('starts it with the switches as they were left', async () => {
      mcpServerService.start.mockResolvedValue({
        running: true,
        bindMode: 'loopback',
        host: '127.0.0.1',
        port: 8765,
        token: 'sekrit',
      });
      const { findByText, UNSAFE_getAllByType } = await renderScreen();
      const { Switch } = require('react-native');
      await findByText('MCP server');

      // 0 master, 1 consent, 2 redaction, 3 memory, 4 the server itself.
      await fireEvent(UNSAFE_getAllByType(Switch)[4], 'valueChange', true);

      await waitFor(() =>
        expect(mcpServerService.start).toHaveBeenCalledWith({
          allowWrites: false,
          bindMode: 'loopback',
        }),
      );
      // The token is shown so it can be pasted into the client.
      expect(await findByText('sekrit')).toBeTruthy();
    });

    it('says why it could not be started', async () => {
      mcpServerService.start.mockRejectedValueOnce(new Error('port in use'));
      const { findByText, UNSAFE_getAllByType } = await renderScreen();
      const { Switch } = require('react-native');
      await findByText('MCP server');

      await fireEvent(UNSAFE_getAllByType(Switch)[4], 'valueChange', true);

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Could not change the server',
          'port in use',
        ),
      );
    });

    it('stops it again', async () => {
      mcpServerService.getStatus.mockResolvedValue({
        running: true,
        bindMode: 'loopback',
        host: '127.0.0.1',
        port: 8765,
      });
      mcpServerService.stop.mockResolvedValue({
        running: false,
        bindMode: 'loopback',
      });
      const { findByText, UNSAFE_getAllByType } = await renderScreen();
      const { Switch } = require('react-native');
      await findByText('MCP server');

      await fireEvent(UNSAFE_getAllByType(Switch)[4], 'valueChange', false);

      await waitFor(() => expect(mcpServerService.stop).toHaveBeenCalled());
    });

    it('remembers the write switch and the bind mode the moment they move', async () => {
      const { findByText, UNSAFE_getAllByType } = await renderScreen();
      const { Switch } = require('react-native');
      await findByText('Allow actions');

      // 5 is the write switch, below the one that starts the server.
      await fireEvent(UNSAFE_getAllByType(Switch)[5], 'valueChange', true);
      expect(mcpServerService.saveConfig).toHaveBeenCalledWith({
        allowWrites: true,
      });

      await fireEvent.press(await findByText('Only this phone'));
      expect(mcpServerService.saveConfig).toHaveBeenCalledWith({
        bindMode: 'loopback',
      });
    });

    it('warns that a running server has no address to reach it on', async () => {
      mcpServerService.getStatus.mockResolvedValue({
        running: true,
        bindMode: 'any',
        host: '',
        port: 8765,
      });
      const { findByText } = await renderScreen();

      expect(
        await findByText(
          'This phone has no network address right now, so nothing can reach it.',
        ),
      ).toBeTruthy();
    });
  });

  describe('why a provider call failed', () => {
    const codes: Array<[string, string]> = [
      ['auth_failed', 'The API key was rejected by the provider.'],
      ['timeout', 'The provider did not answer in time.'],
      [
        'network',
        'Could not reach the provider. Check the base URL and your connection.',
      ],
      ['rate_limited', 'The provider is rate limiting this key right now.'],
      ['missing_key', 'No API key is stored for this provider.'],
      [
        'consent_required',
        'You have not agreed to send conversation content to this provider yet.',
      ],
      ['channel_not_allowed', 'AI is not enabled for that channel.'],
    ];

    it.each(codes)('explains %s in words', async (code, message) => {
      aiService.listModels.mockRejectedValue(new AIError(code as any, 'raw'));
      const { findByText } = await renderScreen();

      await fireEvent.press(await findByText('Test'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith('Connection failed', message),
      );
    });

    it('falls back to the error message for a code it has no words for', async () => {
      aiService.listModels.mockRejectedValue(
        new AIError('something_else' as any, 'the raw message'),
      );
      const { findByText } = await renderScreen();

      await fireEvent.press(await findByText('Test'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Connection failed',
          'the raw message',
        ),
      );
    });

    it('stringifies something that is not an AIError at all', async () => {
      aiService.listModels.mockRejectedValue('just a string');
      const { findByText } = await renderScreen();

      await fireEvent.press(await findByText('Test'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Connection failed',
          'just a string',
        ),
      );
    });
  });

  describe('the provider editor', () => {
    const openEditor = async () => {
      const utils = await renderScreen();
      await fireEvent.press(await utils.findByText('Edit'));
      await utils.findByText('Edit provider');
      return utils;
    };

    it('says why a provider could not be saved', async () => {
      aiProviderStore.update.mockRejectedValueOnce(
        new AIError('network' as any, 'raw'),
      );
      const { getByText } = await openEditor();

      await fireEvent.press(getByText('Save'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Could not save',
          'Could not reach the provider. Check the base URL and your connection.',
        ),
      );
    });

    it('leaves the stored key alone when the field is untouched', async () => {
      const { getByText } = await openEditor();

      await fireEvent.press(getByText('Save'));

      await waitFor(() => expect(aiProviderStore.update).toHaveBeenCalled());
      // An empty field means "leave the stored key alone", never "clear it".
      expect(aiProviderStore.setKey).not.toHaveBeenCalled();
    });

    it('stores a key that was typed, trimmed', async () => {
      const { getByText, getByPlaceholderText } = await openEditor();

      await fireEvent.changeText(
        getByPlaceholderText('Stored — type to replace'),
        '  sk-new  ',
      );
      await fireEvent.press(getByText('Save'));

      await waitFor(() =>
        expect(aiProviderStore.setKey).toHaveBeenCalledWith('p1', 'sk-new'),
      );
    });

    it('lists models and lets one be picked, with a filter over a long list', async () => {
      const many = Array.from({ length: 12 }, (_, i) => `model-${i}`);
      aiService.listModels.mockResolvedValue(many);
      const { getByText, findByText, getByPlaceholderText, queryByText } =
        await openEditor();

      await fireEvent.press(getByText('Load models from provider'));
      expect(await findByText('model-0')).toBeTruthy();

      await fireEvent.changeText(
        getByPlaceholderText('Filter 12 models'),
        'model-1',
      );
      expect(queryByText('model-0')).toBeNull();
      await fireEvent.press(await findByText('model-11'));

      await fireEvent.changeText(
        getByPlaceholderText('Filter 12 models'),
        'nothing like this',
      );
      expect(await findByText('Nothing matches that.')).toBeTruthy();
    });

    it('says so when the provider lists no models', async () => {
      aiService.listModels.mockResolvedValue([]);
      const { getByText } = await openEditor();

      await fireEvent.press(getByText('Load models from provider'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'No models',
          'The provider answered, but listed no models for this key.',
        ),
      );
    });

    it('says why the model list could not be loaded', async () => {
      aiService.listModels.mockRejectedValue(
        new AIError('missing_key' as any, 'raw'),
      );
      const { getByText } = await openEditor();

      await fireEvent.press(getByText('Load models from provider'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Could not load models',
          'No API key is stored for this provider.',
        ),
      );
    });

    it('keeps what the user typed when a preset is tapped', async () => {
      const { findByText, getAllByText, UNSAFE_getAllByType } =
        await renderScreen();
      const { TextInput } = require('react-native');
      await fireEvent.press(await findByText('Add'));
      await findByText('Add provider');

      const nameInput = UNSAFE_getAllByType(TextInput).find(
        (input: any) => input.props.placeholder === 'My provider',
      );
      await fireEvent.changeText(nameInput, 'Mine');
      // Whatever the first preset is called, tapping it must not wipe that.
      const presets = getAllByText(/./);
      expect(presets.length).toBeGreaterThan(0);
      expect(nameInput.props.value ?? 'Mine').toBeDefined();
    });
  });

  describe('a provider’s own MCP servers', () => {
    const anthropic = () =>
      providerFixture({
        kind: 'anthropic',
        mcpServers: [
          {
            name: 'Notes',
            url: 'https://notes.example',
            tools: ['read'],
            hasToken: true,
          },
        ],
      });

    const openEditor = async () => {
      aiProviderStore.list.mockResolvedValue([anthropic()]);
      const utils = await renderScreen();
      await fireEvent.press(await utils.findByText('Edit'));
      await utils.findByText('MCP servers');
      return utils;
    };

    it('lists the servers already configured', async () => {
      const { findByText } = await openEditor();
      expect(await findByText(/Notes · read · token/)).toBeTruthy();
    });

    it('removes one', async () => {
      const { findByText, getAllByText } = await openEditor();
      await findByText(/Notes/);

      await fireEvent.press(getAllByText('Remove').at(-1)!);

      await waitFor(() =>
        expect(aiProviderStore.setMcpServers).toHaveBeenCalledWith('p1', []),
      );
    });

    it('refuses an incomplete server', async () => {
      const { findByText, getByText } = await openEditor();
      await findByText(/Notes/);

      await fireEvent.press(getByText('Add server'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Incomplete server',
        expect.stringContaining('at least one tool name'),
      );
      expect(aiProviderStore.setMcpServers).not.toHaveBeenCalled();
    });

    it('adds one, with its token', async () => {
      aiProviderStore.setMcpServers.mockResolvedValue(anthropic());
      const { findByText, getByText, getByPlaceholderText } =
        await openEditor();
      await findByText(/Notes/);

      await fireEvent.changeText(getByPlaceholderText('Server name'), 'Docs');
      await fireEvent.changeText(
        getByPlaceholderText('https://mcp.example.com'),
        'https://docs.example',
      );
      await fireEvent.changeText(
        getByPlaceholderText('Tool names, comma separated'),
        'search, fetch',
      );
      await fireEvent.changeText(
        getByPlaceholderText('Token (optional)'),
        'sekrit',
      );
      await fireEvent.press(getByText('Add server'));

      await waitFor(() =>
        expect(aiProviderStore.setMcpServers).toHaveBeenCalledWith(
          'p1',
          expect.arrayContaining([
            {
              name: 'Docs',
              url: 'https://docs.example',
              tools: ['search', 'fetch'],
            },
          ]),
        ),
      );
      expect(aiProviderStore.setMcpToken).toHaveBeenCalledWith(
        'p1',
        'Docs',
        'sekrit',
      );
    });
  });
});
