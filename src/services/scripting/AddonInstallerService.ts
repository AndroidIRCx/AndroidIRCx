import {
  createAddonInstallReview,
  type AddonInstallReview,
} from './AddonInstallReview';
import { readAddonPackage, type ReadAddonPackage } from './AddonPackageReader';
import {
  addonPackageStore,
  type AddonPackageStore,
  type InstalledAddonPackage,
} from './AddonPackageStore';
import { addonPermissionService } from './AddonPermissionService';
import { addonConfigStore } from './AddonConfigStore';

export interface AddonInstallPermissionBoundary {
  reconcileDeclared(
    addonId: string,
    declared: ReadAddonPackage['manifest']['permissions'],
  ): Promise<void>;
}

export interface AddonInstallConfigBoundary {
  snapshot(addonId: string, checksum: string): Promise<void>;
}

export interface PreparedAddonInstall {
  readonly review: AddonInstallReview;
  readonly checksumSha256: string;
}

interface InternalPreparedAddonInstall extends PreparedAddonInstall {
  readonly packageBytes: Uint8Array;
  readonly verified: ReadAddonPackage;
  consumed: boolean;
}

export class AddonInstallBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddonInstallBlockedError';
  }
}

/** Separates untrusted package parsing/review from explicit installation. */
export class AddonInstallerService {
  constructor(
    private readonly packages: AddonPackageStore = addonPackageStore,
    private readonly permissions: AddonInstallPermissionBoundary = addonPermissionService,
    private readonly config: AddonInstallConfigBoundary = addonConfigStore,
  ) {}

  async prepare(
    packageBytes: Uint8Array,
    options: {
      developerMode: boolean;
      knownKeys?: ReadonlyMap<string, string>;
    },
  ): Promise<PreparedAddonInstall> {
    await this.packages.initialize();
    const ownedBytes = packageBytes.slice();
    const verified = readAddonPackage(ownedBytes, options.knownKeys);
    const previous = this.packages.get(verified.manifest.id);
    const review = createAddonInstallReview({
      manifest: verified.manifest,
      signatureStatus: verified.signature.status,
      developerMode: options.developerMode,
      previouslyDeclared: previous?.manifest.permissions,
    });
    const prepared: InternalPreparedAddonInstall = {
      review,
      checksumSha256: verified.checksumSha256,
      packageBytes: ownedBytes,
      verified,
      consumed: false,
    };
    return prepared;
  }

  async confirm(
    prepared: PreparedAddonInstall,
  ): Promise<InstalledAddonPackage> {
    const internal = prepared as InternalPreparedAddonInstall;
    if (
      !internal.verified ||
      !internal.packageBytes ||
      internal.checksumSha256 !== internal.verified.checksumSha256
    )
      throw new AddonInstallBlockedError('Invalid addon install session.');
    if (internal.consumed)
      throw new AddonInstallBlockedError(
        'This addon install session has already been used.',
      );
    if (!internal.review.canInstall)
      throw new AddonInstallBlockedError(
        internal.review.blockers.join(' ') || 'Addon installation is blocked.',
      );

    internal.consumed = true;
    const previous = this.packages.get(internal.verified.manifest.id);
    try {
      if (previous)
        await this.config.snapshot(
          previous.manifest.id,
          previous.activeChecksum,
        );
      const installed = await this.packages.install(
        internal.verified,
        internal.packageBytes,
      );
      if (previous) {
        try {
          await this.permissions.reconcileDeclared(
            installed.manifest.id,
            installed.manifest.permissions,
          );
        } catch (error) {
          await this.packages.rollback(installed.manifest.id);
          throw error;
        }
      }
      return installed;
    } catch (error) {
      // A storage failure may be retried after the underlying issue is fixed.
      internal.consumed = false;
      throw error;
    }
  }
}

export const addonInstallerService = new AddonInstallerService();
