/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  isIRCdType,
  isIRCServiceType,
  isServiceCommand,
  isServiceConfig,
} from '../../src/interfaces/ServiceTypes';

describe('ServiceTypes guards', () => {
  it('validates ServiceCommand objects', () => {
    expect(
      isServiceCommand({
        name: 'REGISTER',
        service: 'NickServ',
        description: 'Register a nickname',
        usage: 'REGISTER <password> <email>',
        parameters: [],
      }),
    ).toBe(true);

    expect(
      isServiceCommand({
        name: 'REGISTER',
        description: 'missing service and parameters',
      }),
    ).toBe(false);
  });

  it('validates ServiceConfig objects', () => {
    expect(
      isServiceConfig({
        serviceType: 'anope',
        ircdType: 'unrealircd',
        services: {},
        ircd: {},
      }),
    ).toBe(true);

    expect(
      isServiceConfig({
        serviceType: 'anope',
        services: {},
      }),
    ).toBe(false);
  });

  it('validates IRC service types', () => {
    expect(isIRCServiceType('anope')).toBe(true);
    expect(isIRCServiceType('generic')).toBe(true);
    expect(isIRCServiceType('something-else')).toBe(false);
  });

  it('validates IRCd types', () => {
    expect(isIRCdType('unrealircd')).toBe(true);
    expect(isIRCdType('unknown')).toBe(true);
    expect(isIRCdType('whatever')).toBe(false);
  });
});
