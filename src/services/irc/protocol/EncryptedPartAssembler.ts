/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Long encrypted messages (`!enc-msg`, `!chanenc-msg`) leave as several lines,
 * each its own encrypted payload. The payloads of one message carry
 * `part: { id, i, n }` so the receiving side shows them as one message again.
 * Builds that do not know `part` ignore it and show the pieces one by one.
 *
 * `part` sits next to the ciphertext, not inside it, so it is not
 * authenticated: a server that reorders our lines could reorder the pieces of
 * a message. It can already reorder whole messages, and every piece still
 * decrypts and authenticates on its own.
 */

export interface EncryptedPart {
  id: string;
  i: number;
  n: number;
}

/** More pieces than this is not one of our messages. */
export const MAX_ENCRYPTED_PARTS = 64;
/** Pieces still missing after this long are shown as far as they arrived. */
export const ENCRYPTED_PART_TIMEOUT_MS = 60000;

/** The `part` of a payload, when it is a well-formed one. */
export function readEncryptedPart(payload: unknown): EncryptedPart | null {
  const part = (payload as { part?: unknown } | null)?.part as
    Partial<EncryptedPart> | undefined;
  if (!part || typeof part !== 'object') return null;
  const { id, i, n } = part;
  if (typeof id !== 'string' || id.length === 0 || id.length > 32) return null;
  if (!Number.isInteger(n) || (n as number) < 2) return null;
  if ((n as number) > MAX_ENCRYPTED_PARTS) return null;
  if (
    !Number.isInteger(i) ||
    (i as number) < 0 ||
    (i as number) >= (n as number)
  )
    return null;
  return { id, i: i as number, n: n as number };
}

/** A short random id that tells one split message from another. */
export function newEncryptedPartId(): string {
  return Math.random().toString(36).slice(2, 10) || 'p';
}

interface Pending {
  texts: Array<string | undefined>;
  received: number;
  timer: ReturnType<typeof setTimeout>;
  deliver: (text: string) => void;
}

export class EncryptedPartAssembler {
  private pending: Map<string, Pending> = new Map();

  /**
   * Add one decrypted piece. `key` identifies the message's sender and
   * conversation; `deliver` receives the whole text once every piece is in,
   * or what arrived when the rest does not come in time.
   */
  add(
    key: string,
    part: EncryptedPart,
    text: string,
    deliver: (text: string) => void,
  ): void {
    const id = `${key}\n${part.id}`;
    let entry = this.pending.get(id);
    if (!entry || entry.texts.length !== part.n) {
      if (entry) clearTimeout(entry.timer);
      entry = {
        texts: new Array(part.n).fill(undefined),
        received: 0,
        deliver,
        timer: setTimeout(() => this.flush(id), ENCRYPTED_PART_TIMEOUT_MS),
      };
      this.pending.set(id, entry);
    }
    if (entry.texts[part.i] === undefined) {
      entry.texts[part.i] = text;
      entry.received += 1;
    }
    if (entry.received === part.n) this.flush(id);
  }

  private flush(id: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    // The splitter keeps every character, so the pieces join with nothing.
    entry.deliver(entry.texts.filter(text => text !== undefined).join(''));
  }

  /** Pieces waiting for the rest of their message (for tests and cleanup). */
  get size(): number {
    return this.pending.size;
  }
}

export const encryptedPartAssembler = new EncryptedPartAssembler();
