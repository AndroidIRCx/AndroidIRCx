/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Runtime coverage for the enums exported from src/types/certificate.ts.
 * The rest of the module is type-only (elided at runtime); these enums are the
 * only executable code and are otherwise imported purely as types elsewhere.
 */

import { IRCService, FingerprintFormat } from '../../src/types/certificate';

describe('certificate enums', () => {
  it('exposes the CertFP-capable IRC service identifiers', () => {
    expect(IRCService.NICKSERV).toBe('NickServ');
    expect(IRCService.CERTFP).toBe('CertFP');
    expect(IRCService.HOSTSERV).toBe('HostServ');
    expect(Object.keys(IRCService)).toHaveLength(3);
  });

  it('exposes every fingerprint format option', () => {
    expect(FingerprintFormat.COLON_SEPARATED_UPPER).toBe('colon-upper');
    expect(FingerprintFormat.COLON_SEPARATED_LOWER).toBe('colon-lower');
    expect(FingerprintFormat.NO_COLON_UPPER).toBe('no-colon-upper');
    expect(FingerprintFormat.NO_COLON_LOWER).toBe('no-colon-lower');
    expect(Object.values(FingerprintFormat)).toEqual([
      'colon-upper',
      'colon-lower',
      'no-colon-upper',
      'no-colon-lower',
    ]);
  });
});
