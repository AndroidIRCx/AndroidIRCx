/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import RNFS from 'react-native-fs';
import {
  normalizeAddonPath,
  resolveWithinRoot,
  type PathRejection,
} from './AddonPathPolicy';

/**
 * One app-private directory per addon — mIRC's `$read` and `/write`, with the
 * "anywhere on the disk" part taken away.
 *
 * An addon names files relative to its own workspace and can express nothing
 * else: absolute paths and traversal are refused by `AddonPathPolicy` before a
 * path reaches the filesystem, and the resulting absolute path is checked again
 * against the root. There is no API here that takes an absolute path.
 */

/** No slash, no dot-dot, nothing that changes meaning in a path. */
const SAFE_OWNER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_WORKSPACE_BYTES = 8 * 1024 * 1024;
export const MAX_FILES_PER_ADDON = 200;

export type FileFailure =
  | PathRejection
  | 'not-found'
  | 'too-large'
  | 'workspace-full'
  | 'too-many-files'
  | 'io-error';

export interface FileResult<T = void> {
  ok: boolean;
  value?: T;
  reason?: FileFailure;
}

export interface FileStat {
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: number;
}

interface FsBoundary {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  readFile(path: string, encoding: string): Promise<string>;
  writeFile(path: string, contents: string, encoding: string): Promise<void>;
  unlink(path: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
  readDir(path: string): Promise<
    Array<{
      name: string;
      path: string;
      size: number;
      mtime?: Date | null;
      isDirectory(): boolean;
      isFile(): boolean;
    }>
  >;
}

export class AddonWorkspace {
  constructor(
    private readonly fs: FsBoundary = RNFS as unknown as FsBoundary,
    private readonly baseDir: string = `${RNFS.DocumentDirectoryPath}/addon-workspaces`,
  ) {}

  /**
   * The directory an addon owns.
   *
   * The id is validated here as well as by whoever supplied it. This value
   * becomes a filesystem path, and an id containing a slash or `..` would put
   * the "workspace" anywhere on disk - which is the whole boundary gone, from
   * a caller that simply forgot to check. Callers pass ids from a manifest, a
   * script record, or a test; only one of those is validated today.
   */
  rootFor(addonId: string): string {
    if (!SAFE_OWNER_ID.test(addonId))
      throw new Error('Addon or script id is not safe for a workspace path.');
    return `${this.baseDir}/${addonId}`;
  }

  async readText(addonId: string, path: string): Promise<FileResult<string>> {
    const target = this.resolve(addonId, path);
    if (!target.ok) return { ok: false, reason: target.reason };
    try {
      if (!(await this.fs.exists(target.absolute!)))
        return { ok: false, reason: 'not-found' };
      return {
        ok: true,
        value: await this.fs.readFile(target.absolute!, 'utf8'),
      };
    } catch {
      return { ok: false, reason: 'io-error' };
    }
  }

  /**
   * Write a file, replacing it if it exists.
   *
   * Written to a neighbouring temporary name and moved into place, so a write
   * interrupted by the process dying leaves the previous file intact rather
   * than a half-written one. A partial config file an addon then fails to parse
   * on every start is the worst outcome available here.
   */
  async writeText(
    addonId: string,
    path: string,
    contents: string,
  ): Promise<FileResult> {
    const target = this.resolve(addonId, path);
    if (!target.ok) return { ok: false, reason: target.reason };
    if (typeof contents !== 'string') return { ok: false, reason: 'io-error' };

    const size = byteLength(contents);
    if (size > MAX_FILE_BYTES) return { ok: false, reason: 'too-large' };

    const quota = await this.quotaCheck(addonId, path, size);
    if (!quota.ok) return quota;

    const temporary = `${target.absolute!}.tmp-${Date.now()}`;
    try {
      await this.ensureParent(target.absolute!);
      await this.fs.writeFile(temporary, contents, 'utf8');
      await this.atomicReplace(temporary, target.absolute!);
      return { ok: true };
    } catch {
      await this.discard(temporary);
      return { ok: false, reason: 'io-error' };
    }
  }

  /**
   * Put `source` at `target`, keeping the old `target` if anything fails.
   *
   * The old file is moved aside rather than deleted first. Deleting it and then
   * failing to move the replacement into place destroys the very file the
   * temporary-write dance exists to protect - which is exactly what an earlier
   * version of this did.
   */
  private async atomicReplace(source: string, target: string): Promise<void> {
    const hadTarget = await this.fs.exists(target);
    const backup = `${target}.tmp-bak-${Date.now()}`;
    if (hadTarget) await this.fs.moveFile(target, backup);
    try {
      await this.fs.moveFile(source, target);
    } catch (error) {
      if (hadTarget) {
        try {
          await this.fs.moveFile(backup, target);
        } catch {
          // Both moves failed; the backup is still on disk under its own name
          // and is the only remaining copy, so it is deliberately not removed.
        }
      }
      throw error;
    }
    if (hadTarget) await this.discard(backup);
  }

  private async discard(path: string): Promise<void> {
    try {
      if (await this.fs.exists(path)) await this.fs.unlink(path);
    } catch {
      // A leftover temporary is hidden from listings and costs only space.
    }
  }

  async remove(addonId: string, path: string): Promise<FileResult> {
    const target = this.resolve(addonId, path);
    if (!target.ok) return { ok: false, reason: target.reason };
    try {
      if (!(await this.fs.exists(target.absolute!)))
        return { ok: false, reason: 'not-found' };
      await this.fs.unlink(target.absolute!);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'io-error' };
    }
  }

  /** Both names go through the policy: a rename must not be a way out either. */
  async rename(addonId: string, from: string, to: string): Promise<FileResult> {
    const source = this.resolve(addonId, from);
    if (!source.ok) return { ok: false, reason: source.reason };
    const destination = this.resolve(addonId, to);
    if (!destination.ok) return { ok: false, reason: destination.reason };

    try {
      if (!(await this.fs.exists(source.absolute!)))
        return { ok: false, reason: 'not-found' };
      await this.ensureParent(destination.absolute!);
      // Same protection as a write: a rename onto an existing file must not
      // lose that file if the move then fails.
      await this.atomicReplace(source.absolute!, destination.absolute!);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'io-error' };
    }
  }

  async stat(addonId: string, path: string): Promise<FileResult<FileStat>> {
    const checked = normalizeAddonPath(path);
    if (!checked.ok) return { ok: false, reason: checked.reason };
    const listing = await this.list(addonId, parentOf(checked.path!));
    if (!listing.ok) return { ok: false, reason: listing.reason };
    const found = listing.value!.find(entry => entry.path === checked.path);
    return found
      ? { ok: true, value: found }
      : { ok: false, reason: 'not-found' };
  }

  async list(addonId: string, directory = ''): Promise<FileResult<FileStat[]>> {
    const root = this.rootFor(addonId);
    let absolute = root;
    let prefix = '';
    if (directory) {
      const target = this.resolve(addonId, directory);
      if (!target.ok) return { ok: false, reason: target.reason };
      absolute = target.absolute!;
      prefix = `${normalizeAddonPath(directory).path}/`;
    }

    try {
      if (!(await this.fs.exists(absolute))) return { ok: true, value: [] };
      const entries = await this.fs.readDir(absolute);
      return {
        ok: true,
        value: entries
          // Temporary files from an interrupted write are the app's business,
          // not something an addon should see or be able to act on.
          .filter(entry => !entry.name.includes('.tmp-'))
          .map(entry => ({
            path: `${prefix}${entry.name}`,
            size: Number(entry.size) || 0,
            isDirectory: entry.isDirectory(),
            modifiedAt: entry.mtime ? entry.mtime.getTime() : 0,
          })),
      };
    } catch {
      return { ok: false, reason: 'io-error' };
    }
  }

  async usedBytes(addonId: string): Promise<number> {
    const listing = await this.list(addonId);
    if (!listing.ok) return 0;
    let total = 0;
    for (const entry of listing.value!)
      total += entry.isDirectory
        ? await this.sizeOfDirectory(addonId, entry.path)
        : entry.size;
    return total;
  }

  /** Uninstall: the whole workspace, gone. */
  async clearAddon(addonId: string): Promise<void> {
    try {
      const root = this.rootFor(addonId);
      if (await this.fs.exists(root)) await this.fs.unlink(root);
    } catch {
      // Leaving files behind is better than throwing out of an uninstall.
    }
  }

  private async sizeOfDirectory(
    addonId: string,
    directory: string,
  ): Promise<number> {
    const listing = await this.list(addonId, directory);
    if (!listing.ok) return 0;
    let total = 0;
    for (const entry of listing.value!)
      total += entry.isDirectory
        ? await this.sizeOfDirectory(addonId, entry.path)
        : entry.size;
    return total;
  }

  private async quotaCheck(
    addonId: string,
    path: string,
    incoming: number,
  ): Promise<FileResult> {
    const listing = await this.list(
      addonId,
      parentOf(normalizeAddonPath(path).path!),
    );
    const existing = listing.ok
      ? (listing.value!.find(
          entry => entry.path === normalizeAddonPath(path).path,
        )?.size ?? 0)
      : 0;

    const used = await this.usedBytes(addonId);
    if (used - existing + incoming > MAX_WORKSPACE_BYTES)
      return { ok: false, reason: 'workspace-full' };

    if (existing === 0) {
      const all = await this.list(addonId);
      if (all.ok && all.value!.length >= MAX_FILES_PER_ADDON)
        return { ok: false, reason: 'too-many-files' };
    }
    return { ok: true };
  }

  private resolve(
    addonId: string,
    path: string,
  ): { ok: boolean; absolute?: string; reason?: PathRejection } {
    return resolveWithinRoot(this.rootFor(addonId), path);
  }

  private async ensureParent(absolute: string): Promise<void> {
    const parent = absolute.slice(0, absolute.lastIndexOf('/'));
    if (parent && !(await this.fs.exists(parent))) await this.fs.mkdir(parent);
  }
}

function parentOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function byteLength(value: string): number {
  return typeof TextEncoder === 'function'
    ? new TextEncoder().encode(value).length
    : value.length;
}

export const addonWorkspace = new AddonWorkspace();
