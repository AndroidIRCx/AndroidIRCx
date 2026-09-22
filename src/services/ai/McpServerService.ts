/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
      bindLan: boolean;
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

export interface McpServerStatus {
  running: boolean;
  port: number;
  token: string;
  bindLan: boolean;
}

export interface McpServerConfig {
  port?: number;
  bindLan?: boolean;
  allowWrites?: boolean;
}

export const DEFAULT_MCP_PORT = 8765;

const STOPPED: McpServerStatus = {
  running: false,
  port: DEFAULT_MCP_PORT,
  token: '',
  bindLan: false,
};

class McpServerService {
  private subscription: { remove: () => void } | null = null;

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
        port: config.port ?? DEFAULT_MCP_PORT,
        bindLan: config.bindLan === true,
        allowWrites: config.allowWrites === true,
        tools,
      });
      logger.info(
        'ai',
        `MCP server started on port ${status.port}${
          status.bindLan ? ' (LAN)' : ' (loopback)'
        }`,
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

  /** The URL a client connects to, with the token it must present. */
  describeEndpoint(status: McpServerStatus): string {
    const host = status.bindLan ? '<phone-ip>' : '127.0.0.1';
    return `http://${host}:${status.port}/mcp`;
  }
}

export const mcpServerService = new McpServerService();
