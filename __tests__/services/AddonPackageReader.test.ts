import { bytesToHex } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { strToU8, zipSync } from 'fflate';
import {
  AddonPackageError,
  readAddonPackage,
} from '../../src/services/scripting/AddonPackageReader';
import { ADDON_PACKAGE_LIMITS } from '../../src/services/scripting/AddonPackagePolicy';

const manifest = (overrides: Record<string, unknown> = {}) => ({
  id: 'rs.androidircx.reader-test',
  name: 'Reader Test',
  author: 'AndroidIRCX',
  version: '1.0.0',
  description: 'Package reader test.',
  license: 'GPL-3.0-or-later',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'main.js',
  permissions: ['irc.read'],
  ...overrides,
});

const packageBytes = (manifestValue: unknown = manifest()) =>
  zipSync({
    'manifest.json': strToU8(JSON.stringify(manifestValue)),
    'main.js': strToU8('module.exports = {};'),
    'assets/help.txt': strToU8('help'),
  });

describe('AddonPackageReader', () => {
  it('extracts a valid bounded package and hashes the original bytes', () => {
    const bytes = packageBytes();
    const result = readAddonPackage(bytes);
    expect(result.manifest.id).toBe('rs.androidircx.reader-test');
    expect(result.files.get('main.js')).toEqual(
      strToU8('module.exports = {};'),
    );
    expect(result.checksumSha256).toBe(bytesToHex(sha256(bytes)));
  });

  it('rejects traversal before exposing extracted files', () => {
    const bytes = zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest())),
      'main.js': strToU8('ok'),
      '../secret.txt': strToU8('secret'),
    });
    expect(() => readAddonPackage(bytes)).toThrow(
      'Unsafe package path: ../secret.txt.',
    );
  });

  it('rejects compression bombs before extraction begins', () => {
    const bytes = zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest())),
      'main.js': strToU8('ok'),
      'bomb.bin': new Uint8Array(1024 * 1024),
    });
    expect(() => readAddonPackage(bytes)).toThrow(
      'Suspicious compression ratio: bomb.bin.',
    );
  });

  it('rejects invalid manifests and missing entry files', () => {
    expect(() => readAddonPackage(packageBytes({ bad: true }))).toThrow(
      AddonPackageError,
    );
    expect(() =>
      readAddonPackage(
        zipSync({
          'manifest.json': strToU8(
            JSON.stringify(manifest({ entry: 'missing.js' })),
          ),
          'main.js': strToU8('ok'),
        }),
      ),
    ).toThrow('Manifest entry file is missing.');
  });

  it('rejects empty, oversized and malformed archives', () => {
    expect(() => readAddonPackage(new Uint8Array())).toThrow(
      'Package is empty.',
    );
    expect(() =>
      readAddonPackage(
        new Uint8Array(ADDON_PACKAGE_LIMITS.maxCompressedBytes + 1),
      ),
    ).toThrow('Compressed package is too large.');
    expect(() => readAddonPackage(strToU8('not a zip'))).toThrow();
  });
});
