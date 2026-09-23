/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { AIError, AIErrorCode } from '../types';

/**
 * Minimal JSON-over-HTTP helper shared by every provider adapter.
 *
 * It exists so the HTTP status -> AIErrorCode mapping is written once. Every
 * provider returns the same failure vocabulary, which is what lets AIService
 * and the UI handle a bad key or a rate limit identically regardless of which
 * provider produced it.
 */

function statusToCode(status: number): AIErrorCode {
  if (status === 401 || status === 403) return 'auth_failed';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'provider_error';
  return 'invalid_request';
}

/**
 * Pull a human-readable message out of a provider error body. OpenAI and
 * Anthropic both nest it under `error.message`; others vary, so fall back to
 * the raw text rather than losing the detail.
 */
function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const message =
      parsed?.error?.message ??
      parsed?.error ??
      parsed?.message ??
      parsed?.detail;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  } catch {
    // Not JSON — fall through to the raw body.
  }
  return body.trim().substring(0, 300) || 'no response body';
}

async function request<T>(
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  body: unknown | undefined,
  signal: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error: any) {
    // An aborted request surfaces as an AbortError, which for us always means
    // the AIService timeout fired.
    if (error?.name === 'AbortError') {
      throw new AIError('timeout', 'Request timed out');
    }
    throw new AIError(
      'network',
      `Network error: ${String(error?.message ?? error)}`,
    );
  }

  if (!response.ok) {
    let raw = '';
    try {
      raw = await response.text();
    } catch {
      // Body already consumed or unreadable; the status alone still informs.
    }
    throw new AIError(
      statusToCode(response.status),
      `HTTP ${response.status}: ${extractErrorMessage(raw)}`,
      response.status,
    );
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new AIError(
      'provider_error',
      `Invalid JSON in provider response: ${String(error)}`,
    );
  }
}

export function postJson<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<T> {
  return request<T>('POST', url, headers, body, signal);
}

export function getJson<T>(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<T> {
  return request<T>('GET', url, headers, undefined, signal);
}
