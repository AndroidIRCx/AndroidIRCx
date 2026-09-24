import {
  ADDON_API_VERSION,
  isSafeAddonPath,
  validateAddonManifest,
} from '../../src/services/scripting/AddonManifest';

const validManifest = () => ({
  id: 'rs.androidircx.nick-tools',
  name: 'Nick Tools',
  author: 'AndroidIRCX',
  version: '1.0.0',
  description: 'Safe example addon.',
  license: 'GPL-3.0-or-later',
  apiVersion: ADDON_API_VERSION,
  minAppVersion: '1.10.0',
  entry: 'main.js',
  permissions: ['irc.read', 'ui.extend'],
  homepage: 'https://androidircx.com',
  icon: 'assets/icon.png',
  assets: ['assets/help.txt'],
});

describe('AddonManifest', () => {
  it('accepts a complete known-capability manifest', () => {
    expect(validateAddonManifest(validManifest())).toEqual({
      ok: true,
      manifest: validManifest(),
    });
  });

  it.each(['../main.js', '/main.js', 'C:\\main.js', 'a//main.js', './main.js'])(
    'rejects unsafe package path %s',
    path => expect(isSafeAddonPath(path)).toBe(false),
  );

  it('fails closed for unknown and duplicate permissions', () => {
    const result = validateAddonManifest({
      ...validManifest(),
      permissions: ['irc.read', 'future.root', 'irc.read'],
    });
    expect(result).toEqual({
      ok: false,
      errors: [
        'Unknown permission: future.root.',
        'Duplicate permission: irc.read.',
      ],
    });
  });

  it('rejects unsupported API versions and non-HTTPS homepages', () => {
    const result = validateAddonManifest({
      ...validManifest(),
      apiVersion: 999,
      homepage: 'http://example.com',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Unsupported apiVersion: 999.',
          'Invalid homepage.',
        ]),
      );
    }
  });

  it('rejects malformed required fields, assets and entry files', () => {
    const result = validateAddonManifest({
      ...validManifest(),
      id: 'Bad ID',
      version: '1.0',
      entry: 'main.ts',
      assets: ['ok.txt', '../secret'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Invalid id.',
          'Invalid version.',
          'Invalid entry path.',
          'Invalid assets.',
        ]),
      );
  });

  it('rejects unknown fields, non-string homepages and case collisions', () => {
    const result = validateAddonManifest({
      ...validManifest(),
      futureAccess: true,
      homepage: { toString: () => 'https://example.com' },
      assets: ['assets/A.txt', 'assets/a.txt'],
    });
    expect(result).toEqual({
      ok: false,
      errors: [
        'Unknown manifest field: futureAccess.',
        'Invalid homepage.',
        'Invalid assets.',
      ],
    });
  });
});
