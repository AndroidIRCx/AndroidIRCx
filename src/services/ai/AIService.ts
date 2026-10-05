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
import { knownContextWindow } from './contextWindows';
import { isPrivateHost, parseHttpUrl } from '../../utils/safeUrl';
import {
  AIError,
  AIMessage,
  AIProvider,
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
const STORAGE_PROMPT_LIMIT_KEY = '@AndroidIRCX:aiPromptLimitTokens';
const STORAGE_WINDOWS_KEY = '@AndroidIRCX:aiContextWindows';

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
/**
 * The request sizes the user can pick from in Settings › AI, in **tokens**,
 * because that is the unit every provider states its context window in. A
 * DeepSeek or Gemini model that takes a million tokens is "1M" here, not a
 * character count the user has to convert. The top step is past what any
 * current model takes, so the picker is never what stops a request.
 */
export const PROMPT_LIMIT_OPTIONS = [
  32000, 64000, 128000, 200000, 400000, 1000000, 2000000,
];
/**
 * "Size it from the model": the default. The limit follows the context window
 * the provider reports for the configured model, or a known one, and only
 * falls back to MAX_PROMPT_CHARS when neither is available.
 */
export const PROMPT_LIMIT_AUTO = 0;
/**
 * Characters per token when turning a window into a character limit. Prose
 * runs nearer four; JSON tool output and non-English text run lower, so this
 * errs towards sending less than the model could take, never more.
 */
export const CHARS_PER_TOKEN = 3;
/** Tokens to the character limit the request is actually measured against. */
export const tokensToChars = (tokens: number): number =>
  Math.round(tokens * CHARS_PER_TOKEN);
/** How long a context-window lookup may hold up a request. */
const WINDOW_LOOKUP_TIMEOUT_MS = 8000;

/** What "Auto" resolved to, for the settings screen. */
export interface AutoPromptLimit {
  model: string;
  /** The window in tokens; null when nothing reported or matched one. */
  tokens: number | null;
  source: 'provider' | 'known' | 'default';
  chars: number;
}
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
  /** The user's pick in tokens, or PROMPT_LIMIT_AUTO. */
  private promptLimit = PROMPT_LIMIT_AUTO;
  /**
   * Context windows the providers reported, by kind|baseUrl|model. A null
   * entry means "asked, got nothing" and lives only in memory, so a provider
   * that was briefly unreachable is asked again next launch.
   */
  private windows = new Map<string, number | null>();

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
      const [raw, consent, channels, redaction, promptLimit, windows] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_ENABLED_KEY),
          AsyncStorage.getItem(STORAGE_CONSENT_KEY),
          AsyncStorage.getItem(STORAGE_CHANNELS_KEY),
          AsyncStorage.getItem(STORAGE_REDACTION_KEY),
          AsyncStorage.getItem(STORAGE_PROMPT_LIMIT_KEY),
          AsyncStorage.getItem(STORAGE_WINDOWS_KEY),
        ]);
      const limit = Number(promptLimit);
      if (promptLimit !== null && this.isPromptLimitOption(limit)) {
        this.promptLimit = limit;
      }
      if (windows) {
        const parsed = JSON.parse(windows);
        if (parsed && typeof parsed === 'object') {
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'number' && value > 0) {
              this.windows.set(key, value);
            }
          }
        }
      }
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

  /**
   * True when this provider sends content off the device to a third party.
   *
   * "Local" is a claim about where the server is, and the kind alone used to
   * be taken at its word: a provider marked local but pointed at a cloud host
   * skipped the consent question entirely. It counts as local only when its
   * address really is on this machine or the user's own network.
   */
  private isThirdParty(provider: AIProvider): boolean {
    if (provider.kind !== 'local') return true;
    const host = parseHttpUrl(provider.baseUrl)?.hostname;
    return !host || !isPrivateHost(host);
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

  /** The user's choice: a size in tokens, or PROMPT_LIMIT_AUTO. */
  getPromptLimit(): number {
    return this.promptLimit;
  }

  private isPromptLimitOption(limit: number): boolean {
    return limit === PROMPT_LIMIT_AUTO || PROMPT_LIMIT_OPTIONS.includes(limit);
  }

  /** Ignores anything but PROMPT_LIMIT_AUTO and PROMPT_LIMIT_OPTIONS. */
  setPromptLimit(limit: number): void {
    if (!this.isPromptLimitOption(limit)) return;
    this.promptLimit = limit;
    AsyncStorage.setItem(STORAGE_PROMPT_LIMIT_KEY, String(limit)).catch(error =>
      logger.warn('ai', `Failed to save AI prompt limit: ${String(error)}`),
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
    await this.loadSettings();
    if (!this.enabled) return false;
    const provider = await aiProviderStore.resolve();
    if (!provider) return false;
    if (this.isThirdParty(provider) && !this.consentGranted) return false;
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
    await this.loadSettings();
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
    if (this.isThirdParty(provider) && !this.consentGranted) {
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
    // Security pass 2026-10-05: nothing loaded the settings at startup, so
    // after a restart "Enable AI: off" read as on — scripts with a local
    // provider kept calling it until someone opened the settings screen.
    // Every way into a request reads them first; after the first time this
    // is a no-op.
    await this.loadSettings();
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

    if (this.isThirdParty(provider) && !this.consentGranted) {
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

    // After prepare, because on Auto the limit depends on the model. Still
    // before a slot is booked, so a refused prompt costs the caller nothing.
    const totalChars = measureRequest(messages, options.system);
    // Auto sizes the assistant's requests from the model. A script keeps the
    // fixed backstop unless the user picked a size by hand: a runaway script
    // on a 1M-token model must not send three million characters a call,
    // a hundred times a day (security pass 2026-10-05).
    const modelLimit = await this.limitFor(provider, apiKey, adapter);
    const limit =
      callerId.startsWith('script:') && this.promptLimit === PROMPT_LIMIT_AUTO
        ? Math.min(modelLimit, MAX_PROMPT_CHARS)
        : modelLimit;
    if (totalChars > limit) {
      throw new AIError(
        'prompt_too_long',
        `Request is about ${Math.ceil(totalChars / CHARS_PER_TOKEN)} tokens (${totalChars} characters); the limit is about ${Math.floor(limit / CHARS_PER_TOKEN)} tokens. Raise it in Settings \u203a AI \u203a Largest request, or compact the conversation.`,
      );
    }

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

  private windowKey(provider: AIProvider): string {
    return `${provider.kind}|${provider.baseUrl ?? ''}|${provider.model}`;
  }

  /**
   * The model's context window: what the provider reports, else a known one.
   * Asked once per model and remembered, so it costs one request per model
   * ever, not one per message.
   */
  private async windowFor(
    provider: AIProvider,
    apiKey: string | null,
    adapter: AIProviderAdapter,
  ): Promise<{ tokens: number | null; source: AutoPromptLimit['source'] }> {
    const key = this.windowKey(provider);
    if (!this.windows.has(key) && adapter.contextWindow) {
      const { signal, clear } = this.withTimeout(WINDOW_LOOKUP_TIMEOUT_MS);
      let tokens: number | null = null;
      try {
        tokens = await adapter.contextWindow(provider, apiKey, signal);
      } catch (error) {
        logger.warn(
          'ai',
          `Could not read the context window of ${provider.model}: ${String(error)}`,
        );
      } finally {
        clear();
      }
      this.windows.set(key, tokens);
      if (tokens) this.saveWindows();
    }
    const reported = this.windows.get(key);
    if (reported) return { tokens: reported, source: 'provider' };
    const known = knownContextWindow(provider.model);
    if (known) return { tokens: known, source: 'known' };
    return { tokens: null, source: 'default' };
  }

  private saveWindows(): void {
    const known: Record<string, number> = {};
    for (const [key, value] of this.windows) if (value) known[key] = value;
    AsyncStorage.setItem(STORAGE_WINDOWS_KEY, JSON.stringify(known)).catch(
      error =>
        logger.warn(
          'ai',
          `Failed to save AI context windows: ${String(error)}`,
        ),
    );
  }

  /**
   * What Auto works out to: the window less the reply's share, in characters,
   * kept between the smallest and largest sizes the picker offers. The reply
   * is subtracted here and not for a size picked by hand: a picked size is
   * already "how big a request may be", not the model's whole window.
   */
  private async resolveAutoLimit(
    provider: AIProvider,
    apiKey: string | null,
    adapter: AIProviderAdapter,
  ): Promise<AutoPromptLimit> {
    const { tokens, source } = await this.windowFor(provider, apiKey, adapter);
    if (!tokens) {
      return { model: provider.model, tokens, source, chars: MAX_PROMPT_CHARS };
    }
    const room = Math.max(0, tokens - (provider.maxTokens || 0));
    const chars = tokensToChars(
      Math.min(
        Math.max(room, PROMPT_LIMIT_OPTIONS[0]),
        PROMPT_LIMIT_OPTIONS[PROMPT_LIMIT_OPTIONS.length - 1],
      ),
    );
    return { model: provider.model, tokens, source, chars };
  }

  /** The limit for a request to this provider; a size the user picked wins. */
  private async limitFor(
    provider: AIProvider,
    apiKey: string | null,
    adapter: AIProviderAdapter,
  ): Promise<number> {
    if (this.promptLimit !== PROMPT_LIMIT_AUTO) {
      return tokensToChars(this.promptLimit);
    }
    return (await this.resolveAutoLimit(provider, apiKey, adapter)).chars;
  }

  /**
   * The character limit a request to this provider is held to right now, for
   * callers that trim to fit before sending. Falls back to MAX_PROMPT_CHARS
   * when the provider cannot be resolved; the request itself then fails with
   * the real reason.
   */
  async getEffectivePromptLimit(providerId?: string): Promise<number> {
    if (this.promptLimit !== PROMPT_LIMIT_AUTO) {
      return tokensToChars(this.promptLimit);
    }
    try {
      const { provider, apiKey, adapter } = await this.prepare(providerId);
      return await this.limitFor(provider, apiKey, adapter);
    } catch {
      return MAX_PROMPT_CHARS;
    }
  }

  /** What Auto works out to for a provider, for display. Null if unusable. */
  async describeAutoLimit(
    providerId?: string,
  ): Promise<AutoPromptLimit | null> {
    try {
      const { provider, apiKey, adapter } = await this.prepare(providerId);
      return await this.resolveAutoLimit(provider, apiKey, adapter);
    } catch {
      return null;
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
    // Not AUTO: a fixed limit keeps the suites from seeing an extra model
    // lookup on every first request. Tests of Auto opt in explicitly.
    this.promptLimit = MAX_PROMPT_CHARS / CHARS_PER_TOKEN;
    this.windows.clear();
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
