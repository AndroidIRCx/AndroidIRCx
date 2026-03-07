/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockSecrets = new Map<string, string>();
const mockGetSecret = jest.fn(async (k: string) => mockSecrets.get(k) ?? null);
const mockSetSecret = jest.fn(async (k: string, v: string) => {
  mockSecrets.set(k, v);
});
const mockRemoveSecret = jest.fn(async (k: string) => {
  mockSecrets.delete(k);
});

jest.mock('../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    getSecret: (...args: any[]) => mockGetSecret(...args),
    setSecret: (...args: any[]) => mockSetSecret(...args),
    removeSecret: (...args: any[]) => mockRemoveSecret(...args),
  },
}));

import { certificateManager } from '../../src/services/CertificateManagerService';
import { FingerprintFormat } from '../../src/types/certificate';

describe('CertificateManagerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecrets.clear();
  });

  it('validates generateCertificate input', async () => {
    await expect(certificateManager.generateCertificate({ name: '', commonName: 'cn' } as any)).rejects.toThrow(
      'Certificate name is required',
    );
    await expect(certificateManager.generateCertificate({ name: 'n', commonName: '' } as any)).rejects.toThrow(
      'Common Name (CN) is required',
    );
    await expect(
      certificateManager.generateCertificate({ name: 'n', commonName: 'cn', validityYears: 11 }),
    ).rejects.toThrow('Validity period must be between 1 and 10 years');
  });

  it('generates certificate and stores metadata/index', async () => {
    const cert = await certificateManager.generateCertificate({
      name: 'My Cert',
      commonName: 'irc.example',
      validityYears: 2,
    });

    expect(cert.name).toBe('My Cert');
    expect(cert.commonName).toBe('irc.example');
    expect(cert.fingerprint).toMatch(/^[a-f0-9]+$/);
    expect(mockSetSecret).toHaveBeenCalled();

    const list = await certificateManager.listCertificates();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(cert.id);
  });

  it('handles generateCertificate internal failure', async () => {
    const saveSpy = jest.spyOn(certificateManager as any, 'saveCertificate').mockRejectedValueOnce(new Error('boom'));
    await expect(
      certificateManager.generateCertificate({ name: 'x', commonName: 'y', validityYears: 1 }),
    ).rejects.toThrow('Failed to generate certificate');
    saveSpy.mockRestore();
  });

  it('lists and parses certificate metadata dates', async () => {
    mockSecrets.set(
      'certs:index',
      JSON.stringify([
        {
          id: '1',
          name: 'N',
          commonName: 'CN',
          fingerprint: 'ff',
          validFrom: '2026-01-01T00:00:00.000Z',
          validTo: '2027-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );

    const items = await certificateManager.listCertificates();
    expect(items[0].validFrom).toBeInstanceOf(Date);
    expect(items[0].validTo).toBeInstanceOf(Date);
    expect(items[0].createdAt).toBeInstanceOf(Date);
  });

  it('returns empty list when list parse fails', async () => {
    mockSecrets.set('certs:index', '{bad json');
    const items = await certificateManager.listCertificates();
    expect(items).toEqual([]);
  });

  it('gets full certificate and returns null when missing or invalid', async () => {
    const payload = {
      id: 'c1',
      name: 'A',
      commonName: 'CN',
      fingerprint: 'ff',
      pemCert: 'pem',
      pemKey: 'key',
      validFrom: '2026-01-01T00:00:00.000Z',
      validTo: '2027-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    mockSecrets.set('cert:c1', JSON.stringify(payload));
    const cert = await certificateManager.getCertificate('c1');
    expect(cert?.id).toBe('c1');
    expect(cert?.validFrom).toBeInstanceOf(Date);

    expect(await certificateManager.getCertificate('missing')).toBeNull();
    mockSecrets.set('cert:bad', '{invalid');
    expect(await certificateManager.getCertificate('bad')).toBeNull();
  });

  it('deletes certificate and updates index', async () => {
    mockSecrets.set(
      'certs:index',
      JSON.stringify([
        {
          id: 'a',
          name: 'A',
          commonName: 'cn',
          fingerprint: '1',
          validFrom: new Date().toISOString(),
          validTo: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        {
          id: 'b',
          name: 'B',
          commonName: 'cn',
          fingerprint: '2',
          validFrom: new Date().toISOString(),
          validTo: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ]),
    );
    await certificateManager.deleteCertificate('a');
    expect(mockRemoveSecret).toHaveBeenCalledWith('cert:a');
    const idx = JSON.parse(mockSecrets.get('certs:index') || '[]');
    expect(idx).toHaveLength(1);
    expect(idx[0].id).toBe('b');
  });

  it('handles deleteCertificate list failure gracefully', async () => {
    mockGetSecret.mockRejectedValueOnce(new Error('fail list'));
    await expect(certificateManager.deleteCertificate('x')).resolves.toBeUndefined();
    expect(mockRemoveSecret).toHaveBeenCalledWith('cert:x');
  });

  it('throws when deleteCertificate cannot persist updated index', async () => {
    mockSecrets.set('certs:index', JSON.stringify([]));
    mockSetSecret.mockRejectedValueOnce(new Error('write fail'));
    await expect(certificateManager.deleteCertificate('x')).rejects.toThrow('Failed to delete certificate');
  });

  it('computes fingerprint and handles invalid inputs', () => {
    expect(certificateManager.getFingerprint('')).toBeNull();
    expect(certificateManager.getFingerprint('not pem')).toBeNull();
    // malformed PEM body should fail safely
    expect(certificateManager.getFingerprint('-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----')).toBeNull();
  });

  it('formats fingerprint in all supported styles', () => {
    const fp = 'aabbccdd';
    expect(certificateManager.formatFingerprint(fp, FingerprintFormat.COLON_SEPARATED_UPPER)).toBe('AA:BB:CC:DD');
    expect(certificateManager.formatFingerprint(fp, FingerprintFormat.COLON_SEPARATED_LOWER)).toBe('aa:bb:cc:dd');
    expect(certificateManager.formatFingerprint(fp, FingerprintFormat.NO_COLON_UPPER)).toBe('AABBCCDD');
    expect(certificateManager.formatFingerprint(fp, FingerprintFormat.NO_COLON_LOWER)).toBe('aabbccdd');
  });

  it('validates certificates for valid and expired cases', () => {
    const now = Date.now();
    const valid = certificateManager.validateCertificate({
      id: '1',
      name: 'v',
      commonName: 'cn',
      fingerprint: 'f',
      validFrom: new Date(now - 1000),
      validTo: new Date(now + 5 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 1000),
    } as any);
    expect(valid.isValid).toBe(true);
    expect(valid.isExpired).toBe(false);

    const expired = certificateManager.validateCertificate({
      id: '2',
      name: 'e',
      commonName: 'cn',
      fingerprint: 'f',
      validFrom: new Date(now - 10 * 24 * 60 * 60 * 1000),
      validTo: new Date(now - 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
    } as any);
    expect(expired.isExpired).toBe(true);
    expect(expired.error).toContain('expired');
  });

  it('extracts fingerprint from pem and exposes private helpers', async () => {
    const cert = await certificateManager.generateCertificate({
      name: 'Extract Cert',
      commonName: 'extract.example',
      validityYears: 1,
    });
    expect(certificateManager.extractFingerprintFromPem(cert.pemCert)).toBe(cert.fingerprint);

    const uuid = (certificateManager as any).generateUUID();
    expect(uuid).toMatch(/^[a-f0-9-]{36}$/);
    const serial = (certificateManager as any).generateSerialNumber();
    expect(typeof serial).toBe('string');
    expect(serial.length).toBeGreaterThan(0);
  });
});
