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
const SECRET_PREFIX = 'ai:mcpclient:';
export const MCP_TOOL_PREFIX = 'mcp__';

export interface McpClientServer {
  id: string;
  name: string;
  url: string;
  hasToken: boolean;
  enabled: boolean;
  /** Trust the server's own readOnlyHint instead of confirming every call. */
  trustReadOnlyHints: boolean;
}

interface ConnectedTool {
  serverId: string;
  remoteName: string;
  tool: AITool;
}

class McpClientService {
  private servers: McpClientServer[] = [];
  private loaded = false;
  private tools = new Map<string, ConnectedTool>();

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
    } catch (error) {
      logger.error('ai', `Failed to load MCP clients: ${String(error)}`);
      this.servers = [];
    } finally {
      this.loaded = true;
    }
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
      try {
        const token = server.hasToken
          ? await secureStorageService.getSecret(this.secretKey(server.id))
          : null;
        const result = await McpClient.connect(server.id, server.url, token);
        for (const remote of result.tools) {
          const name = `${MCP_TOOL_PREFIX}${server.name}__${remote.name}`;
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
              mutates: !(server.trustReadOnlyHints && remote.readOnly),
            },
          });
        }
        logger.info('ai', `MCP ${server.name}: ${result.tools.length} tools`);
      } catch (error) {
        logger.warn('ai', `MCP ${server.name} unavailable: ${String(error)}`);
      }
    }
    return this.toolSchemas();
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
  }
}

export const mcpClientService = new McpClientService();
