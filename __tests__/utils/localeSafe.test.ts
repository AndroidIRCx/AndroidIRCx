/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  compareStrings,
  compareStringsCaseInsensitive,
  formatClockTime,
  formatLocalDateTime,
} from '../../src/utils/localeSafe';

describe('localeSafe', () => {
  it('formats clock time without Intl/locale APIs', () => {
    const morning = new Date(2026, 4, 18, 9, 5).getTime();
    const afternoon = new Date(2026, 4, 18, 15, 4).getTime();
    const midnight = new Date(2026, 4, 18, 0, 0).getTime();

    expect(formatClockTime(morning, '24h')).toBe('09:05');
    expect(formatClockTime(afternoon, '24h')).toBe('15:04');
    expect(formatClockTime(morning, '12h')).toBe('09:05 AM');
    expect(formatClockTime(afternoon, '12h')).toBe('03:04 PM');
    expect(formatClockTime(midnight, '12h')).toBe('12:00 AM');
  });

  it('formats local date time without Intl/locale APIs', () => {
    const timestamp = new Date(2026, 0, 2, 3, 4).getTime();

    expect(formatLocalDateTime(timestamp)).toBe('2026-01-02 03:04');
  });

  it('handles invalid timestamps like Date locale formatters do', () => {
    expect(formatClockTime(Number.NaN, '24h')).toBe('Invalid Date');
    expect(formatLocalDateTime(Number.NaN)).toBe('Invalid Date');
  });

  it('compares strings without constructing Intl collators', () => {
    expect(compareStrings('alpha', 'zebra')).toBeLessThan(0);
    expect(compareStrings('same', 'same')).toBe(0);
    expect(compareStringsCaseInsensitive('Beta', 'alpha')).toBeGreaterThan(0);
    expect(compareStringsCaseInsensitive('Alpha', 'alpha')).toBeLessThan(0);
  });
});
