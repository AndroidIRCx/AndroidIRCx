/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { connectionManager } from '../ConnectionManager';
import { messageHistoryService } from '../MessageHistoryService';
import { aiService } from './AIService';
import { AITool, AIToolCall } from './types';

/**
 * The tools the agent may use, and the code behind them.
 *
 * Every tool declares `mutates`. That is the whole safety model: a read-only
 * tool runs unattended, and anything that changes IRC state waits for the user
 * to tap approve. The flag lives on the definition so a tool cannot be added
 * without someone deciding which side it falls on.
 *
 * The channel opt-in from phase 6 is enforced here too: a tool that reads
 * other people's messages refuses a channel the user has not opted in, exactly
 * as a script would be refused.
 */

export interface ToolOutcome {
  content: string;
  isError?: boolean;
}

type Executor = (input: Record<string, unknown>) => Promise<ToolOutcome>;

interface AgentToolDefinition extends AITool {
  execute: Executor;
}

const str = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const ok = (content: string): ToolOutcome => ({ content });
const fail = (content: string): ToolOutcome => ({ content, isError: true });

function resolveNetwork(input: Record<string, unknown>): string | null {
  const named = str(input.network);
  const network = named || connectionManager.getActiveNetworkId();
  if (!network) return null;
  return connectionManager.getConnection(network) ? network : null;
}

const noArgs = { type: 'object', properties: {}, required: [] as string[] };

const DEFINITIONS: AgentToolDefinition[] = [
  {
    name: 'list_networks',
    description:
      'List the IRC networks this client knows and whether each is connected.',
    inputSchema: noArgs,
    mutates: false,
    execute: async () => {
      const connections = connectionManager.getAllConnections();
      if (!connections.length) return ok('No networks configured.');
      return ok(
        connections
          .map(
            connection =>
              `${connection.networkId}: ${
                connection.ircService.getConnectionStatus()
                  ? 'connected'
                  : 'disconnected'
              }`,
          )
          .join('\n'),
      );
    },
  },
  {
    name: 'whoami',
    description: 'The nickname currently in use on a network.',
    inputSchema: {
      type: 'object',
      properties: { network: { type: 'string' } },
      required: [],
    },
    mutates: false,
    execute: async input => {
      const network = resolveNetwork(input);
      if (!network) return fail('Not connected to that network.');
      const nick = connectionManager
        .getConnection(network)
        ?.ircService.getCurrentNick();
      return ok(nick ? `${nick} on ${network}` : 'Unknown nickname.');
    },
  },
  {
    name: 'list_channels',
    description: 'List the channels currently joined on a network.',
    inputSchema: {
      type: 'object',
      properties: { network: { type: 'string' } },
      required: [],
    },
    mutates: false,
    execute: async input => {
      const network = resolveNetwork(input);
      if (!network) return fail('Not connected to that network.');
      const channels =
        connectionManager.getConnection(network)?.ircService.getChannels() ??
        [];
      return ok(channels.length ? channels.join(', ') : 'No channels joined.');
    },
  },
  {
    name: 'list_users',
    description: 'List the nicknames present in a channel.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        network: { type: 'string' },
      },
      required: ['channel'],
    },
    mutates: false,
    execute: async input => {
      const channel = str(input.channel);
      if (!channel) return fail('A channel is required.');
      const network = resolveNetwork(input);
      if (!network) return fail('Not connected to that network.');
      const users =
        connectionManager
          .getConnection(network)
          ?.ircService.getChannelUsers(channel) ?? [];
      if (!users.length) return ok(`No users known for ${channel}.`);
      return ok(
        users
          .map((user: any) => (typeof user === 'string' ? user : user?.nick))
          .filter(Boolean)
          .join(', '),
      );
    },
  },
  {
    name: 'read_recent_messages',
    description:
      'The most recent messages of a channel. Only works for channels the user has enabled AI for.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        limit: { type: 'number' },
        network: { type: 'string' },
      },
      required: ['channel'],
    },
    mutates: false,
    execute: async input => {
      const channel = str(input.channel);
      if (!channel) return fail('A channel is required.');
      const network = resolveNetwork(input);
      if (!network) return fail('Not connected to that network.');
      // Same gate as a script: other people never agreed to this.
      if (!aiService.isChannelAllowed(channel, network)) {
        return fail(
          `The user has not enabled AI for ${channel}. Ask them to turn it on in Settings > AI.`,
        );
      }
      const limitValue = Number(input.limit);
      const limit = Math.min(
        Math.max(Number.isFinite(limitValue) ? limitValue : 50, 1),
        200,
      );
      try {
        const all = await messageHistoryService.loadMessages(network, channel);
        const recent = all.slice(-limit);
        if (!recent.length) return ok(`No stored history for ${channel}.`);
        return ok(
          recent
            .map(message => `${message.from || '?'}: ${message.text || ''}`)
            .join('\n')
            .substring(0, 6000),
        );
      } catch (error) {
        return fail(`Could not read history: ${String(error)}`);
      }
    },
  },
  {
    name: 'search_history',
    description:
      'Search stored message history. Only searches channels the user has enabled AI for.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        channel: { type: 'string' },
        limit: { type: 'number' },
        network: { type: 'string' },
      },
      required: ['text'],
    },
    mutates: false,
    execute: async input => {
      const text = str(input.text);
      if (!text) return fail('Search text is required.');
      const network = resolveNetwork(input);
      const channel = str(input.channel);
      if (
        channel &&
        !aiService.isChannelAllowed(channel, network ?? undefined)
      ) {
        return fail(`The user has not enabled AI for ${channel}.`);
      }
      const limitValue = Number(input.limit);
      const limit = Math.min(
        Math.max(Number.isFinite(limitValue) ? limitValue : 20, 1),
        100,
      );
      try {
        const results = await messageHistoryService.searchMessages({
          network: network ?? undefined,
          channel: channel || undefined,
          text,
        });
        // Without a channel filter the search spans every channel, including
        // ones with no opt-in, so drop those rather than leak them.
        const permitted = results.filter(message =>
          message.channel
            ? aiService.isChannelAllowed(
                message.channel,
                message.network ?? network ?? undefined,
              )
            : true,
        );
        if (!permitted.length) return ok('No matches in channels AI may read.');
        return ok(
          permitted
            .slice(0, limit)
            .map(
              message =>
                `[${message.channel || '?'}] ${message.from || '?'}: ${
                  message.text || ''
                }`,
            )
            .join('\n')
            .substring(0, 6000),
        );
      } catch (error) {
        return fail(`Could not search history: ${String(error)}`);
      }
    },
  },
  {
    name: 'send_message',
    description: 'Send a message to a channel or a person.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        text: { type: 'string' },
        network: { type: 'string' },
      },
      required: ['target', 'text'],
    },
    mutates: true,
    execute: async input => {
      const target = str(input.target);
      const text = str(input.text);
      if (!target || !text) return fail('A target and text are required.');
      const network = resolveNetwork(input);
      if (!network) return fail('Not connected to that network.');
      connectionManager
        .getConnection(network)
        ?.ircService.sendMessage(target, text.substring(0, 400));
      return ok(`Sent to ${target}.`);
    },
  },
  {
    name: 'send_notice',
    description: 'Send a notice to a channel or a person.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        text: { type: 'string' },
        network: { type: 'string' },
      },
      required: ['target', 'text'],
    },
    mutates: true,
    execute: async input => {
      const target = str(input.target);
      const text = str(input.text);
      if (!target || !text) return fail('A target and text are required.');
      const network = resolveNetwork(input);
      if (!network) return fail('Not connected to that network.');
      connectionManager
        .getConnection(network)
        ?.ircService.sendCommand(`NOTICE ${target} :${text.substring(0, 400)}`);
      return ok(`Notice sent to ${target}.`);
    },
  },
  {
    name: 'join_channel',
    description: 'Join a channel.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        network: { type: 'string' },
      },
      required: ['channel'],
    },
    mutates: true,
    execute: async input => {
      const channel = str(input.channel);
      if (!channel) return fail('A channel is required.');
      const network = resolveNetwork(input);
      if (!network) return fail('Not connected to that network.');
      connectionManager
        .getConnection(network)
        ?.ircService.sendCommand(`JOIN ${channel}`);
      return ok(`Joined ${channel}.`);
    },
  },
  {
    name: 'part_channel',
    description: 'Leave a channel.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        reason: { type: 'string' },
        network: { type: 'string' },
      },
      required: ['channel'],
    },
    mutates: true,
    execute: async input => {
      const channel = str(input.channel);
      if (!channel) return fail('A channel is required.');
      const network = resolveNetwork(input);
      if (!network) return fail('Not connected to that network.');
      const reason = str(input.reason);
      connectionManager
        .getConnection(network)
        ?.ircService.sendCommand(
          reason ? `PART ${channel} :${reason}` : `PART ${channel}`,
        );
      return ok(`Left ${channel}.`);
    },
  },
];

/** Tool definitions as the provider needs them, without the executors. */
export function agentToolSchemas(): AITool[] {
  return DEFINITIONS.map(({ name, description, inputSchema, mutates }) => ({
    name,
    description,
    inputSchema,
    mutates,
  }));
}

export function findTool(name: string): AgentToolDefinition | undefined {
  return DEFINITIONS.find(tool => tool.name === name);
}

/** True when this call changes IRC state and therefore needs approval. */
export function toolMutates(call: AIToolCall): boolean {
  // An unknown tool is treated as mutating: refusing to guess is the safe
  // direction when a model invents a name.
  return findTool(call.name)?.mutates ?? true;
}

export async function executeTool(call: AIToolCall): Promise<ToolOutcome> {
  const tool = findTool(call.name);
  if (!tool) return fail(`No such tool: ${call.name}`);
  try {
    return await tool.execute(call.input ?? {});
  } catch (error) {
    return fail(`Tool failed: ${String(error)}`);
  }
}

/** A short, human-readable rendering of a call, for the confirmation card. */
export function describeCall(call: AIToolCall): string {
  const entries = Object.entries(call.input ?? {})
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${String(value).substring(0, 120)}`);
  return entries.length ? `${call.name}\n${entries.join('\n')}` : call.name;
}
