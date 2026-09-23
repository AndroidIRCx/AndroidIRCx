/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Shared types for the AI subsystem.
 *
 * Design rule that the rest of the subsystem depends on: an `AIProvider` never
 * carries the API key. The key lives only in SecureStorageService (Keychain);
 * the provider object carries `hasKey` so the UI can show state without ever
 * reading the secret. Scripts receive a redacted view (`AIProviderInfo`).
 */

/**
 * Provider families.
 *
 * - `openai-compatible` covers OpenAI itself plus OpenRouter, Groq, LM Studio,
 *   llama.cpp and vLLM — same wire format, different baseUrl.
 * - `local` is a locally/LAN-hosted model server (Ollama, LM Studio). It is NOT
 *   a bridge to a subscription-authenticated CLI: Anthropic blocked third-party
 *   use of Claude Pro/Max OAuth on 2026-04-04, so that path would get the
 *   user's account banned. See secrets/PROJECT.md § PLAN — AI in scripting.
 */
export type AIProviderKind =
  'anthropic' | 'openai-compatible' | 'gemini' | 'local';

/**
 * A remote MCP server this provider may reach.
 *
 * Only remote Streamable-HTTP servers can appear here: MCP's other transport
 * is stdio, which requires launching a subprocess, and Android has none. The
 * token, when there is one, lives in the Keychain like any other secret.
 */
export interface AIMcpServer {
  name: string;
  url: string;
  /** Tool names the page may call; an empty list is refused by the provider. */
  tools: string[];
  hasToken: boolean;
}

/** A configured provider, as persisted. Never contains the API key. */
export interface AIProvider {
  id: string;
  name: string;
  kind: AIProviderKind;
  /** Required for `openai-compatible` and `local`; ignored for the rest. */
  baseUrl?: string;
  model: string;
  /** True when a key is stored in the Keychain for this provider. */
  hasKey: boolean;
  maxTokens: number;
  enabled: boolean;
  /** Remote MCP servers, for providers that connect to them server-side. */
  mcpServers?: AIMcpServer[];
}

/** The redacted view handed to scripts — no key, no baseUrl, no internals. */
export interface AIProviderInfo {
  id: string;
  name: string;
  model: string;
}

export type AIRole = 'user' | 'assistant' | 'system';

/**
 * A tool the model may call. `inputSchema` is a JSON Schema object; each
 * adapter reshapes it into whatever its provider expects, but the schema
 * itself is written once, in provider-neutral form.
 */
export interface AITool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /**
   * Whether running this tool changes anything. Read-only tools may run
   * unattended; anything else must be confirmed by the user first. The
   * adapters ignore this field — it is policy for the caller, and the reason
   * it lives on the tool is so a tool cannot be added without deciding.
   */
  mutates: boolean;
}

export interface AIToolCall {
  /** Provider-assigned id, echoed back with the result. */
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIToolResult {
  toolCallId: string;
  name: string;
  content: string;
  isError?: boolean;
}

export interface AIMessage {
  role: AIRole;
  content: string;
  /** On an assistant turn: the tools the model asked to run. */
  toolCalls?: AIToolCall[];
  /** On a user turn: what those tools returned. */
  toolResults?: AIToolResult[];
}

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AIResult {
  text: string;
  model: string;
  providerId: string;
  usage?: AIUsage;
  /** Present when the model wants tools run before it can answer. */
  toolCalls?: AIToolCall[];
}

export interface AIRequestOptions {
  /** Provider id; falls back to the default provider when omitted. */
  provider?: string;
  maxTokens?: number;
  /** System prompt, sent in whatever way the provider expects. */
  system?: string;
  temperature?: number;
  /** Request timeout in ms. */
  timeoutMs?: number;
  /**
   * Tools the model may call this turn. When set, nick pseudonymization is
   * switched off for the request: an agent told to message "user3" cannot act,
   * because that is not anyone's nick. Hostmask, IP and e-mail stripping still
   * applies.
   */
  tools?: AITool[];
  /**
   * MCP bearer tokens by server name, resolved by AIService from the Keychain.
   * Adapters read it; nothing else sets it.
   */
  mcpTokens?: Record<string, string>;
  /**
   * Where the prompt's content came from. When set, AIService enforces the
   * per-channel opt-in before the request leaves the device — other people in
   * that channel never agreed to have their words sent anywhere.
   */
  channel?: string;
  network?: string;
  /**
   * This request continues a turn the caller already booked, rather than
   * starting a new one. The cooldown is skipped for it; the daily cap and the
   * concurrency limit still apply.
   *
   * The cooldown exists to put a gap between *turns* — a script reacting to
   * channel traffic must not fire on every line. An agent working through
   * several tool rounds to answer one question is one turn, and throttling its
   * middle rounds only strands the user mid-answer.
   */
  continuesTurn?: boolean;
}

/** Machine-readable failure reasons, so callers can branch without parsing text. */
export type AIErrorCode =
  | 'no_provider'
  | 'provider_disabled'
  | 'missing_key'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'prompt_too_long'
  | 'invalid_request'
  | 'disabled'
  | 'consent_required'
  | 'channel_not_allowed'
  | 'auth_failed'
  | 'network'
  | 'timeout'
  | 'provider_error';

/**
 * Why AI cannot run right now, and where the user fixes it.
 *
 * `isAvailable()` answers yes/no, which is useless to someone staring at a
 * disabled button. Every surface that can refuse work shows `reason` and
 * `where` instead, so the next step is always named.
 */
export type AIReadinessCode =
  'ok' | 'disabled' | 'no_provider' | 'missing_key' | 'consent_required';

export interface AIReadiness {
  code: AIReadinessCode;
  ready: boolean;
  /** What is wrong, in one sentence. */
  reason: string;
  /** Where to fix it, as a settings path. Empty when nothing is wrong. */
  where: string;
}

export class AIError extends Error {
  readonly code: AIErrorCode;
  /** HTTP status when the failure came from a provider response. */
  readonly status?: number;

  constructor(code: AIErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.status = status;
  }
}

/**
 * What every provider adapter implements. Adapters are pure transport: they
 * translate to and from one provider's wire format and do nothing else.
 * Rate limiting, caps, redaction and the kill switch live in AIService above
 * them, so they are implemented once rather than per provider.
 */
export interface AIProviderAdapter {
  readonly kind: AIProviderKind;
  /** Send a chat completion request. */
  chat(
    provider: AIProvider,
    apiKey: string | null,
    messages: AIMessage[],
    options: AIRequestOptions,
    signal: AbortSignal,
  ): Promise<AIResult>;
  /**
   * List models available to this key. Doubles as the "Test connection" probe:
   * cheap, spends no tokens, and fails loudly on a bad key.
   */
  listModels(
    provider: AIProvider,
    apiKey: string | null,
    signal: AbortSignal,
  ): Promise<string[]>;
}
