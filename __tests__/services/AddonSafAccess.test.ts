/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AddonSafAccess,
  MAX_PERSISTED_GRANTS_PER_ADDON,
  MAX_READ_BYTES,
} from '../../src/services/scripting/AddonSafAccess';

const ADDON = 'saf.addon';

function harness() {
  const pickDocument = jest.fn(async () => [
    { uri: 'content://doc/1', name: 'notes.txt', type: 'text/plain', size: 10 },
  ]);
  const read = jest.fn(async () => 'file contents');
  const write = jest.fn(async () => undefined);
  const saf = new AddonSafAccess({ pickDocument } as any, { read, write });
  return { saf, pickDocument, read, write };
}

describe('AddonSafAccess', () => {
  beforeEach(() => (AsyncStorage as any).__reset?.());

  describe('requesting a document', () => {
    it('gives the addon the URI the user chose', async () => {
      const h = harness();
      const result = await h.saf.requestDocument(ADDON);

      // The addon never supplies a path; it receives one it did not name.
      expect(result.value).toMatchObject({
        uri: 'content://doc/1',
        displayName: 'notes.txt',
        mimeType: 'text/plain',
        persisted: false,
      });
    });

    it('reports a cancelled picker as a normal answer', async () => {
      const h = harness();
      h.pickDocument.mockResolvedValueOnce([]);
      expect(await h.saf.requestDocument(ADDON)).toEqual({
        ok: false,
        reason: 'cancelled',
      });

      h.pickDocument.mockRejectedValueOnce(new Error('user cancelled'));
      expect((await h.saf.requestDocument(ADDON)).reason).toBe('cancelled');
    });

    it('bounds how many grants one addon may persist', async () => {
      const h = harness();
      for (let index = 0; index < MAX_PERSISTED_GRANTS_PER_ADDON; index += 1) {
        h.pickDocument.mockResolvedValueOnce([
          {
            uri: `content://doc/${index}`,
            name: 'f',
            type: 'text/plain',
            size: 1,
          },
        ]);
        await h.saf.requestDocument(ADDON, { persist: true });
      }
      expect(
        (await h.saf.requestDocument(ADDON, { persist: true })).reason,
      ).toBe('not-granted');
    });
  });

  describe('reading', () => {
    it('reads a granted document', async () => {
      const h = harness();
      await h.saf.requestDocument(ADDON);
      expect(await h.saf.readDocument(ADDON, 'content://doc/1')).toEqual({
        ok: true,
        value: 'file contents',
      });
    });

    it('refuses a URI the addon was never granted', async () => {
      const h = harness();
      // Guessing a content URI must not work.
      expect(await h.saf.readDocument(ADDON, 'content://doc/other')).toEqual({
        ok: false,
        reason: 'not-granted',
      });
      expect(h.read).not.toHaveBeenCalled();
    });

    it('keeps one addon out of another addon grant', async () => {
      const h = harness();
      await h.saf.requestDocument(ADDON);
      expect(
        (await h.saf.readDocument('other.addon', 'content://doc/1')).reason,
      ).toBe('not-granted');
    });

    it('checks size before reading, not after', async () => {
      const h = harness();
      h.pickDocument.mockResolvedValueOnce([
        {
          uri: 'content://big',
          name: 'big',
          type: 'text/plain',
          size: MAX_READ_BYTES + 1,
        },
      ]);
      await h.saf.requestDocument(ADDON);

      expect(await h.saf.readDocument(ADDON, 'content://big')).toEqual({
        ok: false,
        reason: 'too-large',
      });
      // A file large enough to matter is not pulled into JS memory to find out.
      expect(h.read).not.toHaveBeenCalled();
    });

    it('refuses a type the caller did not expect', async () => {
      const h = harness();
      await h.saf.requestDocument(ADDON);
      expect(
        (
          await h.saf.readDocument(ADDON, 'content://doc/1', [
            'application/json',
          ])
        ).reason,
      ).toBe('wrong-type');
      expect(
        (await h.saf.readDocument(ADDON, 'content://doc/1', ['text/plain'])).ok,
      ).toBe(true);
    });

    it('reports a revoked permission as revoked, not as an unexplained error', async () => {
      const h = harness();
      await h.saf.requestDocument(ADDON);
      h.read.mockRejectedValueOnce(new Error('EACCES'));

      // A revoked SAF permission surfaces only as a read failure; naming it
      // lets the UI offer to ask again.
      expect((await h.saf.readDocument(ADDON, 'content://doc/1')).reason).toBe(
        'revoked',
      );
    });
  });

  describe('writing', () => {
    it('refuses to write through a read-only grant', async () => {
      const h = harness();
      await h.saf.requestDocument(ADDON);
      expect(
        await h.saf.writeDocument(ADDON, 'content://doc/1', 'new'),
      ).toEqual({ ok: false, reason: 'not-granted' });
      expect(h.write).not.toHaveBeenCalled();
    });
  });

  describe('revoking', () => {
    it('makes every later read fail', async () => {
      const h = harness();
      await h.saf.requestDocument(ADDON, { persist: true });
      expect((await h.saf.readDocument(ADDON, 'content://doc/1')).ok).toBe(
        true,
      );

      expect(await h.saf.revoke(ADDON, 'content://doc/1')).toBe(true);

      // The difference between "allowed once" and "forgot they allowed it".
      expect((await h.saf.readDocument(ADDON, 'content://doc/1')).reason).toBe(
        'not-granted',
      );
      expect(await h.saf.revoke(ADDON, 'content://doc/1')).toBe(false);
    });

    it('revokes everything for one addon and leaves others alone', async () => {
      const h = harness();
      await h.saf.requestDocument(ADDON, { persist: true });
      h.pickDocument.mockResolvedValueOnce([
        { uri: 'content://doc/2', name: 'f', type: 'text/plain', size: 1 },
      ]);
      await h.saf.requestDocument('other.addon', { persist: true });

      await h.saf.revokeAll(ADDON);
      expect(h.saf.listFor(ADDON)).toEqual([]);
      expect(h.saf.listFor('other.addon')).toHaveLength(1);
    });
  });

  describe('persistence', () => {
    it('lists persisted grants with what the user saw', async () => {
      const h = harness();
      await h.saf.requestDocument(ADDON, { persist: true });

      // Settings has to show the file, not just an opaque URI.
      expect(h.saf.listFor(ADDON)).toEqual([
        expect.objectContaining({
          uri: 'content://doc/1',
          displayName: 'notes.txt',
          persisted: true,
        }),
      ]);
    });

    it('never writes a one-off grant, and does not list it', async () => {
      const h = harness();
      await h.saf.requestDocument(ADDON);

      expect(h.saf.listFor(ADDON)).toEqual([]);
      const reloaded = new AddonSafAccess({} as any, {} as any);
      await reloaded.load();
      expect(reloaded.listFor(ADDON)).toEqual([]);
    });

    it('restores persisted grants across a restart', async () => {
      const h = harness();
      await h.saf.requestDocument(ADDON, { persist: true });

      const reloaded = new AddonSafAccess({} as any, {
        read: jest.fn(async () => 'x'),
        write: jest.fn(),
      });
      await reloaded.load();
      expect((await reloaded.readDocument(ADDON, 'content://doc/1')).ok).toBe(
        true,
      );
    });

    it('treats unreadable stored grants as no grants', async () => {
      await AsyncStorage.setItem('@AndroidIRCX:addonSafGrants:v1', 'not json');
      const reloaded = new AddonSafAccess({} as any, {} as any);
      await reloaded.load();
      // Failing closed costs one more tap; failing open costs a file.
      expect(reloaded.listFor(ADDON)).toEqual([]);
    });
  });
});
