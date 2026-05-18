/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type ClockFormat = '12h' | '24h';

const pad2 = (value: number): string => value.toString().padStart(2, '0');

const toValidDate = (timestamp: number): Date | null => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatClockTime = (
  timestamp: number,
  format: ClockFormat = '12h',
): string => {
  const date = toValidDate(timestamp);
  if (!date) {
    return 'Invalid Date';
  }

  const hours = date.getHours();
  const minutes = pad2(date.getMinutes());

  if (format === '24h') {
    return `${pad2(hours)}:${minutes}`;
  }

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${pad2(hour12)}:${minutes} ${suffix}`;
};

export const formatLocalDateTime = (timestamp: number): string => {
  const date = toValidDate(timestamp);
  if (!date) {
    return 'Invalid Date';
  }

  return [
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
      date.getDate(),
    )}`,
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  ].join(' ');
};

export const compareStrings = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
};

export const compareStringsCaseInsensitive = (a: string, b: string): number => {
  const foldedA = a.toLowerCase();
  const foldedB = b.toLowerCase();
  const foldedCompare = compareStrings(foldedA, foldedB);
  return foldedCompare !== 0 ? foldedCompare : compareStrings(a, b);
};
