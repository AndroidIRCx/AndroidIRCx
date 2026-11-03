/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { IRCMessage } from '../IRCService';

/**
 * Lets scripts see every numeric; returning false hides its default UI line.
 * ScriptingService registers it and IRCService calls it. Kept dependency-free
 * so neither service imports the other: IRCService used to require
 * ScriptingService, which closed an import cycle through ConnectionManager.
 */
export type NumericScriptHook = (
  code: number,
  params: string[],
  text: string,
  message: IRCMessage,
) => boolean;

let hook: NumericScriptHook | null = null;

export function setNumericScriptHook(next: NumericScriptHook | null): void {
  hook = next;
}

export function getNumericScriptHook(): NumericScriptHook | null {
  return hook;
}
