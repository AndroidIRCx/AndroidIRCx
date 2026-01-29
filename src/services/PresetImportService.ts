/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCAP_PRESETS_BASE64 } from '../presets/IRcapPresets';
import { settingsService } from './SettingsService';
import {
  decodeMircPresetBase64,
  parseGenericPresets,
  parseIrcapDecorationEti,
  parseNickCompletionPresets,
} from '../utils/MircPresetParser';

class PresetImportService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.importAwayPresets();
    await this.importDecorationPresets();
    await this.importNickCompletionPresets();
    await this.importTopicPresets();
  }

  private needsReimport(entries: string[]): boolean {
    return entries.some((entry) => /[ÂÃ�]/.test(entry) || /\s+(on|off)$/i.test(entry));
  }

  private async importAwayPresets(): Promise<void> {
    const existing = await settingsService.getSetting('awayPresets', [] as string[]);
    if (existing.length > 0 && !this.needsReimport(existing)) return;
    const raw = decodeMircPresetBase64(IRCAP_PRESETS_BASE64.awayPresets);
    const parsed = parseGenericPresets(raw).map(entry => entry.raw);
    if (parsed.length > 0) {
      await settingsService.setSetting('awayPresets', parsed);
    }
  }

  private async importDecorationPresets(): Promise<void> {
    const existing = await settingsService.getSetting('decorStyles', [] as string[]);
    const raw = decodeMircPresetBase64(IRCAP_PRESETS_BASE64.textDecorationPresets);
    const parsed = parseIrcapDecorationEti(raw);
    if (parsed.length > 0) {
      if (existing.length > 0 && !this.needsReimport(existing)) {
        const merged = [...existing, ...parsed.filter(style => !existing.includes(style))];
        await settingsService.setSetting('decorStyles', merged);
      } else {
        await settingsService.setSetting('decorStyles', parsed);
      }
    }
  }

  private async importNickCompletionPresets(): Promise<void> {
    const existing = await settingsService.getSetting('nickCompleteStyles', [] as string[]);
    if (existing.length > 0 && !this.needsReimport(existing)) return;
    const raw = decodeMircPresetBase64(IRCAP_PRESETS_BASE64.nickCompletionPresets);
    const parsed = parseNickCompletionPresets(raw).map(entry => entry.raw);
    if (parsed.length > 0) {
      await settingsService.setSetting('nickCompleteStyles', parsed);
      await settingsService.setSetting('nickCompleteStyleId', parsed[0]);
    }
  }

  private async importTopicPresets(): Promise<void> {
    const existing = await settingsService.getSetting('topicStyles', [] as string[]);
    if (existing.length > 0 && !this.needsReimport(existing)) return;
    const raw = decodeMircPresetBase64(IRCAP_PRESETS_BASE64.topicPresets);
    const parsed = parseGenericPresets(raw).map(entry => entry.raw);
    if (parsed.length > 0) {
      await settingsService.setSetting('topicStyles', parsed);
      await settingsService.setSetting('topicStyleId', parsed[0]);
    }
  }
}

export const presetImportService = new PresetImportService();
