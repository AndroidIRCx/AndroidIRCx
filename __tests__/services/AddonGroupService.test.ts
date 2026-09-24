/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddonGroupService } from '../../src/services/scripting/AddonGroupService';
import {
  validateAddonManifest,
  type AddonManifest,
} from '../../src/services/scripting/AddonManifest';

const base = {
  id: 'rs.androidircx.demo',
  name: 'Demo',
  author: 'Test',
  version: '1.0.0',
  description: 'Test addon.',
  license: 'GPL-3.0-or-later',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'main.js',
};

const manifest = (over: Partial<AddonManifest> = {}): AddonManifest =>
  ({ ...base, permissions: ['irc.read'], ...over }) as AddonManifest;

describe('addon feature groups', () => {
  describe('manifest validation', () => {
    it('accepts a well-formed group', () => {
      const result = validateAddonManifest({
        ...base,
        permissions: ['irc.read', 'irc.send'],
        groups: [
          {
            id: 'auto-reply',
            name: 'Auto reply',
            description: 'Replies when you are away.',
            permissions: ['irc.send'],
          },
        ],
      });
      expect(result.ok).toBe(true);
    });

    it('refuses a group asking for a permission the addon did not declare', () => {
      // Otherwise install review shows a shorter list than the addon can ask
      // for, which is the one thing that list has to be right about.
      const result = validateAddonManifest({
        ...base,
        permissions: ['irc.read'],
        groups: [
          {
            id: 'g',
            name: 'G',
            description: 'd',
            permissions: ['irc.moderate'],
          },
        ],
      });
      expect(result.ok).toBe(false);
      expect((result as any).errors.join()).toMatch(/did not declare/);
    });

    it.each([
      [
        'a bad id',
        { id: 'Bad Id', name: 'G', description: 'd', permissions: [] },
      ],
      ['a missing name', { id: 'g', description: 'd', permissions: [] }],
      ['missing permissions', { id: 'g', name: 'G', description: 'd' }],
    ])('refuses %s', (_label, group) => {
      const result = validateAddonManifest({
        ...base,
        permissions: ['irc.read'],
        groups: [group],
      });
      expect(result.ok).toBe(false);
    });

    it('refuses duplicate group ids', () => {
      const group = { id: 'g', name: 'G', description: 'd', permissions: [] };
      expect(
        validateAddonManifest({
          ...base,
          permissions: ['irc.read'],
          groups: [group, group],
        }).ok,
      ).toBe(false);
    });
  });

  describe('defaults at install', () => {
    let groups: AddonGroupService;

    beforeEach(() => {
      (AsyncStorage as any).__reset?.();
      groups = new AddonGroupService();
    });

    it('turns on a default group that needs no permission', async () => {
      const m = manifest({
        groups: [
          {
            id: 'formatting',
            name: 'Formatting',
            description: 'd',
            permissions: [],
            enabledByDefault: true,
          },
        ],
      });
      await groups.applyDefaults(m);
      expect(groups.isEnabled(m.id, 'formatting')).toBe(true);
    });

    it('refuses to start a permission-needing group on, whatever the manifest says', async () => {
      const m = manifest({
        permissions: ['irc.read', 'irc.send'],
        groups: [
          {
            id: 'auto-reply',
            name: 'Auto reply',
            description: 'd',
            permissions: ['irc.send'],
            enabledByDefault: true,
          },
        ],
      });
      await groups.applyDefaults(m);

      // An addon deciding on the user's behalf that its irc.send feature is on
      // at first run is exactly what this prevents.
      expect(groups.isEnabled(m.id, 'auto-reply')).toBe(false);
      expect(groups.describe(m)[0].forcedOffAtInstall).toBe(true);
    });

    it('does not re-apply defaults over a user choice', async () => {
      const m = manifest({
        groups: [
          {
            id: 'g',
            name: 'G',
            description: 'd',
            permissions: [],
            enabledByDefault: true,
          },
        ],
      });
      await groups.applyDefaults(m);
      await groups.setEnabled(m.id, 'g', false);
      await groups.applyDefaults(m);

      expect(groups.isEnabled(m.id, 'g')).toBe(false);
    });
  });

  describe('effective permissions', () => {
    let groups: AddonGroupService;

    const m = manifest({
      permissions: ['irc.read', 'irc.send', 'notifications'],
      groups: [
        {
          id: 'auto-reply',
          name: 'Auto reply',
          description: 'd',
          permissions: ['irc.send'],
        },
        {
          id: 'alerts',
          name: 'Alerts',
          description: 'd',
          permissions: ['notifications'],
        },
      ],
    });

    beforeEach(() => {
      (AsyncStorage as any).__reset?.();
      groups = new AddonGroupService();
    });

    it('drops the permissions only an off group wanted', async () => {
      expect(groups.effectivePermissions(m)).toEqual(['irc.read']);
    });

    it('restores a permission when its group is turned on', async () => {
      await groups.setEnabled(m.id, 'auto-reply', true);
      expect(groups.effectivePermissions(m).sort()).toEqual([
        'irc.read',
        'irc.send',
      ]);
    });

    it('keeps a permission that something still on also needs', async () => {
      const shared = manifest({
        permissions: ['irc.read', 'irc.send'],
        groups: [
          { id: 'a', name: 'A', description: 'd', permissions: ['irc.send'] },
          { id: 'b', name: 'B', description: 'd', permissions: ['irc.send'] },
        ],
      });
      await groups.setEnabled(shared.id, 'a', true);
      // The off group is not the only thing that wanted it.
      expect(groups.effectivePermissions(shared)).toContain('irc.send');
    });

    it('returns the plain permission list when there are no groups', () => {
      expect(groups.effectivePermissions(manifest())).toEqual(['irc.read']);
    });
  });

  describe('turning a group off', () => {
    let groups: AddonGroupService;

    beforeEach(() => {
      (AsyncStorage as any).__reset?.();
      groups = new AddonGroupService();
    });

    it('tells listeners so registrations can be removed', async () => {
      const teardown = jest.fn();
      groups.onTeardown(teardown);

      await groups.setEnabled('a.addon', 'g', true);
      expect(teardown).not.toHaveBeenCalled();

      await groups.setEnabled('a.addon', 'g', false);
      expect(teardown).toHaveBeenCalledWith('a.addon', 'g');
    });

    it('keeps telling the others when one listener throws', async () => {
      const good = jest.fn();
      groups.onTeardown(() => {
        throw new Error('boom');
      });
      groups.onTeardown(good);

      await groups.setEnabled('a.addon', 'g', true);
      await groups.setEnabled('a.addon', 'g', false);
      expect(good).toHaveBeenCalledTimes(1);
    });

    it('stops telling a listener that unsubscribed', async () => {
      const teardown = jest.fn();
      const off = groups.onTeardown(teardown);
      off();
      await groups.setEnabled('a.addon', 'g', true);
      await groups.setEnabled('a.addon', 'g', false);
      expect(teardown).not.toHaveBeenCalled();
    });
  });

  describe('persistence', () => {
    beforeEach(() => (AsyncStorage as any).__reset?.());

    it('remembers the user choice across a restart', async () => {
      const first = new AddonGroupService();
      await first.setEnabled('a.addon', 'g', true);

      const second = new AddonGroupService();
      await second.load();
      expect(second.isEnabled('a.addon', 'g')).toBe(true);
    });

    it('treats unreadable state as every optional group off', async () => {
      await AsyncStorage.setItem('@AndroidIRCX:addonGroups:v1', 'not json');
      const groups = new AddonGroupService();
      await groups.load();
      // The same answer a fresh install gives.
      expect(groups.isEnabled('a.addon', 'g')).toBe(false);
    });

    it('forgets an uninstalled addon', async () => {
      const groups = new AddonGroupService();
      await groups.setEnabled('a.addon', 'g', true);
      await groups.clearAddon('a.addon');
      expect(groups.isEnabled('a.addon', 'g')).toBe(false);
    });
  });
});
