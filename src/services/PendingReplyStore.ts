/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * PendingReplyStore.ts
 *
 * Module-level store for pending IRCv3 reply context.
 * Set by MessageArea when user taps Reply, consumed by send path.
 */

export interface PendingReply {
  msgid: string;
  target: string;
  nick: string;
}

let pendingReply: PendingReply | null = null;
const listeners = new Set<(reply: PendingReply | null) => void>();

export function setPendingReply(reply: PendingReply | null): void {
  pendingReply = reply;
  listeners.forEach(listener => listener(reply));
}

/** Follow the pending reply, so the UI can show what is being replied to. */
export function subscribePendingReply(
  listener: (reply: PendingReply | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPendingReply(): PendingReply | null {
  return pendingReply;
}

export function getAndClearPendingReply(): PendingReply | null {
  const reply = pendingReply;
  if (reply) setPendingReply(null);
  return reply;
}
