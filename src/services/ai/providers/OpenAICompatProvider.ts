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

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface ModelsResponse {
  data?: Array<{ id?: string }>;
  /** Ollama's native /api/tags shape, tolerated so a stray URL still works. */
  models?: Array<{ name?: string }>;
}

/**
 * Adapter for the OpenAI chat-completions wire format.
 *
 * One adapter, many services: OpenAI itself, OpenRouter, Groq, LM Studio,
 * llama.cpp and vLLM all speak this shape — only `baseUrl` differs. `local`
 * providers use the same class, they just usually carry no key.
 */
class OpenAICompatProvider implements AIProviderAdapter {
  readonly kind: AIProviderKind = 'openai-compatible';

  private headers(apiKey: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    // Local servers (Ollama, llama.cpp) accept requests with no auth header.
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }
    return headers;
  }

  /**
   * Flatten our message shape into this API's, which spreads one logical turn
   * across several entries: the assistant turn carries `tool_calls`, and each
   * result is its own `role: "tool"` message keyed by `tool_call_id`.
   */
  private toWireMessages(messages: AIMessage[]): Record<string, unknown>[] {
    const wire: Record<string, unknown>[] = [];
    for (const message of messages) {
      if (message.toolResults?.length) {
        for (const result of message.toolResults) {
          wire.push({
            role: 'tool',
            tool_call_id: result.toolCallId,
            content: result.content,
          });
        }
        // A turn carrying results carries no prose of its own.
        if (!message.content) continue;
      }
      if (message.toolCalls?.length) {
        wire.push({
          role: message.role,
          content: message.content || null,
          tool_calls: message.toolCalls.map(call => ({
            id: call.id,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.input ?? {}),
            },
          })),
        });
        continue;
      }
      if (message.toolResults?.length && message.content) {
        wire.push({ role: 'user', content: message.content });
        continue;
      }
      wire.push({ role: message.role, content: message.content });
    }
    return wire;
  }

  private parseToolCalls(
    raw: ChatCompletionResponse['choices'],
  ): AIToolCall[] | undefined {
    const calls = raw?.[0]?.message?.tool_calls;
    if (!calls?.length) return undefined;
    return calls
      .filter(call => typeof call?.function?.name === 'string')
      .map((call, index) => {
        let input: Record<string, unknown> = {};
        try {
          // Arguments arrive as a JSON *string*; a truncated or malformed one
          // must not take the whole turn down.
          input = JSON.parse(call.function?.arguments || '{}');
        } catch {
          input = {};
        }
        return {
          id: call.id || `call_${index}`,
          name: call.function?.name as string,
          input,
        };
      });
  }

  private endpoint(provider: AIProvider, path: string): string {
    if (!provider.baseUrl) {
      throw new AIError(
        'invalid_request',
        `Provider ${provider.name} has no base URL configured`,
      );
    }
    return `${provider.baseUrl}${path}`;
  }

  async chat(
    provider: AIProvider,
    apiKey: string | null,
    messages: AIMessage[],
    options: AIRequestOptions,
    signal: AbortSignal,
  ): Promise<AIResult> {
    const wire = this.toWireMessages(messages);
    const payload: Record<string, unknown> = {
      model: provider.model,
      messages: options.system
        ? [{ role: 'system', content: options.system }, ...wire]
        : wire,
      max_tokens: options.maxTokens ?? provider.maxTokens,
    };
    if (typeof options.temperature === 'number') {
      payload.temperature = options.temperature;
    }
    if (options.tools?.length) {
      payload.tools = options.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
    }

    const response = await postJson<ChatCompletionResponse>(
      this.endpoint(provider, '/chat/completions'),
      this.headers(apiKey),
      payload,
      signal,
    );

    const toolCalls = this.parseToolCalls(response.choices);
    const text = response.choices?.[0]?.message?.content;
    // A turn that only asks for tools legitimately carries no prose, so an
    // empty content is an error only when no tools were requested either.
    if (typeof text !== 'string' && !toolCalls) {
      throw new AIError(
        'provider_error',
        'Provider returned no message content',
      );
    }

    return {
      text: typeof text === 'string' ? text : '',
      toolCalls,
      model: response.model || provider.model,
      providerId: provider.id,
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      },
    };
  }

  async listModels(
    provider: AIProvider,
    apiKey: string | null,
    signal: AbortSignal,
  ): Promise<string[]> {
    const response = await getJson<ModelsResponse>(
      this.endpoint(provider, '/models'),
      this.headers(apiKey),
      signal,
    );

    const ids = (response.data ?? [])
      .map(entry => entry?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (ids.length > 0) return sortModelIds(ids);

    // Ollama and a few other local servers answer with `models`/`name`
    // instead of the OpenAI shape.
    const names = (response.models ?? [])
      .map(entry => entry?.name)
      .filter((name): name is string => typeof name === 'string' && !!name);
    return sortModelIds(names);
  }
}

export const openAICompatProvider = new OpenAICompatProvider();
