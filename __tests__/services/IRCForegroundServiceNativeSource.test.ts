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
    // The typed-start catch lives inside enterForeground(); its block ends before
    // the outer ForegroundServiceStartNotAllowedException catch.
    const typedCatchEnd = serviceSource.indexOf(
      '} catch (e: android.app.ForegroundServiceStartNotAllowedException)',
      typedCatchStart,
    );

    expect(typedCatchEnd).toBeGreaterThan(typedCatchStart);
    const typedCatchBody = serviceSource.slice(typedCatchStart, typedCatchEnd);

    expect(typedCatchBody).not.toContain('stopSelf()');
  });

  it('enters foreground unconditionally for every command before branching on the action', () => {
    // The startForeground() deadline must be satisfied for ANY delivered intent
    // (start/update/stop/disconnect/null restart), so enterForeground() has to run
    // before the action switch rather than inside a !isServiceStarted branch.
    const enterForegroundCall =
      'val inForeground = enterForeground(lastTitle, lastText)';
    // The action switch that dispatches STOP/DISCONNECT/else, distinct from the
    // earlier content-resolution switch (which begins with ACTION_START).
    const actionSwitchMatch = serviceSource.match(
      /when \(action\) \{\s*ACTION_STOP ->/,
    );

    expect(serviceSource).toContain(enterForegroundCall);
    expect(actionSwitchMatch).not.toBeNull();
    expect(serviceSource.indexOf(enterForegroundCall)).toBeLessThan(
      actionSwitchMatch?.index ?? -1,
    );
  });

  it('handles null or unknown restart intents by entering foreground immediately', () => {
    expect(serviceSource).toContain('else -> {');
    expect(serviceSource).toContain('or a null/unknown restart intent');
  });
});
