import { createAddonInstallReview } from '../../src/services/scripting/AddonInstallReview';
import type { AddonManifest } from '../../src/services/scripting/AddonManifest';

const manifest: AddonManifest = {
  id: 'rs.androidircx.tools',
  name: 'Tools',
  author: 'AndroidIRCX',
  version: '1.0.0',
  description: 'Tools addon',
  license: 'GPL-3.0-or-later',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'main.js',
  permissions: ['irc.read', 'irc.raw.modify'],
};

describe('AddonInstallReview', () => {
  it('blocks unsigned addons outside Developer Mode', () => {
    const review = createAddonInstallReview({
      manifest,
      signatureStatus: 'unsigned',
      developerMode: false,
    });
    expect(review.canInstall).toBe(false);
    expect(review.blockers).toContain(
      'Unsigned addons require Developer Mode.',
    );
  });

  it('never permits an invalid signature', () => {
    const review = createAddonInstallReview({
      manifest,
      signatureStatus: 'invalid',
      developerMode: true,
    });
    expect(review.canInstall).toBe(false);
  });

  it('shows risk metadata and newly requested update permissions', () => {
    const review = createAddonInstallReview({
      manifest,
      signatureStatus: 'valid-known-key',
      developerMode: false,
      previouslyDeclared: ['irc.read'],
    });
    expect(review.canInstall).toBe(true);
    expect(review.permissions).toEqual([
      expect.objectContaining({ capability: 'irc.read', isNew: false }),
      expect.objectContaining({
        capability: 'irc.raw.modify',
        risk: 'critical',
        isNew: true,
        persistentGrantAllowed: false,
      }),
    ]);
  });
});

describe('createAddonInstallReview — update continuity (L7.4)', () => {
  const manifest = {
    id: 'rs.androidircx.demo',
    name: 'Demo',
    author: 'Test',
    version: '2.0.0',
    description: 'Test addon.',
    license: 'GPL-3.0-or-later',
    apiVersion: 1,
    minAppVersion: '1.10.0',
    entry: 'main.js',
    permissions: ['irc.read'],
  } as any;

  const review = (over: Record<string, unknown> = {}) =>
    createAddonInstallReview({
      manifest,
      signatureStatus: 'valid-known-key',
      developerMode: false,
      ...over,
    } as any);

  it('asks nothing extra for a clean first install', () => {
    const result = review();
    expect(result.requiresApproval).toEqual([]);
    expect(result.keyRotation).toBe(false);
    expect(result.canInstall).toBe(true);
  });

  it('demands approval when an update changes signing key', () => {
    const result = review({
      signatureStatus: 'valid-new-key',
      previouslyDeclared: ['irc.read'],
      previousKeyId: 'key-one',
      keyId: 'key-two',
    });

    expect(result.keyRotation).toBe(true);
    expect(result.requiresApproval.join()).toMatch(/different key/i);
    // A rotation is acceptable, but never quietly: it is still installable.
    expect(result.canInstall).toBe(true);
  });

  it('does not call it a rotation when the key is unchanged', () => {
    const result = review({
      previouslyDeclared: ['irc.read'],
      previousKeyId: 'key-one',
      keyId: 'key-one',
    });
    expect(result.keyRotation).toBe(false);
    expect(result.requiresApproval).toEqual([]);
  });

  it('demands approval when a signed addon updates to an unsigned one', () => {
    const result = review({
      signatureStatus: 'unsigned',
      developerMode: true,
      previouslyDeclared: ['irc.read'],
      previousKeyId: 'key-one',
    });
    // The same continuity break, read the other way round.
    expect(result.requiresApproval.join()).toMatch(
      /is signed and this update is not/i,
    );
  });

  it('demands approval for permissions an update newly asks for', () => {
    const result = review({
      manifest: { ...manifest, permissions: ['irc.read', 'irc.send'] },
      previouslyDeclared: ['irc.read'],
    });

    expect(result.requiresApproval.join()).toMatch(/1 permission/);
    expect(
      result.permissions.find(p => p.capability === 'irc.send')?.isNew,
    ).toBe(true);
  });

  it('still blocks an invalid signature outright', () => {
    const result = review({
      signatureStatus: 'invalid',
      previouslyDeclared: ['irc.read'],
      previousKeyId: 'key-one',
      keyId: 'key-two',
    });
    // A blocker is not something the user can approve their way past.
    expect(result.canInstall).toBe(false);
    expect(result.blockers.join()).toMatch(/invalid/i);
  });
});
