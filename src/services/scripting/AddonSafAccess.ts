/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The only way an addon reaches a file outside its own workspace: the user
 * picks it, through Android's own document picker.
 *
 * The addon never supplies a path. It asks for a picker, the user chooses, and
 * the addon receives a URI it did not name. A one-off grant dies with the call;
 * a persisted one is listed in addon settings with the file it refers to, and
 * revoking it there makes every later read fail — which is the difference
 * between "the user allowed this once" and "the user forgot they allowed it".
 */

const STORAGE_KEY = '@AndroidIRCX:addonSafGrants:v1';

export const MAX_PERSISTED_GRANTS_PER_ADDON = 10;
export const MAX_READ_BYTES = 8 * 1024 * 1024;

export type SafAccessFailure =
  | 'cancelled'
  | 'not-granted'
  | 'revoked'
  | 'too-large'
  | 'wrong-type'
  | 'io-error';

export interface SafGrant {
  addonId: string;
  uri: string;
  /** What the user saw when they chose it, so settings can show them. */
  displayName: string;
  mimeType?: string;
  size?: number;
  mode: 'read' | 'readwrite';
  grantedAt: number;
  /** False for a one-off grant, which is not written to storage at all. */
  persisted: boolean;
}

export interface SafResult<T = void> {
  ok: boolean;
  value?: T;
  reason?: SafAccessFailure;
}

export interface PickedDocument {
  uri: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
}

interface PickerBoundary {
  pickDocument(options: {
    types?: string[];
    multiple?: boolean;
  }): Promise<PickedDocument[]>;
}

interface ReaderBoundary {
  read(uri: string): Promise<string>;
  write(uri: string, contents: string): Promise<void>;
}

export class AddonSafAccess {
  private grants = new Map<string, SafGrant>();
  private loaded = false;

  constructor(
    private readonly picker: PickerBoundary,
    private readonly reader: ReaderBoundary,
  ) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      for (const grant of JSON.parse(raw ?? '[]') as SafGrant[])
        if (grant?.uri && grant.addonId && grant.persisted)
          this.grants.set(this.key(grant.addonId, grant.uri), { ...grant });
    } catch {
      // Unreadable grants are treated as no grants: failing closed here costs
      // the user one more tap, and failing open costs them a file.
      this.grants.clear();
    }
  }

  /**
   * Ask the user to choose a file for this addon.
   *
   * `persist` only records the choice; it does not widen it. The addon still
   * receives exactly the URI the user picked and nothing around it.
   */
  async requestDocument(
    addonId: string,
    options: { types?: string[]; persist?: boolean } = {},
  ): Promise<SafResult<SafGrant>> {
    let picked: PickedDocument[];
    try {
      picked = await this.picker.pickDocument({
        types: options.types,
        multiple: false,
      });
    } catch {
      // A cancelled picker is a normal answer, not an error to report.
      return { ok: false, reason: 'cancelled' };
    }
    const [document] = picked ?? [];
    if (!document?.uri) return { ok: false, reason: 'cancelled' };

    const persist = options.persist === true;
    if (
      persist &&
      this.listFor(addonId).length >= MAX_PERSISTED_GRANTS_PER_ADDON
    )
      return { ok: false, reason: 'not-granted' };

    const grant: SafGrant = {
      addonId,
      uri: document.uri,
      displayName: document.name ?? 'Selected file',
      mimeType: document.type ?? undefined,
      size: document.size ?? undefined,
      mode: 'read',
      grantedAt: Date.now(),
      persisted: persist,
    };
    this.grants.set(this.key(addonId, document.uri), grant);
    if (persist) await this.persist();
    return { ok: true, value: grant };
  }

  /**
   * Read a granted document.
   *
   * Size and type are checked before the read, not after: a file large enough
   * to matter should not be pulled into JS memory to discover it was too large.
   */
  async readDocument(
    addonId: string,
    uri: string,
    expectedTypes?: string[],
  ): Promise<SafResult<string>> {
    const grant = this.grants.get(this.key(addonId, uri));
    if (!grant) return { ok: false, reason: 'not-granted' };
    if (grant.size !== undefined && grant.size > MAX_READ_BYTES)
      return { ok: false, reason: 'too-large' };
    if (
      expectedTypes?.length &&
      grant.mimeType &&
      !expectedTypes.includes(grant.mimeType)
    )
      return { ok: false, reason: 'wrong-type' };

    try {
      const contents = await this.reader.read(uri);
      if (contents.length > MAX_READ_BYTES)
        return { ok: false, reason: 'too-large' };
      return { ok: true, value: contents };
    } catch {
      // A revoked SAF permission surfaces as a read failure, which is the only
      // signal Android gives. Reported as revoked so the UI can offer to ask
      // again rather than showing an unexplained error.
      return { ok: false, reason: 'revoked' };
    }
  }

  async writeDocument(
    addonId: string,
    uri: string,
    contents: string,
  ): Promise<SafResult> {
    const grant = this.grants.get(this.key(addonId, uri));
    if (!grant || grant.mode !== 'readwrite')
      return { ok: false, reason: 'not-granted' };
    if (contents.length > MAX_READ_BYTES)
      return { ok: false, reason: 'too-large' };
    try {
      await this.reader.write(uri, contents);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'revoked' };
    }
  }

  /** What addon settings lists, so a grant can be seen and taken back. */
  listFor(addonId: string): SafGrant[] {
    return [...this.grants.values()]
      .filter(grant => grant.addonId === addonId && grant.persisted)
      .map(grant => ({ ...grant }));
  }

  async revoke(addonId: string, uri: string): Promise<boolean> {
    const removed = this.grants.delete(this.key(addonId, uri));
    if (removed) await this.persist();
    return removed;
  }

  async revokeAll(addonId: string): Promise<void> {
    for (const [key, grant] of [...this.grants])
      if (grant.addonId === addonId) this.grants.delete(key);
    await this.persist();
  }

  resetForTests(): void {
    this.grants.clear();
    this.loaded = false;
  }

  private key(addonId: string, uri: string): string {
    return `${addonId}\u0000${uri}`;
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        // One-off grants are never written: they exist for one call and
        // outliving it would be exactly the surprise this design avoids.
        JSON.stringify([...this.grants.values()].filter(g => g.persisted)),
      );
    } catch {
      // The in-session grant still works; it simply will not survive a restart.
    }
  }
}
