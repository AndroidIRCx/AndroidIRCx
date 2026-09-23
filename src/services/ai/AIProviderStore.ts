/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorageService } from '../SecureStorageService';
import { logger } from '../Logger';
import {
  AIMcpServer,
  AIProvider,
  AIProviderInfo,
  AIProviderKind,
} from './types';

const STORAGE_KEY = '@AndroidIRCX:aiProviders';
const STORAGE_DEFAULT_KEY = '@AndroidIRCX:aiDefaultProvider';
/** Keychain key prefixes. Kept here so DataBackupService can exclude them. */
export const AI_SECRET_PREFIX = 'ai:key:';
export const AI_MCP_SECRET_PREFIX = 'ai:mcp:';
/** Tokens for MCP servers the app connects to itself (McpClientService). */
export const AI_MCP_CLIENT_SECRET_PREFIX = 'ai:mcpclient:';
export const AI_SECRET_PREFIXES = [
  AI_SECRET_PREFIX,
  AI_MCP_SECRET_PREFIX,
  AI_MCP_CLIENT_SECRET_PREFIX,
];

export const DEFAULT_MAX_TOKENS = 1024;
/** Cap on stored maxTokens — a runaway value is the user's own money. */
export const MAX_ALLOWED_TOKENS = 8192;

/** Kinds that talk to a user-supplied endpoint rather than a fixed vendor URL. */
const BASE_URL_KINDS: AIProviderKind[] = ['openai-compatible', 'local'];

/** Kinds that always require an API key. `local` usually needs none. */
const KEY_REQUIRED_KINDS: AIProviderKind[] = [
  'anthropic',
  'openai-compatible',
  'gemini',
];

export interface AIProviderInput {
  name: string;
  kind: AIProviderKind;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  enabled?: boolean;
}

/**
 * Persists AI provider configuration.
 *
 * Split of responsibilities, and the reason this is its own service: provider
 * metadata goes to AsyncStorage, API keys go to the Keychain via
 * SecureStorageService, and the two never mix. An `AIProvider` handed to any
 * other module is safe to log or serialize.
 */
class AIProviderStore {
  private providers: AIProvider[] = [];
  private defaultProviderId: string | null = null;
  private loaded = false;

  private generateId(): string {
    return `ai_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;
  }

  /** http/https only, trailing slash stripped. Returns null when unusable. */
  private normalizeBaseUrl(raw?: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) return null;
    return trimmed.replace(/\/+$/, '');
  }

  private clampMaxTokens(value?: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return DEFAULT_MAX_TOKENS;
    }
    return Math.min(Math.floor(value), MAX_ALLOWED_TOKENS);
  }

  private secretKey(id: string): string {
    return `${AI_SECRET_PREFIX}${id}`;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const [rawProviders, rawDefault] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(STORAGE_DEFAULT_KEY),
      ]);
      if (rawProviders) {
        const parsed = JSON.parse(rawProviders);
        if (Array.isArray(parsed)) {
          this.providers = parsed.filter(
            (p: any) => p && typeof p.id === 'string',
          );
        }
      }
      this.defaultProviderId = rawDefault || null;
    } catch (error) {
      logger.error('ai', `Failed to load AI providers: ${String(error)}`);
      this.providers = [];
      this.defaultProviderId = null;
    } finally {
      this.loaded = true;
    }
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.providers));
      if (this.defaultProviderId) {
        await AsyncStorage.setItem(STORAGE_DEFAULT_KEY, this.defaultProviderId);
      } else {
        await AsyncStorage.removeItem(STORAGE_DEFAULT_KEY);
      }
    } catch (error) {
      logger.error('ai', `Failed to save AI providers: ${String(error)}`);
    }
  }

  async list(): Promise<AIProvider[]> {
    await this.load();
    return this.providers.map(p => ({ ...p }));
  }

  /** The redacted list handed to scripts: enabled providers, no internals. */
  async listForScripts(): Promise<AIProviderInfo[]> {
    await this.load();
    return this.providers
      .filter(p => p.enabled)
      .map(p => ({ id: p.id, name: p.name, model: p.model }));
  }

  async get(id: string): Promise<AIProvider | null> {
    await this.load();
    const found = this.providers.find(p => p.id === id);
    return found ? { ...found } : null;
  }

  /**
   * Resolve which provider to use: the explicit id, else the configured
   * default, else the first enabled provider. Disabled providers are never
   * returned, even when named explicitly — the caller gets null and can
   * report `provider_disabled`.
   */
  async resolve(id?: string): Promise<AIProvider | null> {
    await this.load();
    if (id) {
      const named = this.providers.find(p => p.id === id);
      return named && named.enabled ? { ...named } : null;
    }
    if (this.defaultProviderId) {
      const preferred = this.providers.find(
        p => p.id === this.defaultProviderId && p.enabled,
      );
      if (preferred) return { ...preferred };
    }
    const firstEnabled = this.providers.find(p => p.enabled);
    return firstEnabled ? { ...firstEnabled } : null;
  }

  /** True when the id exists but is switched off (for error reporting). */
  async isDisabled(id: string): Promise<boolean> {
    await this.load();
    const found = this.providers.find(p => p.id === id);
    return Boolean(found && !found.enabled);
  }

  async add(input: AIProviderInput, apiKey?: string): Promise<AIProvider> {
    await this.load();

    const name = (input.name || '').trim();
    const model = (input.model || '').trim();
    if (!name) throw new Error('Provider name is required');
    if (!model) throw new Error('Model is required');

    let baseUrl: string | undefined;
    if (BASE_URL_KINDS.includes(input.kind)) {
      const normalized = this.normalizeBaseUrl(input.baseUrl);
      if (!normalized) {
        throw new Error('A valid http(s) base URL is required for this kind');
      }
      baseUrl = normalized;
    }

    const provider: AIProvider = {
      id: this.generateId(),
      name: name.substring(0, 60),
      kind: input.kind,
      baseUrl,
      model: model.substring(0, 120),
      hasKey: false,
      maxTokens: this.clampMaxTokens(input.maxTokens),
      enabled: input.enabled !== false,
    };

    this.providers.push(provider);

    if (apiKey) {
      await this.setKey(provider.id, apiKey);
    }
    if (!this.defaultProviderId) {
      this.defaultProviderId = provider.id;
    }
    await this.persist();
    return { ...this.providers[this.providers.length - 1] };
  }

  async update(
    id: string,
    changes: Partial<AIProviderInput>,
  ): Promise<AIProvider | null> {
    await this.load();
    const index = this.providers.findIndex(p => p.id === id);
    if (index === -1) return null;

    const current = this.providers[index];
    const kind = changes.kind ?? current.kind;

    let baseUrl = current.baseUrl;
    if (changes.baseUrl !== undefined || changes.kind !== undefined) {
      if (BASE_URL_KINDS.includes(kind)) {
        const normalized = this.normalizeBaseUrl(
          changes.baseUrl ?? current.baseUrl,
        );
        if (!normalized) {
          throw new Error('A valid http(s) base URL is required for this kind');
        }
        baseUrl = normalized;
      } else {
        baseUrl = undefined;
      }
    }

    const next: AIProvider = {
      ...current,
      kind,
      baseUrl,
      name: changes.name ? changes.name.trim().substring(0, 60) : current.name,
      model: changes.model
        ? changes.model.trim().substring(0, 120)
        : current.model,
      maxTokens:
        changes.maxTokens !== undefined
          ? this.clampMaxTokens(changes.maxTokens)
          : current.maxTokens,
      enabled:
        changes.enabled !== undefined ? changes.enabled : current.enabled,
    };

    this.providers[index] = next;
    await this.persist();
    return { ...next };
  }

  /**
   * Remove a provider and its stored key. The key deletion is what makes this
   * more than an array splice — an orphaned Keychain entry would outlive the
   * provider and still be in backups' way.
   */
  async remove(id: string): Promise<boolean> {
    await this.load();
    const index = this.providers.findIndex(p => p.id === id);
    if (index === -1) return false;

    const removed = this.providers[index];
    this.providers.splice(index, 1);
    await secureStorageService.removeSecret(this.secretKey(id));
    for (const server of removed.mcpServers ?? []) {
      await secureStorageService.removeSecret(
        this.mcpSecretKey(id, server.name),
      );
    }

    if (this.defaultProviderId === id) {
      this.defaultProviderId = this.providers[0]?.id ?? null;
    }
    await this.persist();
    return true;
  }

  async setDefault(id: string): Promise<boolean> {
    await this.load();
    if (!this.providers.some(p => p.id === id)) return false;
    this.defaultProviderId = id;
    await this.persist();
    return true;
  }

  async getDefaultId(): Promise<string | null> {
    await this.load();
    return this.defaultProviderId;
  }

  /** Store (or clear, when empty) the API key for a provider. */
  async setKey(id: string, apiKey: string | null): Promise<void> {
    await this.load();
    const index = this.providers.findIndex(p => p.id === id);
    if (index === -1) return;

    const trimmed = (apiKey || '').trim();
    await secureStorageService.setSecret(this.secretKey(id), trimmed || null);
    this.providers[index] = { ...this.providers[index], hasKey: !!trimmed };
    await this.persist();
  }

  async getKey(id: string): Promise<string | null> {
    return secureStorageService.getSecret(this.secretKey(id));
  }

  // --- MCP servers --------------------------------------------------------

  private mcpSecretKey(providerId: string, serverName: string): string {
    return `${AI_MCP_SECRET_PREFIX}${providerId}:${serverName}`;
  }

  /**
   * Replace a provider's MCP server list. Tokens for servers that are no
   * longer listed are deleted, so removing a server does not leave its
   * credential behind in the Keychain.
   */
  async setMcpServers(
    id: string,
    servers: Array<{ name: string; url: string; tools: string[] }>,
  ): Promise<AIProvider | null> {
    await this.load();
    const index = this.providers.findIndex(p => p.id === id);
    if (index === -1) return null;

    const previous = this.providers[index].mcpServers ?? [];
    const cleaned: AIMcpServer[] = [];
    for (const server of servers) {
      const name = (server.name || '').trim().substring(0, 60);
      const url = this.normalizeBaseUrl(server.url);
      const tools = (server.tools || [])
        .map(tool => String(tool).trim())
        .filter(Boolean);
      // The provider refuses a server with no tools listed, so refuse it here
      // rather than shipping a request that is guaranteed to fail.
      if (!name || !url || tools.length === 0) continue;
      cleaned.push({
        name,
        url,
        tools,
        hasToken: previous.find(p => p.name === name)?.hasToken ?? false,
      });
    }

    for (const gone of previous) {
      if (!cleaned.some(server => server.name === gone.name)) {
        await secureStorageService.removeSecret(
          this.mcpSecretKey(id, gone.name),
        );
      }
    }

    this.providers[index] = { ...this.providers[index], mcpServers: cleaned };
    await this.persist();
    return { ...this.providers[index] };
  }

  async setMcpToken(
    id: string,
    serverName: string,
    token: string | null,
  ): Promise<void> {
    await this.load();
    const index = this.providers.findIndex(p => p.id === id);
    if (index === -1) return;
    const trimmed = (token || '').trim();
    await secureStorageService.setSecret(
      this.mcpSecretKey(id, serverName),
      trimmed || null,
    );
    const servers = (this.providers[index].mcpServers ?? []).map(server =>
      server.name === serverName ? { ...server, hasToken: !!trimmed } : server,
    );
    this.providers[index] = { ...this.providers[index], mcpServers: servers };
    await this.persist();
  }

  /** Tokens for every MCP server of a provider, keyed by server name. */
  async getMcpTokens(id: string): Promise<Record<string, string>> {
    const provider = await this.get(id);
    const tokens: Record<string, string> = {};
    for (const server of provider?.mcpServers ?? []) {
      if (!server.hasToken) continue;
      const token = await secureStorageService.getSecret(
        this.mcpSecretKey(id, server.name),
      );
      if (token) tokens[server.name] = token;
    }
    return tokens;
  }

  /** True when this kind cannot work without a key. */
  requiresKey(kind: AIProviderKind): boolean {
    return KEY_REQUIRED_KINDS.includes(kind);
  }

  /** Test hook — resets in-memory state so tests start clean. */
  resetForTests(): void {
    this.providers = [];
    this.defaultProviderId = null;
    this.loaded = false;
  }
}

export const aiProviderStore = new AIProviderStore();
