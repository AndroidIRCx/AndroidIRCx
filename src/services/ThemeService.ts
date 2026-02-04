/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { tx } from '../i18n/transifex';
import { getDefaultMessageFormats } from '../utils/MessageFormatDefaults';
import { IRCAP_THEME } from '../themes/IRcapTheme';
import { DARK_THEME } from '../themes/DarkTheme';
import { LIGHT_THEME } from '../themes/LightTheme';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceAlt: string;
  cardBackground: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textDisabled: string;
  
  // Primary colors
  primary: string;
  primaryDark: string;
  primaryLight: string;
  onPrimary: string;
  
  // Secondary colors
  secondary: string;
  onSecondary: string;
  
  // Accent colors
  accent: string;
  onAccent: string;
  
  // Status colors
  success: string;
  error: string;
  warning: string;
  info: string;
  
  // Border colors
  border: string;
  borderLight: string;
  divider: string;
  
  // Message colors
  messageBackground: string;
  messageText: string;
  messageNick: string;
  messageTimestamp: string;
  
  // System message colors
  systemMessage: string;
  noticeMessage: string;
  joinMessage: string;
  partMessage: string;
  quitMessage: string;
  kickMessage: string;
  nickMessage: string;
  inviteMessage: string;
  monitorMessage: string;
  topicMessage: string;
  modeMessage: string;
  actionMessage: string;
  rawMessage: string;
  ctcpMessage: string;
  
  // Input colors
  inputBackground: string;
  inputText: string;
  inputBorder: string;
  inputPlaceholder: string;
  
  // Button colors
  buttonPrimary: string;
  buttonPrimaryText: string;
  buttonSecondary: string;
  buttonSecondaryText: string;
  buttonDisabled: string;
  buttonDisabledText: string;
  buttonText: string;
  
  // Tab colors
  tabActive: string;
  tabInactive: string;
  tabActiveText: string;
  tabInactiveText: string;
  tabBorder: string;
  
  // Modal colors
  modalOverlay: string;
  modalBackground: string;
  modalText: string;
  
  // User list colors
  userListBackground: string;
  userListText: string;
  userListBorder: string;
  userOwner: string;    // ~ channel owner
  userAdmin: string;    // & channel admin
  userOp: string;       // @ channel operator
  userHalfop: string;   // % half-operator
  userVoice: string;    // + voiced user
  userNormal: string;
  highlightBackground: string;
  highlightText: string;      // Text color when mentioned/highlighted
  selectionBackground: string;
}

export type MessageFormatToken =
  | 'time'
  | 'nick'
  | 'oldnick'
  | 'newnick'
  | 'message'
  | 'channel'
  | 'network'
  | 'account'
  | 'username'
  | 'hostname'
  | 'hostmask'
  | 'target'
  | 'mode'
  | 'topic'
  | 'reason'
  | 'numeric'
  | 'command';

export interface MessageFormatStyle {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  reverse?: boolean;
}

export interface MessageFormatPart {
  type: 'text' | 'token';
  value: string;
  style?: MessageFormatStyle;
}

export interface ThemeMessageFormats {
  message: MessageFormatPart[];
  messageMention: MessageFormatPart[];
  action: MessageFormatPart[];
  actionMention: MessageFormatPart[];
  notice: MessageFormatPart[];
  event: MessageFormatPart[];
  join: MessageFormatPart[];
  part: MessageFormatPart[];
  quit: MessageFormatPart[];
  kick: MessageFormatPart[];
  nick: MessageFormatPart[];
  invite: MessageFormatPart[];
  monitor: MessageFormatPart[];
  mode: MessageFormatPart[];
  topic: MessageFormatPart[];
  raw: MessageFormatPart[];
  error: MessageFormatPart[];
  ctcp: MessageFormatPart[];
}

const cloneMessageFormats = (
  formats?: ThemeMessageFormats,
): ThemeMessageFormats | undefined => (formats ? JSON.parse(JSON.stringify(formats)) : undefined);

/**
 * Preporučena podešavanja koja se primenjuju kada se izabere tema
 * Ovo omogućava temama da definišu kompletan izgled aplikacije
 */
export interface ThemeRecommendedSettings {
  // Appearance
  tabPosition?: 'top' | 'bottom';
  userListSize?: number;
  userListNickFontSize?: number;
  nickListTongueSize?: number;
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  messageSpacing?: number;
  messagePadding?: number;
  navigationBarOffset?: number;
  
  // Display & UI
  noticeRouting?: 'server' | 'active' | 'both';
  showTimestamps?: boolean;
  groupMessages?: boolean;
  messageTextAlignment?: 'left' | 'center' | 'right';
  messageTextDirection?: 'auto' | 'ltr' | 'rtl';
  timestampDisplay?: 'always' | 'hover' | 'never';
  timestampFormat?: '12h' | '24h';
  bannerPosition?: 'above_header' | 'below_header' | 'bottom' | 'input_above' | 'input_below' | 'tabs_above' | 'tabs_below';
  keyboardBehavior?: 'height' | 'padding' | 'none';
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  messageFormats?: ThemeMessageFormats;
  isCustom: boolean;
  /** Preporučena podešavanja koja se mogu automatski primeniti sa temom */
  recommendedSettings?: ThemeRecommendedSettings;
}



class ThemeService {
  private currentTheme: Theme = DARK_THEME;
  private customThemes: Theme[] = [];
  private listeners: Array<(theme: Theme) => void> = [];
  private readonly STORAGE_KEY = '@AndroidIRCX:currentTheme';
  private readonly CUSTOM_THEMES_KEY = '@AndroidIRCX:customThemes';

  private getBaseThemeForColors(colors?: Partial<ThemeColors>): Theme {
    if (!colors?.background) {
      return DARK_THEME;
    }
    const bg = colors.background.trim();
    if (!bg.startsWith('#')) {
      return DARK_THEME;
    }
    const hex = bg.length === 4
      ? `#${bg[1]}${bg[1]}${bg[2]}${bg[2]}${bg[3]}${bg[3]}`
      : bg.length === 7
        ? bg
        : '';
    if (!hex) {
      return DARK_THEME;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? LIGHT_THEME : DARK_THEME;
  }

  private normalizeThemeColors(colors?: Partial<ThemeColors>): ThemeColors {
    const base = this.getBaseThemeForColors(colors);
    return {
      ...base.colors,
      ...(colors || {}),
    };
  }

  private normalizeMessageFormats(formats?: ThemeMessageFormats): ThemeMessageFormats | undefined {
    if (!formats) {
      return undefined;
    }
    const defaults = getDefaultMessageFormats();
    return {
      ...defaults,
      ...formats,
    };
  }

  private normalizeTheme(theme: Theme): Theme {
    return {
      ...theme,
      colors: this.normalizeThemeColors(theme.colors),
      messageFormats: this.normalizeMessageFormats(theme.messageFormats),
    };
  }

  async initialize(): Promise<void> {
    try {
      // Load current theme
      const savedThemeId = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (savedThemeId) {
        if (savedThemeId === 'dark' || savedThemeId === 'light' || savedThemeId === 'ircap') {
          if (savedThemeId === 'dark') {
            this.currentTheme = DARK_THEME;
          } else if (savedThemeId === 'light') {
            this.currentTheme = LIGHT_THEME;
          } else {
            this.currentTheme = IRCAP_THEME;
          }
        } else {
          // Try to load custom theme
          await this.loadCustomThemes();
          const customTheme = this.customThemes.find(t => t.id === savedThemeId);
          if (customTheme) {
            this.currentTheme = customTheme;
          }
        }
      }

      // Load custom themes
      await this.loadCustomThemes();

      // Normalize current theme if it's custom
      if (this.currentTheme.isCustom) {
        this.currentTheme = this.normalizeTheme(this.currentTheme);
      } else {
        this.currentTheme = this.normalizeTheme(this.currentTheme);
      }
    } catch (error) {
      console.error('Failed to initialize ThemeService:', error);
    }
  }

  private async loadCustomThemes(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.CUSTOM_THEMES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Theme[];
        this.customThemes = parsed.map(theme => this.normalizeTheme(theme));
      }
    } catch (error) {
      console.error('Failed to load custom themes:', error);
      this.customThemes = [];
    }
  }

  private async saveCustomThemes(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CUSTOM_THEMES_KEY, JSON.stringify(this.customThemes));
    } catch (error) {
      console.error('Failed to save custom themes:', error);
    }
  }

  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  getColors(): ThemeColors {
    return this.normalizeThemeColors(this.currentTheme.colors);
  }

  /**
   * Vraća preporučena podešavanja za trenutno aktivnu temu
   */
  getRecommendedSettings(): ThemeRecommendedSettings | undefined {
    return this.currentTheme.recommendedSettings;
  }

  /**
   * Proverava da li trenutna tema ima preporučena podešavanja
   */
  hasRecommendedSettings(): boolean {
    return !!this.currentTheme.recommendedSettings && 
           Object.keys(this.currentTheme.recommendedSettings).length > 0;
  }

  /**
   * Postavlja temu i opciono vraća preporučena podešavanja za primenu
   * @returns Preporučena podešavanja za temu (ako postoje)
   */
  async setTheme(themeId: string): Promise<ThemeRecommendedSettings | undefined> {
    if (themeId === 'dark') {
      this.currentTheme = this.normalizeTheme(DARK_THEME);
    } else if (themeId === 'light') {
      this.currentTheme = this.normalizeTheme(LIGHT_THEME);
    } else if (themeId === 'ircap') {
      this.currentTheme = this.normalizeTheme(IRCAP_THEME);
    } else {
      const customTheme = this.customThemes.find(t => t.id === themeId);
      if (customTheme) {
        this.currentTheme = this.normalizeTheme(customTheme);
      } else {
        console.warn(`Theme ${themeId} not found, using dark theme`);
        this.currentTheme = this.normalizeTheme(DARK_THEME);
      }
    }

    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, themeId);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }

    this.notifyListeners();
    
    // Vraća preporučena podešavanja koja UI može primeniti
    return this.currentTheme.recommendedSettings;
  }

  getAvailableThemes(): Theme[] {
    return [DARK_THEME, LIGHT_THEME, IRCAP_THEME, ...this.customThemes];
  }

  getBuiltInThemes(): Theme[] {
    return [DARK_THEME, LIGHT_THEME, IRCAP_THEME];
  }

  getCustomThemes(): Theme[] {
    return this.customThemes;
  }

  async createCustomTheme(name: string, baseThemeId: string = 'dark'): Promise<Theme> {
    const baseTheme = baseThemeId === 'dark' ? DARK_THEME : LIGHT_THEME;
    const newTheme: Theme = {
      id: `custom_${Date.now()}`,
      name,
      isCustom: true,
      colors: { ...baseTheme.colors },
      messageFormats: cloneMessageFormats(baseTheme.messageFormats),
    };

    this.customThemes.push(newTheme);
    await this.saveCustomThemes();
    this.notifyListeners();

    return newTheme;
  }

  async updateCustomTheme(themeId: string, updates: Partial<Theme>): Promise<boolean> {
    const themeIndex = this.customThemes.findIndex(t => t.id === themeId);
    if (themeIndex === -1) {
      return false;
    }

    if (updates.name) {
      this.customThemes[themeIndex].name = updates.name;
    }

    if (updates.colors) {
      this.customThemes[themeIndex].colors = {
        ...this.customThemes[themeIndex].colors,
        ...updates.colors,
      };
      this.customThemes[themeIndex].colors = this.normalizeThemeColors(this.customThemes[themeIndex].colors);
    }
    if (updates.messageFormats) {
      this.customThemes[themeIndex].messageFormats = this.normalizeMessageFormats(cloneMessageFormats(updates.messageFormats));
    }

    await this.saveCustomThemes();

    // If this is the current theme, update it
    if (this.currentTheme.id === themeId) {
      this.currentTheme = this.normalizeTheme(this.customThemes[themeIndex]);
    }

    this.notifyListeners();
    return true;
  }

  async deleteCustomTheme(themeId: string): Promise<boolean> {
    const themeIndex = this.customThemes.findIndex(t => t.id === themeId);
    if (themeIndex === -1) {
      return false;
    }

    // If this is the current theme, switch to dark
    if (this.currentTheme.id === themeId) {
      await this.setTheme('dark');
    }

    this.customThemes.splice(themeIndex, 1);
    await this.saveCustomThemes();
    this.notifyListeners();

    return true;
  }

  onThemeChange(callback: (theme: Theme) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.currentTheme));
  }

  // Helper method to get a color by key
  getColor(key: keyof ThemeColors): string {
    return this.currentTheme.colors[key];
  }

  /**
   * Export a theme to JSON string for sharing
   */
  exportTheme(themeId: string): string | null {
    let theme: Theme | undefined;

    if (themeId === 'dark') {
      theme = DARK_THEME;
    } else if (themeId === 'light') {
      theme = LIGHT_THEME;
    } else if (themeId === 'ircap') {
      theme = IRCAP_THEME;
    } else {
      theme = this.customThemes.find(t => t.id === themeId);
    }

    if (!theme) {
      return null;
    }

    const normalizedTheme = this.normalizeTheme(theme);

    // Create export object with metadata
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      theme: {
        name: normalizedTheme.name,
        colors: normalizedTheme.colors,
        messageFormats: normalizedTheme.messageFormats,
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import a theme from JSON string
   */
  async importTheme(jsonString: string): Promise<{ success: boolean; theme?: Theme; error?: string }> {
    try {
      const data = JSON.parse(jsonString);

      // Validate the import data structure
      if (!data.theme || !data.theme.name || !data.theme.colors) {
        return { success: false, error: t('Invalid theme file format') };
      }

      // Validate that colors object has required keys
      const requiredKeys: (keyof ThemeColors)[] = [
        'background', 'surface', 'text', 'primary', 'messageText',
      ];

      for (const key of requiredKeys) {
        if (!data.theme.colors[key]) {
          return { success: false, error: t('Theme is missing required color: {key}', { key }) };
        }
      }

      // Create new custom theme with imported colors
      // Merge with dark theme defaults to fill any missing colors
      const baseTheme = this.getBaseThemeForColors(data.theme.colors);
      const newTheme: Theme = {
        id: `imported_${Date.now()}`,
        name: data.theme.name,
        isCustom: true,
        colors: {
          ...baseTheme.colors, // Default values
          ...data.theme.colors, // Imported values override defaults
        },
        messageFormats: this.normalizeMessageFormats(cloneMessageFormats(data.theme.messageFormats)),
      };

      // Check if a theme with the same name exists
      const existingIndex = this.customThemes.findIndex(
        t => t.name.toLowerCase() === newTheme.name.toLowerCase()
      );

      if (existingIndex !== -1) {
        // Append a number to make name unique
        newTheme.name = `${data.theme.name} (${Date.now() % 1000})`;
      }

      this.customThemes.push(newTheme);
      await this.saveCustomThemes();
      this.notifyListeners();

      return { success: true, theme: newTheme };
    } catch (error) {
      console.error('Failed to import theme:', error);
      return {
        success: false,
        error: error instanceof SyntaxError
          ? t('Invalid JSON format')
          : t('Failed to import theme'),
      };
    }
  }

  /**
   * Get current theme for export
   */
  exportCurrentTheme(): string {
    return this.exportTheme(this.currentTheme.id) || '';
  }
}

export const themeService = new ThemeService();

