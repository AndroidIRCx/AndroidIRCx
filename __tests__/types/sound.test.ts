/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  SoundEventType,
  DEFAULT_SOUNDS,
  SOUND_EVENT_LABELS,
  SOUND_EVENT_CATEGORIES,
  BUILT_IN_SCHEMES,
  DEFAULT_SOUND_SETTINGS,
} from '../../src/types/sound';

describe('types/sound', () => {
  it('should define sounds and labels for each SoundEventType', () => {
    const events = Object.values(SoundEventType);
    expect(events.length).toBeGreaterThan(0);

    for (const event of events) {
      expect(DEFAULT_SOUNDS[event]).toBeDefined();
      expect(DEFAULT_SOUNDS[event]).toMatch(/\.wav$/);
      expect(SOUND_EVENT_LABELS[event]).toBeDefined();
      expect(typeof SOUND_EVENT_LABELS[event]).toBe('string');
    }
  });

  it('should include all events exactly once across categories', () => {
    const categorized = Object.values(SOUND_EVENT_CATEGORIES).flat();
    const uniqueCategorized = new Set(categorized);
    const allEvents = Object.values(SoundEventType);

    expect(uniqueCategorized.size).toBe(allEvents.length);
    expect(allEvents.every(event => uniqueCategorized.has(event))).toBe(true);
  });

  it('should expose expected built-in schemes', () => {
    const schemeIds = BUILT_IN_SCHEMES.map(s => s.id);
    expect(schemeIds).toEqual(expect.arrayContaining(['classic', 'modern', 'silent']));
    expect(BUILT_IN_SCHEMES.every(s => s.isBuiltIn)).toBe(true);
  });

  it('classic scheme should mirror default sounds', () => {
    const classic = BUILT_IN_SCHEMES.find(s => s.id === 'classic');
    expect(classic).toBeDefined();
    expect(classic?.sounds).toEqual(DEFAULT_SOUNDS);
  });

  it('silent scheme should have no mapped sounds', () => {
    const silent = BUILT_IN_SCHEMES.find(s => s.id === 'silent');
    expect(silent).toBeDefined();
    expect(Object.keys(silent?.sounds || {})).toHaveLength(0);
  });

  it('default sound settings should configure every event', () => {
    const events = Object.values(SoundEventType);
    const configuredEvents = Object.keys(DEFAULT_SOUND_SETTINGS.events);
    expect(configuredEvents.length).toBe(events.length);

    for (const event of events) {
      const cfg = DEFAULT_SOUND_SETTINGS.events[event];
      expect(cfg).toBeDefined();
      expect(cfg.useCustom).toBe(false);
      expect(cfg.volume).toBe(1.0);
    }
  });

  it('default enabled events should match expected subset', () => {
    const enabled = Object.entries(DEFAULT_SOUND_SETTINGS.events)
      .filter(([, cfg]) => cfg.enabled)
      .map(([event]) => event)
      .sort();

    const expected = [
      SoundEventType.MENTION,
      SoundEventType.PRIVATE_MESSAGE,
      SoundEventType.DISCONNECT,
      SoundEventType.LOGIN,
      SoundEventType.RING,
      SoundEventType.NOTIFY,
    ].sort();

    expect(enabled).toEqual(expected);
  });
});

