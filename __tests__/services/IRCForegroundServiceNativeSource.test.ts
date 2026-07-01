/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Static regression coverage for Android foreground-service startup crash hardening.
 */

import * as fs from 'fs';
import * as path from 'path';

const serviceSourcePath = path.join(
  __dirname,
  '..',
  '..',
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'androidircx',
  'IRCForegroundService.kt',
);

const serviceSource = fs.readFileSync(serviceSourcePath, 'utf8');

describe('IRCForegroundService native startup hardening', () => {
  it('enters foreground with the stable two-argument API before optional typed update', () => {
    const twoArgumentStart = 'startForeground(NOTIFICATION_ID, notification)';
    const typedStartMatch = serviceSource.match(
      /startForeground\(\s*NOTIFICATION_ID,\s*notification,\s*manifestType\s*\)/,
    );

    expect(serviceSource).toContain(twoArgumentStart);
    expect(typedStartMatch).not.toBeNull();
    expect(serviceSource.indexOf(twoArgumentStart)).toBeLessThan(
      typedStartMatch?.index ?? -1,
    );
  });

  it('does not stop the service when the optional typed foreground update fails', () => {
    expect(serviceSource).toContain('catch (typedStartError: Exception)');
    expect(serviceSource).toContain(
      'Foreground service already started; continuing without typed update',
    );

    const typedCatchStart = serviceSource.indexOf(
      'catch (typedStartError: Exception)',
    );
    const typedCatchEnd = serviceSource.indexOf(
      '}\n            }\n        } catch',
      typedCatchStart,
    );

    expect(typedCatchEnd).toBeGreaterThan(typedCatchStart);
    const typedCatchBody = serviceSource.slice(typedCatchStart, typedCatchEnd);

    expect(typedCatchBody).not.toContain('stopSelf()');
  });

  it('handles null or unknown restart intents by entering foreground immediately', () => {
    expect(serviceSource).toContain('else -> {');
    expect(serviceSource).toContain(
      'Service can be restarted by the system with a null/unknown intent.',
    );
    expect(serviceSource).toContain(
      'startForegroundService(lastTitle, lastText)',
    );
  });
});
