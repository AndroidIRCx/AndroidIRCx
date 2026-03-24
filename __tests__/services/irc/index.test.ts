/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

describe('irc/index', () => {
  it('exports the irc service modules without duplicate re-export errors', () => {
    const ircModule = require('../../../src/services/irc/index');
    expect(ircModule).toBeDefined();
    expect(typeof ircModule).toBe('object');
  });
});


