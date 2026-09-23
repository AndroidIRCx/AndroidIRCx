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

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL_PAGE_SIZE = 200;
/** A stop, so a provider that always returns a token cannot loop forever. */
const MAX_MODEL_PAGES = 10;

interface GenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        functionCall?: { name?: string; args?: Record<string, unknown> };
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

interface ModelsResponse {
  models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  /** Present while there are more models than one page holds. */
  nextPageToken?: string;
}

/**
 * Adapter for the Google Generative Language API.
 *
 * Worth knowing: Gemini has a genuinely free tier, so this is the one cloud
 * provider a user can try without paying anything. Two shape differences from
 * the other adapters — the key travels as a query parameter rather than a
 * header, and the assistant role is called "model".
 */
class GeminiProvider implements AIProviderAdapter {
  readonly kind: AIProviderKind = 'gemini';

  private base(provider: AIProvider): string {
    return provider.baseUrl || DEFAULT_BASE_URL;
  }

  private requireKey(apiKey: string | null): string {
    if (!apiKey) {
      throw new AIError('missing_key', 'Gemini requires an API key');
    }
    return apiKey;
  }

  /** Models come back as "models/gemini-x"; callers store the bare id. */
  private qualify(model: string): string {
    return model.startsWith('models/') ? model : `models/${model}`;
  }

  /**
   * This API has no tool-call ids: a result is matched back to its call by
   * function NAME. We synthesize ids on the way out so the rest of the app
   * has one shape, and drop them again on the way in.
   */
  private toWireContents(messages: AIMessage[]): Record<string, unknown>[] {
    return messages
      .filter(message => message.role !== 'system')
      .map(message => {
        if (message.toolResults?.length) {
          return {
            role: 'user',
            parts: message.toolResults.map(result => ({
              functionResponse: {
                name: result.name,
                response: { content: result.content },
              },
            })),
          };
        }
        if (message.toolCalls?.length) {
          const parts: Record<string, unknown>[] = [];
          if (message.content) parts.push({ text: message.content });
          for (const call of message.toolCalls) {
            parts.push({
              functionCall: { name: call.name, args: call.input ?? {} },
            });
          }
          return { role: 'model', parts };
        }
        return {
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        };
      });
  }

  private parseToolCalls(
    parts: Array<{
      functionCall?: { name?: string; args?: Record<string, unknown> };
    }>,
  ): AIToolCall[] | undefined {
    const calls = parts
      .filter(part => part?.functionCall?.name)
      .map((part, index) => ({
        // Synthesized: the provider gives no id of its own.
        id: `${part.functionCall?.name}_${index}`,
        name: part.functionCall?.name as string,
        input: (part.functionCall?.args ?? {}) as Record<string, unknown>,
      }));
    return calls.length ? calls : undefined;
  }

  async chat(
    provider: AIProvider,
    apiKey: string | null,
    messages: AIMessage[],
    options: AIRequestOptions,
    signal: AbortSignal,
  ): Promise<AIResult> {
    const key = this.requireKey(apiKey);

    const systemFromMessages = messages
      .filter(message => message.role === 'system')
      .map(message => message.content)
      .join('\n');
    const system = [options.system, systemFromMessages]
      .filter(Boolean)
      .join('\n');

    const contents = this.toWireContents(messages);

    const payload: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? provider.maxTokens,
        ...(typeof options.temperature === 'number'
          ? { temperature: options.temperature }
          : {}),
      },
    };
    if (system) {
      payload.systemInstruction = { parts: [{ text: system }] };
    }
    if (options.tools?.length) {
      payload.tools = [
        {
          functionDeclarations: options.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          })),
        },
      ];
    }

    const url = `${this.base(provider)}/${this.qualify(
      provider.model,
    )}:generateContent?key=${encodeURIComponent(key)}`;

    const response = await postJson<GenerateContentResponse>(
      url,
      { 'content-type': 'application/json' },
      payload,
      signal,
    );

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map(part => part?.text)
      .filter((value): value is string => typeof value === 'string')
      .join('');
    const toolCalls = this.parseToolCalls(parts);

    if (!text && !toolCalls) {
      throw new AIError('provider_error', 'Provider returned no text content');
    }

    return {
      text,
      toolCalls,
      model: provider.model,
      providerId: provider.id,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount,
      },
    };
  }

  async listModels(
    provider: AIProvider,
    apiKey: string | null,
    signal: AbortSignal,
  ): Promise<string[]> {
    const key = this.requireKey(apiKey);
    const ids: string[] = [];
    let pageToken: string | undefined;

    // This endpoint pages, and the default page is smaller than the catalogue.
    // Reading only the first one is why the list sometimes arrived short.
    for (let page = 0; page < MAX_MODEL_PAGES; page += 1) {
      const url =
        `${this.base(provider)}/models?pageSize=${MODEL_PAGE_SIZE}` +
        `&key=${encodeURIComponent(key)}` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
      const response = await getJson<ModelsResponse>(
        url,
        { 'content-type': 'application/json' },
        signal,
      );

      for (const entry of response.models ?? []) {
        // Embedding-only models cannot answer a chat request; offering them
        // would produce a provider error the user cannot diagnose.
        const usable =
          !entry?.supportedGenerationMethods ||
          entry.supportedGenerationMethods.includes('generateContent');
        const name = entry?.name;
        if (usable && typeof name === 'string' && name) {
          ids.push(name.replace(/^models\//, ''));
        }
      }

      pageToken = response.nextPageToken;
      if (!pageToken) break;
    }

    return sortModelIds(ids);
  }
}

export const geminiProvider = new GeminiProvider();
