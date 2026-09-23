/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { logger } from '../Logger';
import { agentToolSchemas, executeTool } from './AgentTools';
import { AIToolCall } from './types';

/**
 * The JavaScript half of the MCP server.
 *
 * Kotlin owns the protocol and the HTTP transport; this side owns the tools,
 * because that is where the IRC state lives. Native emits `McpToolCall` for
 * every call a remote client makes, this module runs the same executors the
 * in-app agent uses, and hands the answer back through `resolveToolCall`.
 *
 * Two deliberate differences from the in-app agent, both because nobody is
 * watching a remote caller the way the user watches their own screen:
 * write tools are **off unless explicitly enabled**, and the server binds to
 * **loopback unless the user asks for the LAN**.
 */

const { McpServer } = NativeModules as {
  McpServer?: {
    start(config: {
      port: number;
      bindMode: McpBindMode;
      allowWrites: boolean;
      tools: Array<{
        name: string;
        description: string;
        inputSchema: string;
        mutates: boolean;
      }>;
    }): Promise<McpServerStatus>;
    stop(): Promise<McpServerStatus>;
    getStatus(): Promise<McpServerStatus>;
    resolveToolCall(id: string, content: string, isError: boolean): void;
  };
};

/**
 * Which interfaces the server listens on.
 *
 * - `loopback` — only this phone. Reachable from Termux, and nothing else.
 * - `lan` — this phone's address on the network it is attached to. One
 *   interface, so mobile data, USB tethering and a VPN are left out.
 * - `any` — every interface, `0.0.0.0`. Needed when the address changes or
 *   the connection arrives over something other than Wi-Fi, and the only
 *   option that can expose the session on a network the user did not expect.
 */
export type McpBindMode = 'loopback' | 'lan' | 'any';

export interface McpServerStatus {
  running: boolean;
  port: number;
  token: string;
  bindMode: McpBindMode;
  /** The address a client should be pointed at; '' when there is no network. */
  host: string;
}

export interface McpServerConfig {
  port?: number;
  bindMode?: McpBindMode;
  allowWrites?: boolean;
}

export const DEFAULT_MCP_PORT = 8765;

const STORAGE_CONFIG_KEY = '@AndroidIRCX:mcpServerConfig';

const DEFAULT_CONFIG: Required<McpServerConfig> = {
  port: DEFAULT_MCP_PORT,
  bindMode: 'loopback',
  allowWrites: false,
};

const STOPPED: McpServerStatus = {
  running: false,
  port: DEFAULT_MCP_PORT,
  token: '',
  bindMode: 'loopback',
  host: '127.0.0.1',
};

class McpServerService {
  private subscription: { remove: () => void } | null = null;
  private config: Required<McpServerConfig> = { ...DEFAULT_CONFIG };
  private configLoaded = false;

  /**
   * The saved settings. Both of these are choices about exposure, so losing
   * them on a screen close meant the user had to re-make a security decision
   * every time — and had no way to see what it currently was.
   */
  async loadConfig(): Promise<Required<McpServerConfig>> {
    if (this.configLoaded) return { ...this.config };
    try {
      const raw = await AsyncStorage.getItem(STORAGE_CONFIG_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          this.config = {
            port:
              typeof saved.port === 'number' ? saved.port : DEFAULT_MCP_PORT,
            bindMode: this.normalizeBindMode(saved.bindMode),
            allowWrites: saved.allowWrites === true,
          };
        }
      }
    } catch (error) {
      logger.warn('ai', `Failed to load MCP server config: ${String(error)}`);
    } finally {
      this.configLoaded = true;
    }
    return { ...this.config };
  }

  /**
   * Anything unrecognised falls back to loopback rather than throwing: a
   * corrupted value must not end up exposing the session, and must not stop
   * the screen from loading either.
   */
  private normalizeBindMode(value: unknown): McpBindMode {
    return value === 'lan' || value === 'any' ? value : 'loopback';
  }

  async saveConfig(patch: Partial<McpServerConfig>): Promise<void> {
    await this.loadConfig();
    this.config = {
      ...this.config,
      ...patch,
      bindMode: patch.bindMode
        ? this.normalizeBindMode(patch.bindMode)
        : this.config.bindMode,
    };
    try {
      await AsyncStorage.setItem(
        STORAGE_CONFIG_KEY,
        JSON.stringify(this.config),
      );
    } catch (error) {
      logger.warn('ai', `Failed to save MCP server config: ${String(error)}`);
    }
  }

  /** False on a build without the native module (or on iOS). */
  isSupported(): boolean {
    return !!McpServer;
  }

  private ensureListening(): void {
    if (this.subscription || !McpServer) return;
    const emitter = new NativeEventEmitter(NativeModules.McpServer);
    this.subscription = emitter.addListener(
      'McpToolCall',
      // NativeEventEmitter types its listener as (...args: readonly Object[]),
      // so the payload is narrowed here rather than in the signature.
      async (raw: unknown) => {
        const event = raw as { id: string; name: string; input: string };
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(event.input || '{}');
        } catch {
          // A malformed argument blob is the caller's problem, not a crash.
          input = {};
        }
        const call: AIToolCall = { id: event.id, name: event.name, input };
        try {
          const outcome = await executeTool(call);
          McpServer?.resolveToolCall(
            event.id,
            outcome.content,
            !!outcome.isError,
          );
        } catch (error) {
          // Native is waiting on this id; failing to answer would hold the
          // remote request open until its own timeout.
          McpServer?.resolveToolCall(event.id, String(error), true);
        }
      },
    );
  }

  private stopListening(): void {
    this.subscription?.remove();
    this.subscription = null;
  }

  async start(config: McpServerConfig = {}): Promise<McpServerStatus> {
    if (!McpServer) {
      throw new Error('The MCP server is not available in this build');
    }
    const saved = await this.loadConfig();
    const effective = { ...saved, ...config };
    // Persist before starting: what runs and what the screen shows next time
    // are then the same thing even if the start itself fails.
    await this.saveConfig(effective);

    this.ensureListening();
    const tools = agentToolSchemas().map(tool => ({
      name: tool.name,
      description: tool.description,
      // Native reads this as a JSON string and splits it into properties
      // and required, which is the shape the SDK's ToolSchema wants.
      inputSchema: JSON.stringify(tool.inputSchema),
      mutates: tool.mutates,
    }));

    try {
      const status = await McpServer.start({
        port: effective.port,
        bindMode: effective.bindMode,
        allowWrites: effective.allowWrites,
        tools,
      });
      logger.info(
        'ai',
        `MCP server started on port ${status.port} (${status.bindMode})`,
      );
      return status;
    } catch (error) {
      this.stopListening();
      throw error;
    }
  }

  async stop(): Promise<McpServerStatus> {
    if (!McpServer) return STOPPED;
    const status = await McpServer.stop();
    this.stopListening();
    logger.info('ai', 'MCP server stopped');
    return status;
  }

  async getStatus(): Promise<McpServerStatus> {
    if (!McpServer) return STOPPED;
    return McpServer.getStatus();
  }

  /**
   * The URL a client connects to. Filled in with the phone's real address
   * rather than a placeholder — the point of this string is that it can be
   * pasted into an MCP client without anyone having to go and find their IP.
   */
  describeEndpoint(status: McpServerStatus): string {
    const host = status.host || '<this phone’s IP>';
    return `http://${host}:${status.port}/mcp`;
  }

  /** What each bind mode means, for the settings screen. */
  describeBindMode(mode: McpBindMode): string {
    switch (mode) {
      case 'lan':
        return 'Reachable from your network, on this phone’s current address only.';
      case 'any':
        return 'Reachable on every connection this phone has, including mobile data and tethering.';
      default:
        return 'Reachable only from this phone, for example from Termux.';
    }
  }
}

export const mcpServerService = new McpServerService();
