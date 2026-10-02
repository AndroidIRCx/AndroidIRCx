/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { logger } from '../Logger';
import { secureStorageService } from '../SecureStorageService';
import { AITool, AIToolCall } from './types';

/**
 * Remote MCP servers the app itself connects to.
 *
 * Distinct from the `mcpServers` on an `AIProvider` (phase 10), where the
 * *provider* does the connecting and only Anthropic offers it. These
 * connections are made by the phone, so their tools work with every provider —
 * and a server running locally in Termux is reachable the same way, over
 * `127.0.0.1`.
 *
 * Tool names are namespaced `mcp__<server>__<tool>` before they reach a model,
 * because a remote server has no idea what the built-in tools are called and a
 * collision would silently reroute a call.
 */

const { McpClient } = NativeModules as {
  McpClient?: {
    connect(
      id: string,
      url: string,
      token: string | null,
    ): Promise<{
      id: string;
      tools: Array<{
        name: string;
        description: string;
        inputSchema: string;
        readOnly: boolean;
      }>;
    }>;
    callTool(
      id: string,
      name: string,
      argumentsJson: string,
    ): Promise<{ content: string; isError: boolean }>;
    disconnect(id: string): Promise<boolean>;
  };
};

const STORAGE_KEY = '@AndroidIRCX:mcpClients';
/** Ids of built-in servers already offered once, so a removed one stays gone. */
const SEEDED_KEY = '@AndroidIRCX:mcpClientsSeeded';
const SECRET_PREFIX = 'ai:mcpclient:';
export const MCP_TOOL_PREFIX = 'mcp__';

/**
 * What a provider accepts as a tool name: `^[a-zA-Z0-9_-]{1,64}$`.
 *
 * The server name is free text the user typed, so it cannot go into a tool
 * name untouched. A server called "Mem Palace" would otherwise put a space in
 * the name and the provider would reject the **whole** request — every tool in
 * it, built-ins included — with an error that says nothing about a space.
 */
const MAX_TOOL_NAME = 64;

const sanitiseNamePart = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, '_');

/**
 * Build the name a remote tool is shown to the model under.
 *
 * The tool half is kept whole wherever possible and the server half is what
 * gets shortened, because the tool name is the part the model reads to decide
 * what a tool does. Routing never depends on this name: the map stores the
 * server id and the tool's real remote name separately.
 *
 * @param taken names already used in this connect pass, so two servers whose
 * names differ only in punctuation cannot silently shadow each other.
 */
export function namespacedToolName(
  serverName: string,
  toolName: string,
  taken: Set<string> = new Set(),
): string {
  const tool = sanitiseNamePart(toolName) || 'tool';
  const server = sanitiseNamePart(serverName) || 'server';
  const room = MAX_TOOL_NAME - MCP_TOOL_PREFIX.length - 2 - tool.length;
  const head =
    room >= server.length ? server : server.substring(0, Math.max(1, room));
  const base = `${MCP_TOOL_PREFIX}${head}__${tool}`.substring(0, MAX_TOOL_NAME);

  let name = base;
  for (let n = 2; taken.has(name); n++) {
    const suffix = `_${n}`;
    name = `${base.substring(0, MAX_TOOL_NAME - suffix.length)}${suffix}`;
  }
  return name;
}

export interface McpClientServer {
  id: string;
  name: string;
  url: string;
  hasToken: boolean;
  enabled: boolean;
  /** Trust the server's own readOnlyHint instead of confirming every call. */
  trustReadOnlyHints: boolean;
  /** Shipped with the app rather than added by the user. */
  builtIn?: boolean;
  /** The server only ever reads: it is documented as read-only. */
  readOnly?: boolean;
}

/**
 * Servers that ship with the app, switched **off**.
 *
 * The project's MemPalace is a public, read-only knowledge base about
 * AndroidIRCX — architecture, conventions, the scripting API — useful to anyone
 * writing a script or working on the app with an assistant. It is offered, not
 * imposed: nothing connects until the user turns it on, and removing it keeps
 * it removed.
 */
export const BUILT_IN_MCP_SERVERS: readonly McpClientServer[] = Object.freeze([
  {
    id: 'builtin_mempalace',
    name: 'AndroidIRCX MemPalace',
    url: 'https://mempalace-mcp.dbase.in.rs/mcp',
    hasToken: false,
    enabled: false,
    trustReadOnlyHints: true,
    builtIn: true,
    readOnly: true,
  },
]);

/**
 * Tokens for the built-in servers, by id.
 *
 * Shipped in the open on purpose: the MemPalace token is a shared, read-only
 * key that lets anyone read the published AndroidIRCX knowledge and change
 * none of it. It is kept out of storage so a removed server leaves nothing
 * behind and an updated token reaches everyone with the next release.
 */
const BUILT_IN_MCP_TOKENS: Readonly<Record<string, string>> = Object.freeze({
  builtin_mempalace:
    '8RPYC7vdtatC4nAMnWwqYndQwzX8iin0AmLSQ3dWtj7x4OfHCBwaP6np5TsBBJuP',
});

/**
 * True for a server this app ships and documents as read-only.
 *
 * Looked up in the shipped list rather than read from the stored entry, so a
 * stored flag can never make a user's own server skip confirmation.
 */
const isShippedReadOnly = (id: string): boolean =>
  BUILT_IN_MCP_SERVERS.some(server => server.id === id && server.readOnly);

interface ConnectedTool {
  serverId: string;
  remoteName: string;
  tool: AITool;
}

/**
 * How the last connection attempt to a server went.
 *
 * Kept because a failure used to be a log line and nothing else: the settings
 * screen showed a server that looked configured, the assistant reported no
 * tools, and there was no way to tell the two apart.
 */
export interface McpClientStatus {
  state: 'unknown' | 'connected' | 'failed';
  /** Tools collected, when connected. */
  tools: number;
  /** Why it failed, in the server's own words, when it did. */
  error?: string;
}

class McpClientService {
  private servers: McpClientServer[] = [];
  private loaded = false;
  private tools = new Map<string, ConnectedTool>();
  private statuses = new Map<string, McpClientStatus>();

  isSupported(): boolean {
    return !!McpClient;
  }

  private secretKey(id: string): string {
    return `${SECRET_PREFIX}${id}`;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        this.servers = parsed.filter((s: any) => s && typeof s.id === 'string');
      }
      await this.seedBuiltIns();
    } catch (error) {
      logger.error('ai', `Failed to load MCP clients: ${String(error)}`);
      this.servers = [];
    } finally {
      this.loaded = true;
    }
  }

  /**
   * Offer each built-in server once. One the user removed is not brought
   * back, because the seeded list remembers it was already offered.
   */
  private async seedBuiltIns(): Promise<void> {
    const raw = await AsyncStorage.getItem(SEEDED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const seeded: string[] = Array.isArray(parsed) ? parsed : [];
    const fresh = BUILT_IN_MCP_SERVERS.filter(
      server => !seeded.includes(server.id),
    );
    if (!fresh.length) return;
    for (const server of fresh) {
      if (!this.servers.some(entry => entry.id === server.id)) {
        this.servers.push({ ...server });
      }
      seeded.push(server.id);
    }
    await AsyncStorage.setItem(SEEDED_KEY, JSON.stringify(seeded));
    await this.persist();
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.servers));
    } catch (error) {
      logger.error('ai', `Failed to save MCP clients: ${String(error)}`);
    }
  }

  async list(): Promise<McpClientServer[]> {
    await this.load();
    return this.servers.map(server => ({ ...server }));
  }

  async add(input: {
    name: string;
    url: string;
    token?: string;
    trustReadOnlyHints?: boolean;
  }): Promise<McpClientServer> {
    await this.load();
    const name = (input.name || '').trim().substring(0, 60);
    const url = (input.url || '').trim().replace(/\/+$/, '');
    if (!name) throw new Error('A name is required');
    if (!/^https?:\/\/[^\s]+$/i.test(url)) {
      throw new Error('A valid http(s) URL is required');
    }

    const server: McpClientServer = {
      id: `mcp_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .substring(2, 8)}`,
      name,
      url,
      hasToken: false,
      enabled: true,
      trustReadOnlyHints: input.trustReadOnlyHints === true,
    };
    this.servers.push(server);
    if (input.token?.trim()) {
      await secureStorageService.setSecret(
        this.secretKey(server.id),
        input.token.trim(),
      );
      server.hasToken = true;
    }
    await this.persist();
    return { ...server };
  }

  async update(
    id: string,
    changes: Partial<Pick<McpClientServer, 'enabled' | 'trustReadOnlyHints'>>,
  ): Promise<void> {
    await this.load();
    const index = this.servers.findIndex(server => server.id === id);
    if (index === -1) return;
    this.servers[index] = { ...this.servers[index], ...changes };
    await this.persist();
  }

  async remove(id: string): Promise<void> {
    await this.load();
    this.servers = this.servers.filter(server => server.id !== id);
    await secureStorageService.removeSecret(this.secretKey(id));
    this.statuses.delete(id);
    await this.disconnect(id);
    await this.persist();
  }

  /**
   * Connect every enabled server and collect its tools.
   *
   * A server that fails is skipped rather than aborting the rest: one
   * unreachable endpoint must not cost the user every other tool.
   */
  async connectAll(): Promise<AITool[]> {
    if (!McpClient) return [];
    await this.load();
    this.tools.clear();

    for (const server of this.servers) {
      if (!server.enabled) continue;
      await this.connectOne(server);
    }
    return this.toolSchemas();
  }

  /**
   * Connect one server and collect its tools, recording how it went.
   *
   * Returns rather than throws: the caller is either connecting every server,
   * where one failure must not cost the rest, or testing a single one, where
   * the status is the answer.
   */
  private async connectOne(server: McpClientServer): Promise<McpClientStatus> {
    if (!McpClient) {
      return this.setStatus(server.id, {
        state: 'failed',
        tools: 0,
        error: 'This build has no MCP support.',
      });
    }
    // Names already used by servers connected earlier in this pass, so a
    // collision gets a suffix instead of quietly replacing someone's tool.
    const taken = new Set(this.tools.keys());
    try {
      const token = server.hasToken
        ? await secureStorageService.getSecret(this.secretKey(server.id))
        : (BUILT_IN_MCP_TOKENS[server.id] ?? null);
      // The MemPalace serves only reads but marks none of them readOnlyHint,
      // so trusting its hints alone would still confirm every lookup.
      const shippedReadOnly = isShippedReadOnly(server.id);
      const result = await McpClient.connect(server.id, server.url, token);
      for (const remote of result.tools) {
        const name = namespacedToolName(server.name, remote.name, taken);
        taken.add(name);
        let inputSchema: Record<string, unknown> = { type: 'object' };
        try {
          inputSchema = JSON.parse(remote.inputSchema);
        } catch {
          // A server that cannot describe its own tool still gets to be
          // called; the model just has no schema to fill in.
        }
        this.tools.set(name, {
          serverId: server.id,
          remoteName: remote.name,
          tool: {
            name,
            description: remote.description,
            inputSchema,
            // readOnlyHint is the server's claim about itself, so it only
            // skips confirmation when the user has said they trust it.
            mutates: !(
              server.trustReadOnlyHints &&
              (remote.readOnly || shippedReadOnly)
            ),
          },
        });
      }
      logger.info('ai', `MCP ${server.name}: ${result.tools.length} tools`);
      return this.setStatus(server.id, {
        state: 'connected',
        tools: result.tools.length,
      });
    } catch (error) {
      const message = String((error as any)?.message ?? error);
      logger.warn('ai', `MCP ${server.name} unavailable: ${message}`);
      return this.setStatus(server.id, {
        state: 'failed',
        tools: 0,
        error: message,
      });
    }
  }

  private setStatus(id: string, status: McpClientStatus): McpClientStatus {
    this.statuses.set(id, status);
    return status;
  }

  /** How the last attempt at this server went, for the settings screen. */
  status(id: string): McpClientStatus {
    return this.statuses.get(id) ?? { state: 'unknown', tools: 0 };
  }

  /**
   * Connect one server on demand, so the user can find out why it does not
   * work without opening the assistant and reading a log.
   */
  async test(id: string): Promise<McpClientStatus> {
    await this.load();
    const server = this.servers.find(entry => entry.id === id);
    if (!server) return { state: 'unknown', tools: 0 };
    // Drop whatever this server contributed before, or a server that has just
    // stopped offering a tool would keep it until the next full connect.
    for (const [name, entry] of this.tools) {
      if (entry.serverId === id) this.tools.delete(name);
    }
    return this.connectOne(server);
  }

  /** Tools collected by the last connectAll(), as the providers want them. */
  toolSchemas(): AITool[] {
    return Array.from(this.tools.values()).map(entry => entry.tool);
  }

  /** True when this call belongs to a remote server rather than a built-in. */
  owns(name: string): boolean {
    return this.tools.has(name);
  }

  async execute(
    call: AIToolCall,
  ): Promise<{ content: string; isError?: boolean }> {
    const entry = this.tools.get(call.name);
    if (!entry || !McpClient) {
      return { content: `No such MCP tool: ${call.name}`, isError: true };
    }
    try {
      const result = await McpClient.callTool(
        entry.serverId,
        entry.remoteName,
        JSON.stringify(call.input ?? {}),
      );
      return { content: result.content, isError: result.isError };
    } catch (error) {
      return { content: String(error), isError: true };
    }
  }

  async disconnect(id: string): Promise<void> {
    if (!McpClient) return;
    try {
      await McpClient.disconnect(id);
    } catch {
      // Disconnecting something already gone is not worth reporting.
    }
    for (const [name, entry] of this.tools) {
      if (entry.serverId === id) this.tools.delete(name);
    }
  }

  async disconnectAll(): Promise<void> {
    await this.load();
    for (const server of this.servers) await this.disconnect(server.id);
    this.tools.clear();
  }

  /** Test hook. */
  resetForTests(): void {
    this.servers = [];
    this.loaded = false;
    this.tools.clear();
    this.statuses.clear();
  }
}

export const mcpClientService = new McpClientService();
