import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { validateAddonManifest, type AddonManifest } from './AddonManifest';
import type { ReadAddonPackage } from './AddonPackageReader';
import { readAddonPackage } from './AddonPackageReader';

const STORAGE_KEY = '@AndroidIRCX:addonPackages:v1';
const CHECKSUM = /^[0-9a-f]{64}$/;

export interface InstalledAddonPackage {
  manifest: AddonManifest;
  activeChecksum: string;
  previousManifest?: AddonManifest;
  previousChecksum?: string;
  installedAt: number;
  updatedAt: number;
}

interface StoredState {
  addons: InstalledAddonPackage[];
}

export interface AddonPackageFileStore {
  write(path: string, bytes: Uint8Array): Promise<void>;
  read(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}

export class AddonPackageStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddonPackageStoreError';
  }
}

const defaultFiles: AddonPackageFileStore = {
  async write(path, bytes) {
    await RNFS.mkdir(path.slice(0, path.lastIndexOf('/')));
    await RNFS.writeFile(path, encodeBase64(bytes), 'base64');
  },
  async read(path) {
    return decodeBase64(await RNFS.readFile(path, 'base64'));
  },
  exists: path => RNFS.exists(path),
  async remove(path) {
    if (await RNFS.exists(path)) await RNFS.unlink(path);
  },
};

/**
 * Stores immutable package blobs and atomically changes only their metadata
 * pointer. A failed update therefore leaves the last working blob selected.
 */
export class AddonPackageStore {
  private readonly addons = new Map<string, InstalledAddonPackage>();
  private initialized = false;

  constructor(
    private readonly files: AddonPackageFileStore = defaultFiles,
    private readonly root = `${RNFS.DocumentDirectoryPath}/addons`,
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) this.restore(JSON.parse(raw) as unknown);
    this.initialized = true;
  }

  list(): InstalledAddonPackage[] {
    return [...this.addons.values()].map(cloneRecord);
  }

  get(addonId: string): InstalledAddonPackage | undefined {
    const record = this.addons.get(addonId);
    return record ? cloneRecord(record) : undefined;
  }

  packagePath(addonId: string, checksum: string): string {
    if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(addonId))
      throw new AddonPackageStoreError('Invalid addon id.');
    if (!CHECKSUM.test(checksum))
      throw new AddonPackageStoreError('Invalid addon checksum.');
    return `${this.root}/${addonId}/${checksum}.ircx-addon`;
  }

  async install(
    verified: ReadAddonPackage,
    packageBytes: Uint8Array,
  ): Promise<InstalledAddonPackage> {
    await this.initialize();
    const actualChecksum = bytesToHex(sha256(packageBytes));
    if (actualChecksum !== verified.checksumSha256)
      throw new AddonPackageStoreError(
        'Package bytes do not match the verified checksum.',
      );

    const path = this.packagePath(verified.manifest.id, actualChecksum);
    if (!(await this.files.exists(path)))
      await this.files.write(path, packageBytes);

    const previous = this.addons.get(verified.manifest.id);
    const now = Date.now();
    const next: InstalledAddonPackage = {
      manifest: verified.manifest,
      activeChecksum: actualChecksum,
      previousManifest: previous?.manifest,
      previousChecksum: previous?.activeChecksum,
      installedAt: previous?.installedAt ?? now,
      updatedAt: now,
    };
    await this.persistWith(verified.manifest.id, next);
    return cloneRecord(next);
  }

  async rollback(addonId: string): Promise<InstalledAddonPackage> {
    await this.initialize();
    const current = this.addons.get(addonId);
    if (!current?.previousChecksum || !current.previousManifest)
      throw new AddonPackageStoreError(
        'No previous addon package is available.',
      );
    const previousPath = this.packagePath(addonId, current.previousChecksum);
    if (!(await this.files.exists(previousPath)))
      throw new AddonPackageStoreError('Previous addon package is missing.');

    const next: InstalledAddonPackage = {
      manifest: current.previousManifest,
      activeChecksum: current.previousChecksum,
      previousManifest: current.manifest,
      previousChecksum: current.activeChecksum,
      installedAt: current.installedAt,
      updatedAt: Date.now(),
    };
    await this.persistWith(addonId, next);
    return cloneRecord(next);
  }

  async loadActive(addonId: string): Promise<ReadAddonPackage> {
    await this.initialize();
    const current = this.addons.get(addonId);
    if (!current)
      throw new AddonPackageStoreError('Addon package is not installed.');
    const path = this.packagePath(addonId, current.activeChecksum);
    if (!(await this.files.exists(path)))
      throw new AddonPackageStoreError('Active addon package is missing.');
    const bytes = await this.files.read(path);
    const verified = readAddonPackage(bytes);
    if (
      verified.checksumSha256 !== current.activeChecksum ||
      verified.manifest.id !== addonId
    )
      throw new AddonPackageStoreError(
        'Active addon package failed integrity verification.',
      );
    return verified;
  }

  async uninstall(addonId: string): Promise<void> {
    await this.initialize();
    const current = this.addons.get(addonId);
    if (!current) return;
    const next = new Map(this.addons);
    next.delete(addonId);
    await this.persist(next);
    this.addons.delete(addonId);

    const checksums = new Set(
      [current.activeChecksum, current.previousChecksum].filter(
        (value): value is string => !!value,
      ),
    );
    await Promise.all(
      [...checksums].map(checksum =>
        this.files.remove(this.packagePath(addonId, checksum)),
      ),
    );
  }

  private async persistWith(
    addonId: string,
    record: InstalledAddonPackage,
  ): Promise<void> {
    const next = new Map(this.addons);
    next.set(addonId, record);
    await this.persist(next);
    this.addons.set(addonId, record);
  }

  private async persist(
    addons: Map<string, InstalledAddonPackage>,
  ): Promise<void> {
    const state: StoredState = { addons: [...addons.values()] };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  private restore(value: unknown): void {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new AddonPackageStoreError('Addon package registry is corrupt.');
    const records = (value as Partial<StoredState>).addons;
    if (!Array.isArray(records))
      throw new AddonPackageStoreError('Addon package registry is corrupt.');

    const restored = new Map<string, InstalledAddonPackage>();
    for (const record of records) {
      if (!isValidRecord(record) || restored.has(record.manifest.id))
        throw new AddonPackageStoreError('Addon package registry is corrupt.');
      restored.set(record.manifest.id, cloneRecord(record));
    }
    this.addons.clear();
    restored.forEach((record, id) => this.addons.set(id, record));
  }
}

function isValidRecord(value: unknown): value is InstalledAddonPackage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<InstalledAddonPackage>;
  const manifest = validateAddonManifest(record.manifest);
  const previousManifest = record.previousManifest
    ? validateAddonManifest(record.previousManifest)
    : undefined;
  return (
    manifest.ok &&
    CHECKSUM.test(record.activeChecksum ?? '') &&
    ((record.previousChecksum === undefined &&
      record.previousManifest === undefined) ||
      (CHECKSUM.test(record.previousChecksum ?? '') &&
        previousManifest?.ok === true &&
        previousManifest.manifest.id === manifest.manifest.id)) &&
    Number.isFinite(record.installedAt) &&
    Number.isFinite(record.updatedAt)
  );
}

function cloneRecord(record: InstalledAddonPackage): InstalledAddonPackage {
  return {
    ...record,
    manifest: {
      ...record.manifest,
      permissions: [...record.manifest.permissions],
    },
    previousManifest: record.previousManifest
      ? {
          ...record.previousManifest,
          permissions: [...record.previousManifest.permissions],
        }
      : undefined,
  };
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const hasB = index + 1 < bytes.length;
    const hasC = index + 2 < bytes.length;
    const b = hasB ? bytes[index + 1] : 0;
    const c = hasC ? bytes[index + 2] : 0;
    output += alphabet[Math.floor(a / 4)];
    output += alphabet[(a % 4) * 16 + Math.floor(b / 16)];
    output += hasB ? alphabet[(b % 16) * 4 + Math.floor(c / 64)] : '=';
    output += hasC ? alphabet[c % 64] : '=';
  }
  return output;
}

function decodeBase64(value: string): Uint8Array {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = value.replace(/\s/g, '');
  if (
    clean.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      clean,
    )
  )
    throw new AddonPackageStoreError(
      'Stored addon package is not valid base64.',
    );
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const output = new Uint8Array((clean.length / 4) * 3 - padding);
  let offset = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = alphabet.indexOf(clean[index]);
    const b = alphabet.indexOf(clean[index + 1]);
    const c = clean[index + 2] === '=' ? 0 : alphabet.indexOf(clean[index + 2]);
    const d = clean[index + 3] === '=' ? 0 : alphabet.indexOf(clean[index + 3]);
    if (offset < output.length) output[offset++] = a * 4 + Math.floor(b / 16);
    if (offset < output.length)
      output[offset++] = (b % 16) * 16 + Math.floor(c / 4);
    if (offset < output.length) output[offset++] = (c % 4) * 64 + d;
  }
  return output;
}

export const addonPackageStore = new AddonPackageStore();
