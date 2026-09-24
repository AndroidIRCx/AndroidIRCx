/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddonGroupService } from '../../src/services/scripting/AddonGroupService';
import { AddonUIRegistry } from '../../src/services/scripting/AddonUIRegistry';
import { AddonScheduler } from '../../src/services/scripting/AddonScheduler';
import { installAddonGroupWiring } from '../../src/services/scripting/AddonGroupWiring';

const ADDON = 'ui.addon';

const manifest = {
  id: ADDON,
  name: 'UI',
  author: 'Test',
  version: '1.0.0',
  description: 'Test',
  license: 'MIT',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'index.js',
  permissions: ['ui.extend'],
} as any;

const menu = (id: string) => ({
  id,
  target: 'nick',
  items: [{ id: 'act', label: 'Act' }],
});

function harness() {
  const groups = new AddonGroupService();
  const ui = new AddonUIRegistry(
    {
      initialize: jest.fn(async () => undefined),
      get: jest.fn(() => ({ manifest })),
    } as any,
    {
      initialize: jest.fn(async () => undefined),
      requireGrant: jest.fn(),
    } as any,
  );
  const scheduler = new AddonScheduler();
  const uninstall = installAddonGroupWiring({ groups, ui, scheduler });
  return { groups, ui, scheduler, uninstall };
}

describe('addon group wiring', () => {
  beforeEach(() => (AsyncStorage as any).__reset?.());

  it('removes only the contributions the switched-off group registered', async () => {
    const h = harness();
    await h.ui.registerMenu(ADDON, menu('shared.menu'));
    await h.ui.registerMenu(ADDON, menu('group.menu'), 'extras');
    await h.ui.registerPanel(
      ADDON,
      'group.panel',
      'Panel',
      [{ kind: 'text', text: 'x' }],
      'extras',
    );

    await h.groups.setEnabled(ADDON, 'extras', true);
    await h.groups.setEnabled(ADDON, 'extras', false);

    // Clearing the whole addon would take the rest of it down with the one
    // feature the user turned off.
    expect(h.ui.menusFor('nick').map(entry => entry.menu.id)).toEqual([
      'shared.menu',
    ]);
    expect(h.ui.panels()).toHaveLength(0);
  });

  it('leaves another group alone', async () => {
    const h = harness();
    await h.ui.registerMenu(ADDON, menu('a.menu'), 'alpha');
    await h.ui.registerMenu(ADDON, menu('b.menu'), 'beta');

    await h.groups.setEnabled(ADDON, 'alpha', true);
    await h.groups.setEnabled(ADDON, 'alpha', false);

    expect(h.ui.menusFor('nick').map(entry => entry.menu.id)).toEqual([
      'b.menu',
    ]);
  });

  it('leaves another addon alone', async () => {
    const h = harness();
    await h.ui.registerMenu(ADDON, menu('mine'), 'extras');

    await h.groups.setEnabled('other.addon', 'extras', true);
    await h.groups.setEnabled('other.addon', 'extras', false);

    expect(h.ui.menusFor('nick')).toHaveLength(1);
  });

  it('cancels scheduled jobs named after the group', async () => {
    const h = harness();
    await h.scheduler.schedule(ADDON, { id: 'extras', kind: 'connect' });
    await h.scheduler.schedule(ADDON, { id: 'extras.sweep', kind: 'connect' });
    await h.scheduler.schedule(ADDON, { id: 'unrelated', kind: 'connect' });

    await h.groups.setEnabled(ADDON, 'extras', true);
    await h.groups.setEnabled(ADDON, 'extras', false);

    // A job that outlives its group is visible in the manager; one silently
    // cancelled is not, so the convention errs towards keeping it.
    expect(h.scheduler.list(ADDON).map(job => job.id)).toEqual(['unrelated']);
  });

  it('does nothing when a group is switched on', async () => {
    const h = harness();
    await h.ui.registerMenu(ADDON, menu('group.menu'), 'extras');
    await h.groups.setEnabled(ADDON, 'extras', true);
    expect(h.ui.menusFor('nick')).toHaveLength(1);
  });

  it('stops acting once the wiring is uninstalled', async () => {
    const h = harness();
    await h.ui.registerMenu(ADDON, menu('group.menu'), 'extras');
    h.uninstall();

    await h.groups.setEnabled(ADDON, 'extras', true);
    await h.groups.setEnabled(ADDON, 'extras', false);

    expect(h.ui.menusFor('nick')).toHaveLength(1);
  });

  it('is a no-op for an addon that contributed nothing', async () => {
    const h = harness();
    await expect(
      h.groups.setEnabled('nobody', 'extras', false),
    ).resolves.toBeUndefined();
  });
});
