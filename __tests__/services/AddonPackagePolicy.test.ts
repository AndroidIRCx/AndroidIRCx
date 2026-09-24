import {
  ADDON_PACKAGE_LIMITS,
  validateAddonArchiveEntries,
} from '../../src/services/scripting/AddonPackagePolicy';

describe('AddonPackagePolicy', () => {
  it('accepts a small package with a root manifest', () => {
    expect(
      validateAddonArchiveEntries([
        { path: 'manifest.json', compressedSize: 100, uncompressedSize: 200 },
        { path: 'src\\main.js', compressedSize: 200, uncompressedSize: 400 },
      ]),
    ).toEqual({ ok: true, normalizedPaths: ['manifest.json', 'src/main.js'] });
  });

  it('accepts safe directory entries without treating them as files', () => {
    expect(
      validateAddonArchiveEntries([
        { path: 'manifest.json', compressedSize: 10, uncompressedSize: 10 },
        {
          path: 'assets/',
          compressedSize: 0,
          uncompressedSize: 0,
          isDirectory: true,
        },
        { path: 'assets/icon.png', compressedSize: 10, uncompressedSize: 10 },
      ]),
    ).toEqual({
      ok: true,
      normalizedPaths: ['manifest.json', 'assets/icon.png'],
    });
  });

  it('rejects empty packages and packages without a root manifest', () => {
    expect(validateAddonArchiveEntries([])).toEqual({
      ok: false,
      errors: [
        'Package is empty.',
        'Package must contain manifest.json at its root.',
      ],
    });
    expect(
      validateAddonArchiveEntries([
        {
          path: 'nested/manifest.json',
          compressedSize: 1,
          uncompressedSize: 1,
        },
      ]).ok,
    ).toBe(false);
  });

  it('rejects traversal and case-insensitive duplicate paths', () => {
    const result = validateAddonArchiveEntries([
      { path: 'manifest.json', compressedSize: 1, uncompressedSize: 1 },
      { path: '../main.js', compressedSize: 1, uncompressedSize: 1 },
      { path: 'SRC/main.js', compressedSize: 1, uncompressedSize: 1 },
      { path: 'src/main.js', compressedSize: 1, uncompressedSize: 1 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Unsafe package path: ../main.js.',
          'Duplicate package path: src/main.js.',
        ]),
      );
  });

  it('rejects invalid sizes, oversized entries and compression bombs', () => {
    const result = validateAddonArchiveEntries([
      { path: 'manifest.json', compressedSize: 1, uncompressedSize: 1 },
      {
        path: 'huge.dat',
        compressedSize: 1,
        uncompressedSize: ADDON_PACKAGE_LIMITS.maxEntryBytes + 1,
      },
      { path: 'invalid.dat', compressedSize: -1, uncompressedSize: 2 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Package entry is too large: huge.dat.',
          'Suspicious compression ratio: huge.dat.',
          'Invalid entry size: invalid.dat.',
        ]),
      );
  });
});
