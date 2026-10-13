/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Whether wire lines become raw chat messages. Only while the raw view can
 * show them: otherwise every inbound line is stored twice - once parsed, once
 * as hidden raw text in the server tab - and runs the whole message pipeline
 * for nothing. The UI keeps this in sync with its raw-view settings; both
 * directions stay on until it does. Kept dependency-free so IRCService and
 * the UI can share it without an import cycle.
 */
const capture = { in: true, out: true };

export function setWireMessageCapture(next: {
  in: boolean;
  out: boolean;
}): void {
  capture.in = next.in;
  capture.out = next.out;
}

export function isWireMessageCaptured(direction: 'in' | 'out'): boolean {
  return capture[direction];
}
