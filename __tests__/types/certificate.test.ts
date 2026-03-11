/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  IRCService,
  FingerprintFormat,
  type CertificateInfo,
  type CertificateMetadata,
  type GenerateCertificateOptions,
  type CertificateValidation,
} from '../../src/types/certificate';

describe('types/certificate', () => {
  it('should expose expected IRC service enum values', () => {
    expect(IRCService.NICKSERV).toBe('NickServ');
    expect(IRCService.CERTFP).toBe('CertFP');
    expect(IRCService.HOSTSERV).toBe('HostServ');
  });

  it('should expose expected fingerprint format enum values', () => {
    expect(FingerprintFormat.COLON_SEPARATED_UPPER).toBe('colon-upper');
    expect(FingerprintFormat.COLON_SEPARATED_LOWER).toBe('colon-lower');
    expect(FingerprintFormat.NO_COLON_UPPER).toBe('no-colon-upper');
    expect(FingerprintFormat.NO_COLON_LOWER).toBe('no-colon-lower');
  });

  it('should support certificate data shapes', () => {
    const now = new Date('2026-03-11T00:00:00.000Z');
    const later = new Date('2027-03-11T00:00:00.000Z');

    const full: CertificateInfo = {
      id: 'cert-1',
      name: 'Main Cert',
      commonName: 'nick@example',
      fingerprint: 'abcdef123456',
      validFrom: now,
      validTo: later,
      pemCert: '---CERT---',
      pemKey: '---KEY---',
      createdAt: now,
    };
    const metadata: CertificateMetadata = {
      id: full.id,
      name: full.name,
      commonName: full.commonName,
      fingerprint: full.fingerprint,
      validFrom: full.validFrom,
      validTo: full.validTo,
      createdAt: full.createdAt,
    };
    const options: GenerateCertificateOptions = {
      name: 'New Cert',
      commonName: 'nick@network',
      validityYears: 2,
    };
    const validation: CertificateValidation = {
      isValid: true,
      isExpired: false,
      daysUntilExpiry: 365,
    };

    expect(metadata.fingerprint).toBe(full.fingerprint);
    expect(options.validityYears).toBe(2);
    expect(validation.isValid).toBe(true);
  });
});
