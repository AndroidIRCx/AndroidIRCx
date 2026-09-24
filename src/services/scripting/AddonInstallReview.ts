/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { ADDON_CAPABILITY_DEFINITIONS } from './AddonCapabilities';
import type { AddonCapability, AddonManifest } from './AddonManifest';

export type AddonSignatureStatus =
  'unsigned' | 'valid-known-key' | 'valid-new-key' | 'invalid';

export interface AddonInstallReview {
  manifest: AddonManifest;
  signatureStatus: AddonSignatureStatus;
  canInstall: boolean;
  blockers: string[];
  /**
   * Things the user has to actively acknowledge before this proceeds. Unlike a
   * blocker these can be accepted — but not by tapping through, and not by an
   * addon deciding on the user's behalf.
   */
  requiresApproval: string[];
  /** True when an update is signed by a different key than the installed copy. */
  keyRotation: boolean;
  permissions: Array<{
    capability: AddonCapability;
    title: string;
    disclosure: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
    isNew: boolean;
    persistentGrantAllowed: boolean;
  }>;
}

export function createAddonInstallReview(options: {
  manifest: AddonManifest;
  signatureStatus: AddonSignatureStatus;
  developerMode: boolean;
  previouslyDeclared?: readonly AddonCapability[];
  /** Set when this is an update: the key the installed copy was signed with. */
  previousKeyId?: string;
  /** The key this package is signed with, when it is signed. */
  keyId?: string;
}): AddonInstallReview {
  const blockers: string[] = [];
  if (options.signatureStatus === 'invalid')
    blockers.push('The addon signature is invalid.');
  if (options.signatureStatus === 'unsigned' && !options.developerMode)
    blockers.push('Unsigned addons require Developer Mode.');

  const requiresApproval: string[] = [];

  // A signature proves continuity, not safety: it says this package came from
  // whoever signed the last one. A *different* key on an update breaks exactly
  // that, which is what taking over an addon looks like, so it is the one
  // thing that must never pass quietly.
  const keyRotation =
    options.previousKeyId !== undefined &&
    options.keyId !== undefined &&
    options.previousKeyId !== options.keyId;
  if (keyRotation)
    requiresApproval.push(
      'This update is signed with a different key than the version you have. ' +
        'Only continue if you expected the author to change their signing key.',
    );

  // Losing a signature on update is the same continuity break, read the other
  // way round.
  if (
    options.previousKeyId !== undefined &&
    options.signatureStatus === 'unsigned'
  )
    requiresApproval.push(
      'The version you have is signed and this update is not.',
    );

  const previous = new Set(options.previouslyDeclared ?? []);
  const newPermissions = options.manifest.permissions.filter(
    capability => !previous.has(capability),
  );
  if (options.previouslyDeclared !== undefined && newPermissions.length > 0)
    requiresApproval.push(
      `This update asks for ${newPermissions.length} permission(s) the installed version did not.`,
    );

  return {
    manifest: options.manifest,
    signatureStatus: options.signatureStatus,
    canInstall: blockers.length === 0,
    blockers,
    requiresApproval,
    keyRotation,
    permissions: options.manifest.permissions.map(capability => ({
      capability,
      ...ADDON_CAPABILITY_DEFINITIONS[capability],
      isNew: !previous.has(capability),
    })),
  };
}
