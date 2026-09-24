/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

export interface AddonModeChange {
  mode: string;
  adding: boolean;
  parameter?: string;
}

const ALWAYS_PARAMETER = new Set(['q', 'a', 'o', 'h', 'v', 'b', 'e', 'I']);
const PARAMETER_WHEN_ADDING = new Set(['k', 'l']);

/** Parses ordered MODE changes without assigning one target to many modes. */
export function parseAddonModeChanges(modeLine: string): AddonModeChange[] {
  const tokens = modeLine.trim().split(/\s+/).filter(Boolean);
  const modeToken = tokens.shift();
  if (!modeToken || !/[+-]/.test(modeToken)) return [];
  let adding = true;
  const changes: AddonModeChange[] = [];

  for (let index = 0; index < modeToken.length; index += 1) {
    const mode = modeToken[index];
    if (mode === '+') {
      adding = true;
      continue;
    }
    if (mode === '-') {
      adding = false;
      continue;
    }
    const takesParameter =
      ALWAYS_PARAMETER.has(mode) ||
      (PARAMETER_WHEN_ADDING.has(mode) && adding) ||
      // Removing a channel key commonly includes the old key, but servers may
      // omit it. Consume it only when enough parameters remain for later
      // always-parameter modes.
      (mode === 'k' &&
        !adding &&
        tokens.length > requiredRemaining(modeToken, index));
    changes.push({
      mode,
      adding,
      parameter: takesParameter ? tokens.shift() : undefined,
    });
  }
  return changes;
}

function requiredRemaining(modeToken: string, currentIndex: number): number {
  let adding = true;
  let required = 0;
  for (const mode of modeToken.slice(currentIndex + 1)) {
    if (mode === '+') adding = true;
    else if (mode === '-') adding = false;
    else if (
      ALWAYS_PARAMETER.has(mode) ||
      (PARAMETER_WHEN_ADDING.has(mode) && adding)
    )
      required += 1;
  }
  return required;
}
