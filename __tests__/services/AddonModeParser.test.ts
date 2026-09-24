/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { parseAddonModeChanges } from '../../src/services/scripting/AddonModeParser';

describe('AddonModeParser', () => {
  it('maps multi-prefix modes to their own targets in order', () => {
    expect(parseAddonModeChanges('+ov-h alice bob carol')).toEqual([
      { mode: 'o', adding: true, parameter: 'alice' },
      { mode: 'v', adding: true, parameter: 'bob' },
      { mode: 'h', adding: false, parameter: 'carol' },
    ]);
  });

  it('parses list modes, key and limit parameter rules', () => {
    expect(parseAddonModeChanges('+bkl *!*@bad key 50')).toEqual([
      { mode: 'b', adding: true, parameter: '*!*@bad' },
      { mode: 'k', adding: true, parameter: 'key' },
      { mode: 'l', adding: true, parameter: '50' },
    ]);
    expect(parseAddonModeChanges('-l+k old-key')).toEqual([
      { mode: 'l', adding: false, parameter: undefined },
      { mode: 'k', adding: true, parameter: 'old-key' },
    ]);
  });

  it('supports sign changes and modes without parameters', () => {
    expect(parseAddonModeChanges('+nt-i')).toEqual([
      { mode: 'n', adding: true, parameter: undefined },
      { mode: 't', adding: true, parameter: undefined },
      { mode: 'i', adding: false, parameter: undefined },
    ]);
  });

  it('uses the current occurrence when a mode letter repeats', () => {
    expect(parseAddonModeChanges('-k+k old-key new-key')).toEqual([
      { mode: 'k', adding: false, parameter: 'old-key' },
      { mode: 'k', adding: true, parameter: 'new-key' },
    ]);
  });

  it('returns no changes for malformed input', () => {
    expect(parseAddonModeChanges('')).toEqual([]);
    expect(parseAddonModeChanges('ov alice bob')).toEqual([]);
  });
});
