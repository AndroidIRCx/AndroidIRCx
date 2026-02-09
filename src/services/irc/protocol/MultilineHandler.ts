/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRCv3 draft/multiline message assembly handler.
 * Buffers multiline message parts and assembles them when complete.
 */

interface MultilineBuffer {
  from: string;
  parts: string[];
  timestamp: number;
}

export class MultilineHandler {
  private multilineBuffers: Map<string, MultilineBuffer> = new Map();
  private readonly MULTILINE_TIMEOUT = 5000;

  /**
   * Handle a multiline message part.
   * Returns the assembled text when all parts are received, or null while buffering.
   */
  handleMultilineMessage(
    from: string,
    target: string,
    text: string,
    concatTag: string | undefined,
    _otherTags: {
      timestamp: number;
      account?: string;
      msgid?: string;
      channelContext?: string;
      replyTo?: string;
    }
  ): string | null {
    // If no concat tag, it's a regular single-line message
    if (!concatTag) {
      return text;
    }

    const bufferKey = `${from}:${target}`;

    // Clean up old buffers (timeout)
    const now = Date.now();
    this.multilineBuffers.forEach((buffer, key) => {
      if (now - buffer.timestamp > this.MULTILINE_TIMEOUT) {
        this.multilineBuffers.delete(key);
      }
    });

    // Get or create buffer for this sender/target pair
    let buffer = this.multilineBuffers.get(bufferKey);
    if (!buffer) {
      buffer = { from, parts: [], timestamp: now };
      this.multilineBuffers.set(bufferKey, buffer);
    }

    // Add this part to the buffer
    buffer.parts.push(text);
    buffer.timestamp = now;

    // Check if this is the last part (empty concat tag means last part)
    const isLastPart = concatTag === '';

    if (isLastPart) {
      const fullMessage = buffer.parts.join('\n');
      this.multilineBuffers.delete(bufferKey);
      return fullMessage;
    }

    // Not the last part, return null to indicate we're still buffering
    return null;
  }
}
