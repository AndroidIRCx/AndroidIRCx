/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  allConfigs,
  getAllServiceNicks,
  getConfig,
  getServiceTypeByNick,
  ircdConfigs,
  isServiceNick,
  serviceConfigs,
} from '../../src/config/services';

describe('config/services index', () => {
  it('returns service configs by known type', () => {
    const config = getConfig('anope');

    expect(config).toBeDefined();
    expect(config?.serviceType).toBe('anope');
  });

  it('returns ircd configs case-insensitively', () => {
    const config = getConfig('UnrealIRCd');

    expect(config).toBeDefined();
    expect(config?.ircdType).toBe('unrealircd');
  });

  it('returns undefined for unknown config type', () => {
    expect(getConfig('does-not-exist')).toBeUndefined();
  });

  it('exposes all service and ircd configs through allConfigs', () => {
    expect(allConfigs.anope).toBe(serviceConfigs.anope);
    expect(allConfigs.unrealircd).toBe(ircdConfigs.unrealircd);
  });

  it('collects unique service nicknames in lowercase', () => {
    const nicks = getAllServiceNicks();

    expect(nicks).toContain('nickserv');
    expect(nicks).toContain('chanserv');
    expect(nicks).toContain('x');
    expect(nicks).toContain('q');
    expect(new Set(nicks).size).toBe(nicks.length);
  });

  it('identifies known service nicknames', () => {
    expect(isServiceNick('NickServ')).toBe(true);
    expect(isServiceNick('x')).toBe(true);
    expect(isServiceNick('not-a-service')).toBe(false);
  });

  it('resolves service type by nickname', () => {
    expect(getServiceTypeByNick('NickServ')).toBe('anope');
    expect(getServiceTypeByNick('X')).toBe('undernet');
    expect(getServiceTypeByNick('Q')).toBe('quakenet');
    expect(getServiceTypeByNick('unknown')).toBeUndefined();
  });

  it('includes aliases when service configs provide them', () => {
    const originalNickServ = serviceConfigs.anope.services.nickserv as any;
    const patchedNickServ = { ...originalNickServ, aliases: ['NSAlias'] };

    (serviceConfigs.anope.services as any).nickserv = patchedNickServ;
    (allConfigs.anope.services as any).nickserv = patchedNickServ;

    try {
      expect(getAllServiceNicks()).toContain('nsalias');
      expect(isServiceNick('NSAlias')).toBe(true);
      expect(getServiceTypeByNick('NSAlias')).toBe('anope');
    } finally {
      (serviceConfigs.anope.services as any).nickserv = originalNickServ;
      (allConfigs.anope.services as any).nickserv = originalNickServ;
    }
  });
});
