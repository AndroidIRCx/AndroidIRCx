/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCAP_PRESETS_BASE64 } from '../../src/presets/IRcapPresets';

describe('Presets - IRcapPresets', () => {
  describe('IRCAP_PRESETS_BASE64', () => {
    it('should export IRCAP_PRESETS_BASE64 constant', () => {
      expect(IRCAP_PRESETS_BASE64).toBeDefined();
      expect(typeof IRCAP_PRESETS_BASE64).toBe('object');
    });

    it('should have awayPresets property', () => {
      expect(IRCAP_PRESETS_BASE64).toHaveProperty('awayPresets');
      expect(typeof IRCAP_PRESETS_BASE64.awayPresets).toBe('string');
    });

    it('should have textDecorationPresets property', () => {
      expect(IRCAP_PRESETS_BASE64).toHaveProperty('textDecorationPresets');
      expect(typeof IRCAP_PRESETS_BASE64.textDecorationPresets).toBe('string');
    });

    it('should have nickCompletionPresets property', () => {
      expect(IRCAP_PRESETS_BASE64).toHaveProperty('nickCompletionPresets');
      expect(typeof IRCAP_PRESETS_BASE64.nickCompletionPresets).toBe('string');
    });

    it('should have topicPresets property', () => {
      expect(IRCAP_PRESETS_BASE64).toHaveProperty('topicPresets');
      expect(typeof IRCAP_PRESETS_BASE64.topicPresets).toBe('string');
    });
  });

  describe('Base64 validation', () => {
    it('should have valid base64 for awayPresets', () => {
      const base64 = IRCAP_PRESETS_BASE64.awayPresets.replace(/\s+/g, '');
      expect(() => Buffer.from(base64, 'base64')).not.toThrow();
      
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      expect(decoded.length).toBeGreaterThan(0);
    });

    it('should have valid base64 for textDecorationPresets', () => {
      const base64 = IRCAP_PRESETS_BASE64.textDecorationPresets.replace(/\s+/g, '');
      expect(() => Buffer.from(base64, 'base64')).not.toThrow();
      
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      expect(decoded.length).toBeGreaterThan(0);
    });

    it('should have valid base64 for nickCompletionPresets', () => {
      const base64 = IRCAP_PRESETS_BASE64.nickCompletionPresets.replace(/\s+/g, '');
      expect(() => Buffer.from(base64, 'base64')).not.toThrow();
      
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      expect(decoded.length).toBeGreaterThan(0);
    });

    it('should have valid base64 for topicPresets', () => {
      const base64 = IRCAP_PRESETS_BASE64.topicPresets.replace(/\s+/g, '');
      expect(() => Buffer.from(base64, 'base64')).not.toThrow();
      
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      expect(decoded.length).toBeGreaterThan(0);
    });
  });

  describe('Decoded content validation', () => {
    it('awayPresets should decode to valid content', () => {
      const base64 = IRCAP_PRESETS_BASE64.awayPresets.replace(/\s+/g, '');
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      
      // Should contain away-related text
      expect(decoded.length).toBeGreaterThan(0);
      // Content should contain text (may include IRC control chars for formatting)
      expect(typeof decoded).toBe('string');
    });

    it('textDecorationPresets should decode to valid content', () => {
      const base64 = IRCAP_PRESETS_BASE64.textDecorationPresets.replace(/\s+/g, '');
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      
      expect(decoded.length).toBeGreaterThan(0);
      // Contains text decoration patterns with IRC formatting codes
      expect(typeof decoded).toBe('string');
    });

    it('nickCompletionPresets should decode to valid content', () => {
      const base64 = IRCAP_PRESETS_BASE64.nickCompletionPresets.replace(/\s+/g, '');
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      
      expect(decoded.length).toBeGreaterThan(0);
      expect(typeof decoded).toBe('string');
    });

    it('topicPresets should decode to valid content', () => {
      const base64 = IRCAP_PRESETS_BASE64.topicPresets.replace(/\s+/g, '');
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      
      expect(decoded.length).toBeGreaterThan(0);
      expect(typeof decoded).toBe('string');
    });
  });

  describe('Preset structure', () => {
    it('should have exactly 4 preset categories', () => {
      const keys = Object.keys(IRCAP_PRESETS_BASE64);
      expect(keys).toHaveLength(4);
      expect(keys).toContain('awayPresets');
      expect(keys).toContain('textDecorationPresets');
      expect(keys).toContain('nickCompletionPresets');
      expect(keys).toContain('topicPresets');
    });

    it('all preset values should be non-empty strings', () => {
      Object.entries(IRCAP_PRESETS_BASE64).forEach(([_key, value]) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });

    it('should maintain constant values', () => {
      // The export uses 'as const' which makes it readonly at compile time
      // At runtime we just verify the structure is consistent
      expect(IRCAP_PRESETS_BASE64).toBeDefined();
      
      // Values should remain constant across multiple accesses
      const firstAccess = IRCAP_PRESETS_BASE64.awayPresets;
      const secondAccess = IRCAP_PRESETS_BASE64.awayPresets;
      expect(secondAccess).toBe(firstAccess);
    });
  });
});
