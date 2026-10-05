/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  ipv4FromHost,
  isPrivateHost,
  parseHttpUrl,
} from '../../src/utils/safeUrl';

// The URL class a device actually has. Jest's global URL is Node's, which is
// why the old checks passed here and failed on a phone.
const { URL: ReactNativeURL } = jest.requireActual(
  'react-native/Libraries/Blob/URL',
);

const SMUGGLED = [
  'https://evil.example/c?d=SECRET&x=@github.com',
  'http://192.168.1.1/admin@github.com/',
  'http://127.0.0.1:8080/@github.com/',
  'http://169.254.169.254/latest/meta-data/?a=@raw.githubusercontent.com',
];

describe('parseHttpUrl', () => {
  it('shows why React Native URL could not be trusted', () => {
    // Every one of these reads as an allowed host to RN's URL…
    for (const url of SMUGGLED) {
      expect(new ReactNativeURL(url).hostname).toMatch(/github/);
    }
  });

  it('reads the host the request really goes to', () => {
    expect(SMUGGLED.map(url => parseHttpUrl(url)?.hostname)).toEqual([
      'evil.example',
      '192.168.1.1',
      '127.0.0.1',
      '169.254.169.254',
    ]);
  });

  it('refuses userinfo outright', () => {
    expect(parseHttpUrl('https://user:pw@github.com/')).toBeNull();
    expect(parseHttpUrl('https://github.com@evil.example/')).toBeNull();
  });

  it('reads an ordinary URL and rebuilds it', () => {
    expect(
      parseHttpUrl('HTTPS://GitHub.com./AndroidIRCx/AndroidIRCx?a=1#x'),
    ).toEqual({
      protocol: 'https:',
      hostname: 'github.com',
      port: '',
      rest: '/AndroidIRCx/AndroidIRCx?a=1#x',
      href: 'https://github.com/AndroidIRCx/AndroidIRCx?a=1#x',
    });
    expect(parseHttpUrl('http://example.com:8080')?.href).toBe(
      'http://example.com:8080/',
    );
    expect(parseHttpUrl('https://example.com?q=1')?.rest).toBe('/?q=1');
  });

  it('reads IPv6 literals without their brackets', () => {
    expect(parseHttpUrl('http://[::1]:3000/x')).toMatchObject({
      hostname: '::1',
      port: '3000',
      href: 'http://[::1]:3000/x',
    });
  });

  it.each([
    ['not a string', 42],
    ['empty', ''],
    ['another scheme', 'ftp://example.com/'],
    // eslint-disable-next-line no-script-url -- refusing it is the point
    ['javascript', 'javascript:alert(1)'],
    ['no host', 'https:///path'],
    ['a backslash', 'https://example.com\\@evil.com/'],
    ['whitespace inside', 'https://exa mple.com/'],
    ['a control character', 'https://example.com/\u0000'],
    ['a non-ASCII host', 'https://gіthub.com/'],
    ['a bad port', 'https://example.com:99999/'],
    ['port zero', 'https://example.com:0/'],
    ['a letter port', 'https://example.com:http/'],
    ['an unclosed bracket', 'http://[::1/'],
    ['junk after a bracket', 'http://[::1]x/'],
    ['a bracketed name', 'http://[example.com]/'],
    ['an empty label', 'https://a..b/'],
    ['far too long', `https://example.com/${'a'.repeat(9000)}`],
  ])('refuses %s', (_label, value) => {
    expect(parseHttpUrl(value)).toBeNull();
  });
});

describe('ipv4FromHost', () => {
  it.each([
    ['127.0.0.1', [127, 0, 0, 1]],
    ['2130706433', [127, 0, 0, 1]],
    ['0x7f000001', [127, 0, 0, 1]],
    ['0177.0.0.1', [127, 0, 0, 1]],
    ['127.1', [127, 0, 0, 1]],
    ['10.0x10.1', [10, 16, 0, 1]],
    ['0x', [0, 0, 0, 0]],
  ])('reads %s', (host, bytes) => {
    expect(ipv4FromHost(host)).toEqual(bytes);
  });

  it.each(['github.com', '1.2.3.4.5', '256.1.1.1', '1.2.3.4294967296', '09'])(
    'treats %s as not an address',
    host => {
      expect(ipv4FromHost(host)).toBeNull();
    },
  );
});

describe('isPrivateHost', () => {
  it.each([
    '',
    'localhost',
    'LOCALHOST.',
    'printer.local',
    'router.lan',
    'nas.home.arpa',
    'metadata.google.internal',
    'x.localhost',
    '127.0.0.1',
    '127.255.0.9',
    '2130706433',
    '0x7f000001',
    '0177.0.0.1',
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '100.127.255.255',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '[::1]',
    '0:0:0:0:0:0:0:1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    'not:an:address:zz',
  ])('refuses %s', host => {
    expect(isPrivateHost(host)).toBe(true);
  });

  it.each([
    'github.com',
    '8.8.8.8',
    '100.63.255.255',
    '100.128.0.1',
    '172.15.0.1',
    '172.32.0.1',
    '2001:4860:4860::8888',
    '::ffff:8.8.8.8',
    '64:ff9b::808:808',
  ])('allows the public %s', host => {
    expect(isPrivateHost(host)).toBe(false);
  });

  it('refuses an IPv6 address it cannot read', () => {
    expect(isPrivateHost('1:2:3')).toBe(true);
    expect(isPrivateHost('1::2::3')).toBe(true);
    expect(isPrivateHost('::ffff:1.2.3')).toBe(true);
  });
});
