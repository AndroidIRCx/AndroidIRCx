/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Mock app.json before importing the module
jest.mock('../../app.json', () => ({
  version: '1.7.5',
  name: 'AndroidIRCX',
  displayName: 'AndroidIRCX',
}));

import { APP_VERSION } from '../../src/config/appVersion';

describe('Config - appVersion', () => {
  it('should export APP_VERSION constant', () => {
    expect(APP_VERSION).toBeDefined();
    expect(typeof APP_VERSION).toBe('string');
  });

  it('should read version from app.json', () => {
    expect(APP_VERSION).toBe('1.7.5');
  });

  it('should have semantic version format', () => {
    // Semantic version pattern: major.minor.patch
    const semverPattern = /^\d+\.\d+\.\d+$/;
    expect(APP_VERSION).toMatch(semverPattern);
  });
});

describe('Config - appVersion fallback', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should fallback to "1.0.0" when version is not in app.json', () => {
    // Mock app.json without version
    jest.doMock('../../app.json', () => ({
      name: 'AndroidIRCX',
    }));

    // Re-import to get the fallback behavior
    const {
      APP_VERSION: fallbackVersion,
    } = require('../../src/config/appVersion');

    expect(fallbackVersion).toBe('1.0.0');
  });

  it('should fallback to "1.0.0" when app.json is empty', () => {
    jest.doMock('../../app.json', () => ({}));

    const {
      APP_VERSION: fallbackVersion,
    } = require('../../src/config/appVersion');

    expect(fallbackVersion).toBe('1.0.0');
  });
});
