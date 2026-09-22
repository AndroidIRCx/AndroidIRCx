/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Keychain from 'react-native-keychain';
import { aiService, MAX_PROMPT_CHARS } from '../../src/services/ai/AIService';
import { aiProviderStore } from '../../src/services/ai/AIProviderStore';

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const reply = (text: string) =>
  jsonResponse({ choices: [{ message: { content: text } }] });

async function addProvider(overrides: Record<string, unknown> = {}, key = 'k') {
  return aiProviderStore.add(
    {
      name: 'OpenAI',
      kind: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'some-model',
      ...overrides,
    } as any,
    key,
  );
}

describe('AIService', () => {
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    (AsyncStorage as any).__reset();
    (Keychain as any).__reset();
    aiProviderStore.resetForTests();
    aiService.resetForTests();
    fetchMock = jest.fn().mockResolvedValue(reply('answer'));
    (global as any).fetch = fetchMock;
    // Consent is off by default and gates every cloud provider; the tests
    // below are about other behaviour, so grant it here and gate it in its
    // own describe block.
    await aiService.setConsent(true);
  });

  describe('availability and the kill switch', () => {
    it('is unavailable with no providers configured', async () => {
      expect(await aiService.isAvailable()).toBe(false);
      await expect(aiService.ask('hi')).rejects.toMatchObject({
        code: 'no_provider',
      });
    });

    it('is unavailable while switched off, without touching the network', async () => {
      await addProvider();
      expect(await aiService.isAvailable()).toBe(true);

      await aiService.setEnabled(false);

      expect(await aiService.isAvailable()).toBe(false);
      await expect(aiService.ask('hi')).rejects.toMatchObject({
        code: 'disabled',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('restores the kill switch state from storage', async () => {
      await aiService.setEnabled(false);
      aiService.resetForTests();

      await aiService.loadSettings();

      expect(aiService.isEnabled()).toBe(false);
    });

    it('treats a keyless cloud provider as unavailable', async () => {
      const provider = await addProvider();
      await aiProviderStore.setKey(provider.id, null);

      expect(await aiService.isAvailable()).toBe(false);
      await expect(aiService.ask('hi')).rejects.toMatchObject({
        code: 'missing_key',
      });
    });

    it('treats a keyless local provider as available', async () => {
      await aiProviderStore.add(
        {
          name: 'Ollama',
          kind: 'local',
          baseUrl: 'http://192.168.1.10:11434/v1',
          model: 'llama3',
        },
        undefined,
      );

      expect(await aiService.isAvailable()).toBe(true);
    });

    it('reports a disabled provider distinctly from an unknown one', async () => {
      const provider = await addProvider();
      await aiProviderStore.update(provider.id, { enabled: false });

      await expect(
        aiService.ask('hi', { provider: provider.id }),
      ).rejects.toMatchObject({ code: 'provider_disabled' });

      await expect(
        aiService.ask('hi', { provider: 'nope' }),
      ).rejects.toMatchObject({ code: 'no_provider' });
    });
  });

  describe('requests', () => {
    it('returns the provider reply', async () => {
      await addProvider();

      const result = await aiService.ask('hi');

      expect(result.text).toBe('answer');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects an empty message list', async () => {
      await addProvider();

      await expect(aiService.chat([])).rejects.toMatchObject({
        code: 'invalid_request',
      });
    });

    it('rejects an over-long prompt before spending a request', async () => {
      await addProvider();

      await expect(
        aiService.ask('x'.repeat(MAX_PROMPT_CHARS + 1)),
      ).rejects.toMatchObject({ code: 'prompt_too_long' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('counts the system prompt towards the length cap', async () => {
      await addProvider();

      await expect(
        aiService.ask('x'.repeat(MAX_PROMPT_CHARS - 10), {
          system: 'y'.repeat(50),
        }),
      ).rejects.toMatchObject({ code: 'prompt_too_long' });
    });

    it('clamps maxTokens to the allowed ceiling', async () => {
      await addProvider();

      await aiService.ask('hi', { maxTokens: 999999 });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(8192);
    });

    it('routes to a named provider', async () => {
      await addProvider();
      const second = await addProvider(
        { name: 'Local', kind: 'local', baseUrl: 'http://10.0.0.5:1234/v1' },
        '',
      );

      await aiService.ask('hi', { provider: second.id });

      expect(fetchMock.mock.calls[0][0]).toBe(
        'http://10.0.0.5:1234/v1/chat/completions',
      );
    });

    it('lists models without spending tokens', async () => {
      await addProvider();
      fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'm1' }] }));

      expect(await aiService.listModels()).toEqual(['m1']);
      expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    });
  });

  describe('redaction', () => {
    it('strips IPs, emails and hostmasks before sending', async () => {
      await addProvider();

      await aiService.ask(
        'user!ident@host.example.com from 192.168.1.50 wrote to bob@example.com',
      );

      const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
      const content = sent.messages[0].content;
      expect(content).not.toContain('192.168.1.50');
      expect(content).not.toContain('bob@example.com');
      expect(content).not.toContain('user!ident@host.example.com');
      expect(content).toContain('[ip]');
    });

    it('redacts the system prompt too', async () => {
      await addProvider();

      await aiService.ask('hello', { system: 'admin is at 10.0.0.1' });

      const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sent.messages[0]).toEqual({
        role: 'system',
        content: 'admin is at [ip]',
      });
    });

    it('can be switched off', async () => {
      await addProvider();
      aiService.setRedactionEnabled(false);

      await aiService.ask('ping 192.168.1.50');

      expect(
        JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content,
      ).toBe('ping 192.168.1.50');
    });
  });

  describe('diagnose', () => {
    it('is happy when everything is set up', async () => {
      await addProvider();

      expect(await aiService.diagnose()).toEqual({
        code: 'ok',
        ready: true,
        reason: '',
        where: '',
      });
    });

    it('reports the blockers in the order they must be fixed', async () => {
      // Nothing configured at all: the master switch is irrelevant until
      // there is a provider, so the provider is what it must name.
      await aiService.setEnabled(false);
      let readiness = await aiService.diagnose();
      expect(readiness.code).toBe('disabled');
      expect(readiness.where).toContain('Enable AI');

      await aiService.setEnabled(true);
      readiness = await aiService.diagnose();
      expect(readiness.code).toBe('no_provider');
      expect(readiness.where).toContain('AI Providers');

      const provider = await addProvider();
      await aiProviderStore.setKey(provider.id, null);
      readiness = await aiService.diagnose();
      expect(readiness.code).toBe('missing_key');
      expect(readiness.reason).toContain('OpenAI');
      expect(readiness.where).toContain('Edit');

      await aiProviderStore.setKey(provider.id, 'k');
      await aiService.setConsent(false);
      readiness = await aiService.diagnose();
      expect(readiness.code).toBe('consent_required');
      expect(readiness.where).toContain('Privacy');
    });

    it('never asks for consent for a local provider', async () => {
      await aiProviderStore.add({
        name: 'Ollama',
        kind: 'local',
        baseUrl: 'http://192.168.1.10:11434/v1',
        model: 'llama3',
      } as any);
      await aiService.setConsent(false);

      expect((await aiService.diagnose()).ready).toBe(true);
    });

    it('always says where, whenever it says no', async () => {
      await aiService.setEnabled(false);
      const readiness = await aiService.diagnose();

      // A refusal with no path is the thing this exists to prevent.
      expect(readiness.ready).toBe(false);
      expect(readiness.reason.length).toBeGreaterThan(0);
      expect(readiness.where.length).toBeGreaterThan(0);
    });
  });

  describe('actionable errors', () => {
    it('puts the settings path in the consent refusal', async () => {
      await addProvider();
      await aiService.setConsent(false);

      await expect(aiService.ask('hi')).rejects.toMatchObject({
        code: 'consent_required',
        message: expect.stringContaining('Privacy'),
      });
    });

    it('names the channel and the path when a channel is not opted in', async () => {
      await addProvider();

      await expect(
        aiService.ask('hi', { channel: '#secret', network: 'net1' }),
      ).rejects.toMatchObject({
        code: 'channel_not_allowed',
        message: expect.stringContaining('#secret'),
      });
      // The script log shows this verbatim, so it has to carry the fix.
      await expect(
        aiService.ask('hi', { channel: '#secret', network: 'net1' }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Settings'),
      });
    });
  });

  describe('consent', () => {
    it('refuses a cloud provider until the user has agreed', async () => {
      await addProvider();
      await aiService.setConsent(false);

      await expect(aiService.ask('hi')).rejects.toMatchObject({
        code: 'consent_required',
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await aiService.isAvailable()).toBe(false);
    });

    it('never asks for a local provider — nothing leaves the network', async () => {
      await aiProviderStore.add({
        name: 'Ollama',
        kind: 'local',
        baseUrl: 'http://192.168.1.10:11434/v1',
        model: 'llama3',
      } as any);
      await aiService.setConsent(false);

      expect(await aiService.isAvailable()).toBe(true);
      await expect(aiService.ask('hi')).resolves.toMatchObject({
        text: 'answer',
      });
    });

    it('takes effect on the next call when withdrawn', async () => {
      await addProvider();
      await aiService.ask('first');

      await aiService.setConsent(false);

      await expect(aiService.ask('second')).rejects.toMatchObject({
        code: 'consent_required',
      });
    });

    it('survives a reload', async () => {
      await addProvider();
      aiService.resetForTests();

      await aiService.loadSettings();

      expect(aiService.hasConsent()).toBe(true);
    });
  });

  describe('per-channel opt-in', () => {
    it('refuses a channel the user has not opted in', async () => {
      await addProvider();

      await expect(
        aiService.ask('what did they say', {
          channel: '#secret',
          network: 'net1',
        }),
      ).rejects.toMatchObject({ code: 'channel_not_allowed' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('allows a channel once opted in, case-insensitively', async () => {
      await addProvider();
      await aiService.setChannelAllowed('#Chat', true, 'net1');

      await expect(
        aiService.ask('hi', { channel: '#chat', network: 'net1' }),
      ).resolves.toBeDefined();
    });

    it('scopes the opt-in to one network', async () => {
      await addProvider();
      await aiService.setChannelAllowed('#chat', true, 'net1');

      await expect(
        aiService.ask('hi', { channel: '#chat', network: 'net2' }),
      ).rejects.toMatchObject({ code: 'channel_not_allowed' });
    });

    it('revokes cleanly', async () => {
      await addProvider();
      await aiService.setChannelAllowed('#chat', true, 'net1');
      await aiService.setChannelAllowed('#chat', false, 'net1');

      expect(aiService.isChannelAllowed('#chat', 'net1')).toBe(false);
      expect(aiService.listAllowedChannels()).toEqual([]);
    });

    it('does not gate a prompt with no channel named', async () => {
      await addProvider();

      // A question the user typed themselves carries nobody else's words.
      await expect(aiService.ask('what is irc')).resolves.toBeDefined();
    });
  });

  describe('nick pseudonymization', () => {
    it('replaces speakers consistently across the whole request', async () => {
      await addProvider();

      await aiService.chat([
        { role: 'user', content: '<alice> hello\n<bob> hi alice\n<alice> bye' },
      ]);

      const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
      const content = sent.messages[0].content;
      expect(content).not.toContain('alice');
      expect(content).not.toContain('bob');
      // alice appears twice and must keep the same alias, or the model
      // can no longer tell who replied to whom.
      // A nick mentioned inside the text is replaced too, with the same alias
      // it gets as a speaker.
      expect(content).toBe('<user1> hello\n<user2> hi user1\n<user1> bye');
    });

    it('handles the "nick: text" transcript shape too', async () => {
      await addProvider();

      await aiService.ask('alice: ping\nbob: pong');

      const content = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0]
        .content;
      expect(content).toBe('user1: ping\nuser2: pong');
    });

    it('keeps hostmasks from leaking a nick through the email rule', async () => {
      await addProvider();

      await aiService.ask('alice!ident@host.example.com said hi');

      const content = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0]
        .content;
      expect(content).toBe('[hostmask] said hi');
    });
  });

  describe('anti-flood limits', () => {
    it('enforces a cooldown between calls from the same caller', async () => {
      await addProvider();
      aiService.setLimits({ cooldownMs: 60000 });

      await aiService.ask('first', {}, 'script-a');

      await expect(
        aiService.ask('second', {}, 'script-a'),
      ).rejects.toMatchObject({ code: 'rate_limited' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('limits each caller independently', async () => {
      await addProvider();
      aiService.setLimits({ cooldownMs: 60000 });

      await aiService.ask('first', {}, 'script-a');
      await aiService.ask('first', {}, 'script-b');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('enforces the daily quota', async () => {
      await addProvider();
      aiService.setLimits({ cooldownMs: 0, maxCallsPerDay: 2 });

      await aiService.ask('one', {}, 'script-a');
      await aiService.ask('two', {}, 'script-a');

      await expect(
        aiService.ask('three', {}, 'script-a'),
      ).rejects.toMatchObject({ code: 'quota_exceeded' });
    });

    it('caps concurrent in-flight calls', async () => {
      await addProvider();
      aiService.setLimits({ cooldownMs: 0, maxConcurrent: 1 });

      let release: (value: Response) => void = () => {};
      fetchMock.mockReturnValueOnce(
        new Promise<Response>(resolve => {
          release = resolve;
        }),
      );

      const inFlight = aiService.ask('slow', {}, 'script-a');

      await expect(aiService.ask('fast', {}, 'script-a')).rejects.toMatchObject(
        { code: 'rate_limited' },
      );

      release(reply('done'));
      await expect(inFlight).resolves.toMatchObject({ text: 'done' });

      // The slot is released, so the caller can go again.
      await expect(
        aiService.ask('next', {}, 'script-a'),
      ).resolves.toBeDefined();
    });

    it('frees the concurrency slot when a request fails', async () => {
      await addProvider();
      aiService.setLimits({ cooldownMs: 0, maxConcurrent: 1 });
      fetchMock.mockRejectedValueOnce(new Error('boom'));

      await expect(aiService.ask('one', {}, 'script-a')).rejects.toMatchObject({
        code: 'network',
      });

      fetchMock.mockResolvedValue(reply('recovered'));
      await expect(aiService.ask('two', {}, 'script-a')).resolves.toMatchObject(
        {
          text: 'recovered',
        },
      );
    });

    it('does not consume quota when the prompt is rejected up front', async () => {
      await addProvider();
      aiService.setLimits({ cooldownMs: 0, maxCallsPerDay: 1 });

      await expect(
        aiService.ask('x'.repeat(MAX_PROMPT_CHARS + 1), {}, 'script-a'),
      ).rejects.toMatchObject({ code: 'prompt_too_long' });

      await expect(aiService.ask('ok', {}, 'script-a')).resolves.toBeDefined();
    });

    it('resets remembered limits for a caller', async () => {
      await addProvider();
      aiService.setLimits({ cooldownMs: 60000 });

      await aiService.ask('first', {}, 'script-a');
      aiService.resetLimits('script-a');

      await expect(
        aiService.ask('second', {}, 'script-a'),
      ).resolves.toBeDefined();
    });
  });
});
