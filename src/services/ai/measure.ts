/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { AIMessage } from './types';

/**
 * How large a request actually is, in characters.
 *
 * Its own module rather than a member of AIService: it is a pure measurement
 * with no state, and living in the service meant anything that mocked the
 * service lost it.
 *
 * Counts the system prompt, every message body, and **every tool result**.
 * Tool results are usually the bulk of it — a fetched page or a history read
 * dwarfs the conversation around it — and the old count left them out, which
 * is why the limit blocked ordinary conversations while letting the genuinely
 * enormous payloads through.
 */
export function measureRequest(messages: AIMessage[], system?: string): number {
  let total = (system ?? '').length;
  for (const message of messages) {
    total += message?.content?.length ?? 0;
    for (const result of message?.toolResults ?? []) {
      total += result?.content?.length ?? 0;
    }
  }
  return total;
}
