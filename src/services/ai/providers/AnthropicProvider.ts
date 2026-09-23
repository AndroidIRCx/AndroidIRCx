/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  AIError,
  AIMessage,
  AIProvider,
  AIProviderAdapter,
  AIProviderKind,
  AIRequestOptions,
  AIResult,
  AIToolCall,
} from '../types';
import { getJson, postJson } from './httpJson';
import { sortModelIds } from './modelSort';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const MODEL_PAGE_SIZE = 1000;
/** A stop, so a provider that always says there is more cannot loop forever. */
const MAX_MODEL_PAGES = 10;
/** Pinned per Anthropic's versioning scheme; the header is required. */
const API_VERSION = '2023-06-01';
/** Opt-in for provider-side MCP; sent only when MCP servers are configured. */
const MCP_BETA = 'mcp-client-2025-11-20';

interface MessagesResponse {
  content?: Array<{
    type?: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface ModelsResponse {
  data?: Array<{ id?: string }>;
  /** This endpoint pages; both fields drive the next request. */
  has_more?: boolean;
  last_id?: string;
}

/**
 * Adapter for the Anthropic Messages API.
 *
 * Note for anyone extending this: the key must be a developer API key from
 * console.anthropic.com. A Claude Pro/Max subscription cannot be used by a
 * third-party app — Anthropic blocked that on 2026-04-04 — and wiring one in
 * would get the user's account banned, not ours.
 */
class AnthropicProvider implements AIProviderAdapter {
  readonly kind: AIProviderKind = 'anthropic';

  private headers(
    apiKey: string | null,
    betas: string[] = [],
  ): Record<string, string> {
    if (!apiKey) {
      throw new AIError('missing_key', 'Anthropic requires an API key');
    }
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
    };
    if (betas.length) headers['anthropic-beta'] = betas.join(',');
    return headers;
    // No `anthropic-dangerous-direct-browser-access`: that header exists for
    // browser CORS, and React Native is not a browser.
  }

  /**
   * This API keeps a turn whole: tool calls are `tool_use` blocks inside the
   * assistant's own content, and results are `tool_result` blocks inside the
   * next user turn. That is the opposite of the OpenAI shape, where each
   * piece becomes its own message.
   */
  private toWireMessages(messages: AIMessage[]): Record<string, unknown>[] {
    return messages
      .filter(message => message.role !== 'system')
      .map(message => {
        if (message.toolResults?.length) {
          return {
            role: 'user',
            content: message.toolResults.map(result => ({
              type: 'tool_result',
              tool_use_id: result.toolCallId,
              content: result.content,
              ...(result.isError ? { is_error: true } : {}),
            })),
          };
        }
        if (message.toolCalls?.length) {
          const blocks: Record<string, unknown>[] = [];
          if (message.content) {
            blocks.push({ type: 'text', text: message.content });
          }
          for (const call of message.toolCalls) {
            blocks.push({
              type: 'tool_use',
              id: call.id,
              name: call.name,
              input: call.input ?? {},
            });
          }
          return { role: 'assistant', content: blocks };
        }
        return { role: message.role, content: message.content };
      });
  }

  private parseToolCalls(
    content: MessagesResponse['content'],
  ): AIToolCall[] | undefined {
    const calls = (content ?? [])
      .filter(block => block?.type === 'tool_use' && block.name)
      .map((block, index) => ({
        id: block.id || `call_${index}`,
        name: block.name as string,
        input: (block.input ?? {}) as Record<string, unknown>,
      }));
    return calls.length ? calls : undefined;
  }

  private endpoint(provider: AIProvider, path: string): string {
    const base = provider.baseUrl || DEFAULT_BASE_URL;
    return `${base}${path}`;
  }

  async chat(
    provider: AIProvider,
    apiKey: string | null,
    messages: AIMessage[],
    options: AIRequestOptions,
    signal: AbortSignal,
  ): Promise<AIResult> {
    // Anthropic takes the system prompt as a top-level field, not as a
    // message with role "system" — sending it as a message is rejected.
    const conversation = messages.filter(message => message.role !== 'system');
    const systemFromMessages = messages
      .filter(message => message.role === 'system')
      .map(message => message.content)
      .join('\n');
    const system = [options.system, systemFromMessages]
      .filter(Boolean)
      .join('\n');

    const payload: Record<string, unknown> = {
      model: provider.model,
      // Required by this API, unlike the OpenAI shape where it is optional.
      max_tokens: options.maxTokens ?? provider.maxTokens,
      messages: this.toWireMessages(conversation),
    };
    if (system) payload.system = system;
    if (typeof options.temperature === 'number') {
      payload.temperature = options.temperature;
    }
    const tools: Record<string, unknown>[] = (options.tools ?? []).map(
      tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }),
    );

    // Provider-side MCP: the API connects to the remote server itself, so the
    // phone implements no MCP client. Both halves are required — declaring
    // `mcp_servers` without a matching `mcp_toolset` tool is a validation
    // error, not a silently ignored field.
    const betas: string[] = [];
    const mcpServers = provider.mcpServers ?? [];
    if (mcpServers.length) {
      payload.mcp_servers = mcpServers.map(server => ({
        type: 'url',
        url: server.url,
        name: server.name,
        ...(options.mcpTokens?.[server.name]
          ? { authorization_token: options.mcpTokens[server.name] }
          : {}),
      }));
      for (const server of mcpServers) {
        tools.push({
          type: 'mcp_toolset',
          mcp_server_name: server.name,
          allowed_tools: server.tools,
        });
      }
      betas.push(MCP_BETA);
    }

    if (tools.length) payload.tools = tools;

    const response = await postJson<MessagesResponse>(
      this.endpoint(provider, '/v1/messages'),
      this.headers(apiKey, betas),
      payload,
      signal,
    );

    // Filter for text blocks rather than reading content[0]: a thinking block
    // can legitimately come first, and indexing would return undefined.
    const text = (response.content ?? [])
      .filter(block => block?.type === 'text' && typeof block.text === 'string')
      .map(block => block.text as string)
      .join('');

    const toolCalls = this.parseToolCalls(response.content);
    // Asking for a tool is a complete turn, so empty prose is only an error
    // when the model also asked for nothing to run.
    if (!text && !toolCalls) {
      throw new AIError('provider_error', 'Provider returned no text content');
    }

    return {
      text,
      toolCalls,
      model: response.model || provider.model,
      providerId: provider.id,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    };
  }

  async listModels(
    provider: AIProvider,
    apiKey: string | null,
    signal: AbortSignal,
  ): Promise<string[]> {
    const ids: string[] = [];
    let after: string | undefined;

    // Paginated, so reading only the first page can come back short.
    for (let page = 0; page < MAX_MODEL_PAGES; page += 1) {
      const query =
        `?limit=${MODEL_PAGE_SIZE}` +
        (after ? `&after_id=${encodeURIComponent(after)}` : '');
      const response = await getJson<ModelsResponse>(
        this.endpoint(provider, `/v1/models${query}`),
        this.headers(apiKey),
        signal,
      );

      for (const entry of response.data ?? []) {
        if (typeof entry?.id === 'string' && entry.id) ids.push(entry.id);
      }

      after = response.last_id;
      if (!response.has_more || !after) break;
    }

    return sortModelIds(ids);
  }
}

export const anthropicProvider = new AnthropicProvider();
