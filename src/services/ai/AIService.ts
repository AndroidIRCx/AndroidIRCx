/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../Logger';
import { aiProviderStore, MAX_ALLOWED_TOKENS } from './AIProviderStore';
import { openAICompatProvider } from './providers/OpenAICompatProvider';
import { anthropicProvider } from './providers/AnthropicProvider';
import { geminiProvider } from './providers/GeminiProvider';
import { measureRequest } from './measure';
import {
  AIError,
  AIMessage,
  AIProviderAdapter,
  AIProviderInfo,
  AIProviderKind,
  AIReadiness,
  AIRequestOptions,
  AIResult,
} from './types';

const STORAGE_ENABLED_KEY = '@AndroidIRCX:aiEnabled';
const STORAGE_CONSENT_KEY = '@AndroidIRCX:aiConsent';
const STORAGE_CHANNELS_KEY = '@AndroidIRCX:aiChannels';
const STORAGE_REDACTION_KEY = '@AndroidIRCX:aiRedaction';

/**
 * The hard ceiling on one request, in characters.
 *
 * This used to be 8000 and counted only `system` plus each message's
 * `content` — not `toolResults`. So a 40 KB page from `fetch_page` sailed
 * through uncounted while a dozen ordinary exchanges were refused: it was
 * measuring the wrong thing and set too low besides.
 *
 * It is now a backstop, not a budget. A caller that wants to stay well under
 * it (the assistant compacting its own history) does that itself; this only
 * stops a runaway script sending a novel. Roughly 30k tokens, which every
 * current model comfortably exceeds.
 */
export const MAX_PROMPT_CHARS = 120000;
export const DEFAULT_TIMEOUT_MS = 30000;
/** Minimum gap between two calls from the same caller. */
export const DEFAULT_COOLDOWN_MS = 5000;
/** Rolling 24h cap per caller. */
export const DEFAULT_MAX_CALLS_PER_DAY = 100;
/** In-flight calls allowed per caller. */
export const DEFAULT_MAX_CONCURRENT = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

interface CallerState {
  lastCallAt: number;
  windowStartedAt: number;
  callsInWindow: number;
  inFlight: number;
}

export interface AILimits {
  cooldownMs: number;
  maxCallsPerDay: number;
  maxConcurrent: number;
}

/**
 * The assistant's own limits.
 *
 * The defaults above were written for a *script* reacting to channel traffic,
 * where one call per event is the whole point and a gap between them stops a
 * flood. The assistant is a person typing into a screen, which is its own rate
 * limit, and it inherited numbers that only got in their way. The daily cap
 * stays, higher, because it is the one that protects the user's bill.
 */
export const AGENT_LIMITS: AILimits = {
  cooldownMs: 0,
  maxCallsPerDay: 500,
  maxConcurrent: 2,
};

/**
 * Orchestrates AI calls: provider resolution, key lookup, anti-flood limits,
 * caps, redaction and the kill switch.
 *
 * Deliberately NOT here: monetization gating. `api.ai.*` rides the existing
 * scripting-time budget — scripts only run while AdRewardService has time (or
 * the user holds pro_unlimited / supporter_pro), so AI inherits that gate for
 * free. The limits here exist to stop a runaway script from flooding a channel
 * and burning the user's own provider credit, nothing else.
 */
class AIService {
  private adapters = new Map<AIProviderKind, AIProviderAdapter>();
  private callers = new Map<string, CallerState>();
  /** Per-caller overrides; see setLimitsFor. */
  private callerLimits = new Map<string, Partial<AILimits>>();
  private limits: AILimits = {
    cooldownMs: DEFAULT_COOLDOWN_MS,
    maxCallsPerDay: DEFAULT_MAX_CALLS_PER_DAY,
    maxConcurrent: DEFAULT_MAX_CONCURRENT,
  };
  private enabled = true;
  private enabledLoaded = false;
  /**
   * Explicit, informed consent to send conversation content to a third party.
   * Required before any cloud provider runs; `local` providers never ask,
   * because nothing leaves the user's own network.
   */
  private consentGranted = false;
  /** network::channel -> allowed. Absent means not allowed. */
  private allowedChannels: Record<string, boolean> = {};
  /**
   * Strips unambiguously sensitive tokens (IPs, IRC hostmasks, emails) before
   * a prompt leaves the device. Nick pseudonymization needs channel context and
   * lands with the rest of the privacy work in phase 6.
   */
  private redactionEnabled = true;

  constructor() {
    // `local` servers speak the OpenAI wire format, so they share the adapter.
    this.adapters.set('openai-compatible', openAICompatProvider);
    this.adapters.set('local', openAICompatProvider);
    this.adapters.set('anthropic', anthropicProvider);
    this.adapters.set('gemini', geminiProvider);
  }

  // --- Kill switch -------------------------------------------------------

  async loadSettings(): Promise<void> {
    if (this.enabledLoaded) return;
    try {
      const [raw, consent, channels, redaction] = await Promise.all([
        AsyncStorage.getItem(STORAGE_ENABLED_KEY),
        AsyncStorage.getItem(STORAGE_CONSENT_KEY),
        AsyncStorage.getItem(STORAGE_CHANNELS_KEY),
        AsyncStorage.getItem(STORAGE_REDACTION_KEY),
      ]);
      if (raw !== null) this.enabled = raw === 'true';
      this.consentGranted = consent === 'true';
      if (redaction !== null) this.redactionEnabled = redaction === 'true';
      if (channels) {
        const parsed = JSON.parse(channels);
        if (parsed && typeof parsed === 'object') this.allowedChannels = parsed;
      }
    } catch (error) {
      logger.warn('ai', `Failed to load AI settings: ${String(error)}`);
    } finally {
      this.enabledLoaded = true;
    }
  }

  // --- Consent -----------------------------------------------------------

  hasConsent(): boolean {
    return this.consentGranted;
  }

  /**
   * Record (or withdraw) the user's agreement to send conversation content to
   * a third-party provider. Withdrawing takes effect on the next call.
   */
  async setConsent(granted: boolean): Promise<void> {
    this.consentGranted = granted;
    try {
      await AsyncStorage.setItem(STORAGE_CONSENT_KEY, String(granted));
    } catch (error) {
      logger.warn('ai', `Failed to save AI consent: ${String(error)}`);
    }
  }

  /** True when this provider sends content off the device to a third party. */
  private isThirdParty(kind: AIProviderKind): boolean {
    return kind !== 'local';
  }

  // --- Per-channel opt-in -------------------------------------------------

  private channelKey(network: string | undefined, channel: string): string {
    return `${network || '*'}::${channel.toLowerCase()}`;
  }

  isChannelAllowed(channel: string, network?: string): boolean {
    if (!channel) return true;
    return this.allowedChannels[this.channelKey(network, channel)] === true;
  }

  async setChannelAllowed(
    channel: string,
    allowed: boolean,
    network?: string,
  ): Promise<void> {
    const key = this.channelKey(network, channel);
    if (allowed) {
      this.allowedChannels[key] = true;
    } else {
      delete this.allowedChannels[key];
    }
    try {
      await AsyncStorage.setItem(
        STORAGE_CHANNELS_KEY,
        JSON.stringify(this.allowedChannels),
      );
    } catch (error) {
      logger.warn('ai', `Failed to save AI channel list: ${String(error)}`);
    }
  }

  /** Channels the user has opted in, as "network::#channel" keys. */
  listAllowedChannels(): string[] {
    return Object.keys(this.allowedChannels).sort();
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    this.enabledLoaded = true;
    try {
      await AsyncStorage.setItem(STORAGE_ENABLED_KEY, String(enabled));
    } catch (error) {
      logger.warn('ai', `Failed to save AI settings: ${String(error)}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isRedactionEnabled(): boolean {
    return this.redactionEnabled;
  }

  setRedactionEnabled(enabled: boolean): void {
    this.redactionEnabled = enabled;
    AsyncStorage.setItem(STORAGE_REDACTION_KEY, String(enabled)).catch(error =>
      logger.warn('ai', `Failed to save AI redaction: ${String(error)}`),
    );
  }

  setLimits(limits: Partial<AILimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  getLimits(): AILimits {
    return { ...this.limits };
  }

  /**
   * Give one caller its own limits. Stored as a patch rather than a resolved
   * set, so a later `setLimits` still shows through for anything the override
   * does not mention.
   */
  setLimitsFor(callerId: string, limits: Partial<AILimits>): void {
    this.callerLimits.set(callerId, { ...limits });
  }

  clearLimitsFor(callerId: string): void {
    this.callerLimits.delete(callerId);
  }

  private limitsFor(callerId: string): AILimits {
    const override = this.callerLimits.get(callerId);
    return override ? { ...this.limits, ...override } : this.limits;
  }

  /** True when at least one enabled provider is usable right now. */
  async isAvailable(): Promise<boolean> {
    if (!this.enabled) return false;
    const provider = await aiProviderStore.resolve();
    if (!provider) return false;
    if (this.isThirdParty(provider.kind) && !this.consentGranted) return false;
    if (!aiProviderStore.requiresKey(provider.kind)) return true;
    return provider.hasKey;
  }

  /**
   * The same checks `isAvailable()` makes, but reported so a person can act
   * on them. Order matters: the master switch first, then a provider, then
   * its key, then consent — each step is pointless until the one before it
   * is done, so naming them in that order gives the user one thing to do.
   */
  async diagnose(): Promise<AIReadiness> {
    const settingsPath = 'Settings \u203a AI';
    if (!this.enabled) {
      return {
        code: 'disabled',
        ready: false,
        reason: 'AI is switched off.',
        where: `${settingsPath} \u203a Enable AI`,
      };
    }
    const provider = await aiProviderStore.resolve();
    if (!provider) {
      return {
        code: 'no_provider',
        ready: false,
        reason: 'No AI provider is set up.',
        where: `${settingsPath} \u203a AI Providers \u203a Add`,
      };
    }
    if (aiProviderStore.requiresKey(provider.kind) && !provider.hasKey) {
      return {
        code: 'missing_key',
        ready: false,
        reason: `"${provider.name}" has no API key stored.`,
        where: `${settingsPath} \u203a AI Providers \u203a ${provider.name} \u203a Edit`,
      };
    }
    if (this.isThirdParty(provider.kind) && !this.consentGranted) {
      return {
        code: 'consent_required',
        ready: false,
        reason: `Sending messages to "${provider.name}" has not been agreed to yet.`,
        where: `${settingsPath} \u203a Privacy \u203a Allow sending messages to a provider`,
      };
    }
    return { code: 'ok', ready: true, reason: '', where: '' };
  }

  /** Where the user enables AI for a channel, for error messages. */
  channelOptInPath(channel: string): string {
    return `Settings \u203a AI \u203a Privacy \u2014 then enable AI for ${channel}`;
  }

  async listProviders(): Promise<AIProviderInfo[]> {
    return aiProviderStore.listForScripts();
  }

  /**
   * Provider kinds that actually have an adapter right now. The Settings UI
   * builds its kind picker from this rather than a hardcoded list, so
   * registering a new adapter is the only change a new provider family needs.
   */
  supportedKinds(): AIProviderKind[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Whether this kind can reach MCP servers. Only provider-side MCP is
   * implemented, so this is true exactly where the provider offers it — the
   * app itself is not an MCP client (stdio needs a subprocess Android has not
   * got, and an in-app Streamable-HTTP client is a separate piece of work).
   */
  supportsMcp(kind: AIProviderKind): boolean {
    return kind === 'anthropic';
  }

  // --- Limits ------------------------------------------------------------

  private stateFor(callerId: string): CallerState {
    const existing = this.callers.get(callerId);
    if (existing) return existing;
    const fresh: CallerState = {
      lastCallAt: 0,
      windowStartedAt: 0,
      callsInWindow: 0,
      inFlight: 0,
    };
    this.callers.set(callerId, fresh);
    return fresh;
  }

  /**
   * Throws when the caller is over a limit; otherwise books the call.
   * Booking here (rather than after the request) is what makes the cooldown
   * hold under concurrent hook invocations.
   */
  private reserveSlot(callerId: string, continuesTurn = false): CallerState {
    const state = this.stateFor(callerId);
    const limits = this.limitsFor(callerId);
    const now = Date.now();

    if (now - state.windowStartedAt >= DAY_MS) {
      state.windowStartedAt = now;
      state.callsInWindow = 0;
    }

    if (state.inFlight >= limits.maxConcurrent) {
      throw new AIError(
        'rate_limited',
        `Too many AI requests in flight (max ${limits.maxConcurrent})`,
      );
    }

    // A continuation is part of a turn the caller already waited for, so the
    // gap has been served. Skipping it here rather than at the call site keeps
    // the daily cap and the concurrency limit applying to every request.
    const sinceLast = now - state.lastCallAt;
    if (
      !continuesTurn &&
      state.lastCallAt > 0 &&
      sinceLast < limits.cooldownMs
    ) {
      const waitSeconds = Math.ceil((limits.cooldownMs - sinceLast) / 1000);
      throw new AIError(
        'rate_limited',
        `AI cooldown active, retry in ${waitSeconds}s`,
      );
    }

    if (state.callsInWindow >= limits.maxCallsPerDay) {
      throw new AIError(
        'quota_exceeded',
        `Daily AI call limit reached (${limits.maxCallsPerDay})`,
      );
    }

    state.lastCallAt = now;
    state.callsInWindow += 1;
    state.inFlight += 1;
    return state;
  }

  private releaseSlot(state: CallerState): void {
    state.inFlight = Math.max(0, state.inFlight - 1);
  }

  /** Test/diagnostics hook: clears remembered per-caller limit state. */
  resetLimits(callerId?: string): void {
    if (callerId) {
      this.callers.delete(callerId);
    } else {
      this.callers.clear();
    }
  }

  getLimitsFor(callerId: string): AILimits {
    return { ...this.limitsFor(callerId) };
  }

  // --- Redaction ---------------------------------------------------------

  /**
   * First pass: learn who the speakers are, from the two shapes a transcript
   * normally uses ("<nick> text" and "nick: text"). Collecting across the
   * WHOLE request before rewriting anything is what lets a nick mentioned in
   * one message be pseudonymized in another, where it never speaks.
   */
  private collectNicks(text: string, nicks: Map<string, string>): void {
    const speaker = /(^|\n)(?:<([^<>\s]{1,32})>|([^\s:<>]{1,32}):)/g;
    let match = speaker.exec(text);
    while (match) {
      const nick = match[2] || match[3];
      const key = nick?.toLowerCase();
      if (key && !nicks.has(key)) {
        nicks.set(key, `user${nicks.size + 1}`);
      }
      match = speaker.exec(text);
    }
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private redact(text: string, nicks?: Map<string, string>): string {
    if (!this.redactionEnabled) return text;
    let out = text
      // Hostmasks first: nick!user@host would otherwise be half-eaten by the
      // email rule, leaving the nick behind.
      .replace(/\b[^\s!@]+![^\s!@]+@[^\s!@]+\b/g, '[hostmask]')
      // IPv4 addresses
      .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]')
      // Email addresses
      .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[email]');

    if (nicks && nicks.size > 0) {
      // Replace every occurrence of a known speaker, not only the line
      // prefix: "<bob> hi alice" leaks alice just as surely as the prefix
      // does. Longest first, so "alice" cannot partially eat "alice_".
      const known = Array.from(nicks.keys()).sort(
        (a, b) => b.length - a.length,
      );
      for (const key of known) {
        const alias = nicks.get(key) as string;
        out = out.replace(
          new RegExp(`(?<![\\w-])${this.escapeRegExp(key)}(?![\\w-])`, 'gi'),
          alias,
        );
      }
    }
    return out;
  }

  // --- Requests ----------------------------------------------------------

  private adapterFor(kind: AIProviderKind): AIProviderAdapter {
    const adapter = this.adapters.get(kind);
    if (!adapter) {
      throw new AIError(
        'invalid_request',
        `No adapter registered for provider kind "${kind}"`,
      );
    }
    return adapter;
  }

  /**
   * Resolve provider + key, or throw a precise AIError. Split out so `chat`
   * and `testConnection` report identical reasons for identical problems.
   */
  private async prepare(providerId?: string) {
    if (!this.enabled) {
      throw new AIError('disabled', 'AI is switched off in settings');
    }
    const provider = await aiProviderStore.resolve(providerId);
    if (!provider) {
      if (providerId && (await aiProviderStore.isDisabled(providerId))) {
        throw new AIError(
          'provider_disabled',
          `AI provider "${providerId}" is disabled`,
        );
      }
      throw new AIError(
        'no_provider',
        providerId
          ? `Unknown AI provider "${providerId}"`
          : 'No AI provider configured',
      );
    }

    if (this.isThirdParty(provider.kind) && !this.consentGranted) {
      throw new AIError(
        'consent_required',
        `Sending conversation content to "${provider.name}" has not been agreed to yet. Turn it on in Settings \u203a AI \u203a Privacy.`,
      );
    }

    const apiKey = await aiProviderStore.getKey(provider.id);
    if (!apiKey && aiProviderStore.requiresKey(provider.kind)) {
      throw new AIError(
        'missing_key',
        `No API key stored for provider "${provider.name}"`,
      );
    }
    return { provider, apiKey, adapter: this.adapterFor(provider.kind) };
  }

  private withTimeout(timeoutMs: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return { signal: controller.signal, clear: () => clearTimeout(timer) };
  }

  /**
   * Single-prompt convenience wrapper. `callerId` is the script id, so limits
   * are per script rather than global — one noisy script cannot starve others.
   */
  async ask(
    prompt: string,
    options: AIRequestOptions = {},
    callerId = 'app',
  ): Promise<AIResult> {
    return this.chat([{ role: 'user', content: prompt }], options, callerId);
  }

  async chat(
    messages: AIMessage[],
    options: AIRequestOptions = {},
    callerId = 'app',
  ): Promise<AIResult> {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new AIError('invalid_request', 'At least one message is required');
    }

    const totalChars = measureRequest(messages, options.system);
    if (totalChars > MAX_PROMPT_CHARS) {
      throw new AIError(
        'prompt_too_long',
        `Prompt is ${totalChars} characters, limit is ${MAX_PROMPT_CHARS}`,
      );
    }

    if (
      options.channel &&
      !this.isChannelAllowed(options.channel, options.network)
    ) {
      throw new AIError(
        'channel_not_allowed',
        `AI is not enabled for ${options.channel}. The other people in it never agreed to this. Turn it on in ${this.channelOptInPath(options.channel)}.`,
      );
    }

    const { provider, apiKey, adapter } = await this.prepare(options.provider);

    // One map for the whole request, so the same nick keeps the same alias
    // across every message in the conversation. Collect before rewriting.
    //
    // Skipped entirely when tools are in play: an agent told to message
    // "user3" cannot act, because that is nobody's nick. Hostmask, IP and
    // e-mail stripping below still applies either way.
    const nicks = new Map<string, string>();
    const pseudonymize = this.redactionEnabled && !options.tools?.length;
    if (pseudonymize) {
      for (const message of messages) {
        this.collectNicks(String(message?.content ?? ''), nicks);
      }
      if (options.system) this.collectNicks(options.system, nicks);
    }
    const redacted: AIMessage[] = messages.map(message => ({
      role: message.role,
      content: this.redact(String(message.content ?? ''), nicks),
      // Tool calls are structured arguments, not prose: rewriting them would
      // corrupt the conversation the provider replays back to itself.
      toolCalls: message.toolCalls,
      toolResults: message.toolResults?.map(result => ({
        ...result,
        content: this.redact(String(result.content ?? ''), nicks),
      })),
    }));
    // Resolve MCP tokens here rather than in the adapter: adapters stay pure
    // transport and never touch the Keychain.
    const mcpTokens = provider.mcpServers?.length
      ? await aiProviderStore.getMcpTokens(provider.id)
      : undefined;

    const effectiveOptions: AIRequestOptions = {
      ...options,
      mcpTokens,
      system: options.system ? this.redact(options.system, nicks) : undefined,
      maxTokens: Math.min(
        options.maxTokens ?? provider.maxTokens,
        MAX_ALLOWED_TOKENS,
      ),
    };

    const state = this.reserveSlot(callerId, options.continuesTurn === true);
    const { signal, clear } = this.withTimeout(
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      const result = await adapter.chat(
        provider,
        apiKey,
        redacted,
        effectiveOptions,
        signal,
      );
      logger.info(
        'ai',
        `AI call ok (${callerId} -> ${provider.name}/${result.model})`,
      );
      return result;
    } catch (error) {
      const message = error instanceof AIError ? error.message : String(error);
      logger.warn('ai', `AI call failed (${callerId}): ${message}`);
      throw error;
    } finally {
      clear();
      this.releaseSlot(state);
    }
  }

  /**
   * Fetch the models this provider's key can use. Doubles as the Settings
   * "Test connection" probe — it validates the key without spending tokens.
   */
  async listModels(providerId?: string): Promise<string[]> {
    const { provider, apiKey, adapter } = await this.prepare(providerId);
    const { signal, clear } = this.withTimeout(DEFAULT_TIMEOUT_MS);
    try {
      return await adapter.listModels(provider, apiKey, signal);
    } finally {
      clear();
    }
  }

  /** Test hook — restores construction-time state. */
  resetForTests(): void {
    this.callers.clear();
    this.callerLimits.clear();
    this.enabled = true;
    this.enabledLoaded = false;
    this.redactionEnabled = true;
    this.consentGranted = false;
    this.allowedChannels = {};
    this.limits = {
      cooldownMs: DEFAULT_COOLDOWN_MS,
      maxCallsPerDay: DEFAULT_MAX_CALLS_PER_DAY,
      maxConcurrent: DEFAULT_MAX_CONCURRENT,
    };
  }
}

export const aiService = new AIService();
