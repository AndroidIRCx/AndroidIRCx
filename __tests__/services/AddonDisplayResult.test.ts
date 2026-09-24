/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { parseAddonDisplayResult } from '../../src/services/scripting/AddonDisplayResult';

describe('AddonDisplayResult', () => {
  it('accepts bounded semantic display instructions', () => {
    expect(
      parseAddonDisplayResult(
        JSON.stringify({
          display: 'hide',
          replacement: 'local replacement',
          style: { role: 'warning', bold: true },
          routeTo: { kind: 'channel', target: '#audit', network: 'libera' },
          stopPropagation: true,
        }),
      ),
    ).toEqual({
      display: 'hide',
      replacement: 'local replacement',
      style: {
        role: 'warning',
        bold: true,
        italic: undefined,
        underline: undefined,
      },
      routeTo: { kind: 'channel', target: '#audit', network: 'libera' },
      stopPropagation: true,
    });
  });

  it('maps the L1 hideDefault compatibility field to display hide', () => {
    expect(parseAddonDisplayResult('{"hideDefault":true}')).toEqual({
      display: 'hide',
      replacement: undefined,
      style: undefined,
      routeTo: undefined,
      stopPropagation: undefined,
    });
  });

  it.each([
    '{"unknown":true}',
    '{"display":"remove"}',
    '{"replacement":3}',
    '{"style":{"role":"#ff0000"}}',
    '{"style":{"role":"warning"}}',
    '{"routeTo":{"kind":"server"}}',
    '{"routeTo":{"kind":"channel"}}',
    '{"stopPropagation":"yes"}',
  ])('rejects unsafe or malformed output: %s', value => {
    expect(() => parseAddonDisplayResult(value)).toThrow();
  });
});
