import AsyncStorage from '@react-native-async-storage/async-storage';
import { tx } from '../i18n/transifex';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  surfaceVariant: string;
  
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
  joinMessage: string;
  partMessage: string;
  quitMessage: string;
  inviteMessage: string;
  monitorMessage: string;
  topicMessage: string;
  modeMessage: string;
  actionMessage: string;
  
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
  userOp: string;
  userVoice: string;
  userNormal: string;
  highlightBackground: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  isCustom: boolean;
}

const DARK_THEME: Theme = {
  id: 'dark',
  name: t('Dark'),
  isCustom: false,
  colors: {
    background: '#121212',
    surface: '#1E1E1E',
    surfaceVariant: '#2C2C2C',
    
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textDisabled: '#666666',
    
    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#64B5F6',
    onPrimary: '#FFFFFF',
    
    secondary: '#FF9800',
    onSecondary: '#FFFFFF',
    
    accent: '#4CAF50',
    onAccent: '#FFFFFF',
    
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    
    border: '#333333',
    borderLight: '#2A2A2A',
    divider: '#2A2A2A',
    
    messageBackground: '#1E1E1E',
    messageText: '#E0E0E0',
    messageNick: '#64B5F6',
    messageTimestamp: '#757575',
    
    systemMessage: '#9E9E9E',
    joinMessage: '#4CAF50',
    partMessage: '#FF9800',
    quitMessage: '#F44336',
    inviteMessage: '#2196F3',
    monitorMessage: '#2196F3',
    topicMessage: '#9C27B0',
    modeMessage: '#5DADE2',
    actionMessage: '#9E9E9E',
    
    inputBackground: '#2C2C2C',
    inputText: '#FFFFFF',
    inputBorder: '#333333',
    inputPlaceholder: '#757575',
    
    buttonPrimary: '#2196F3',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#424242',
    buttonSecondaryText: '#FFFFFF',
    buttonDisabled: '#2C2C2C',
    buttonDisabledText: '#666666',
    
    tabActive: '#2196F3',
    tabInactive: '#2C2C2C',
    tabActiveText: '#FFFFFF',
    tabInactiveText: '#B0B0B0',
    tabBorder: '#333333',
    
    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#1E1E1E',
    modalText: '#FFFFFF',
    
    userListBackground: '#1A1A1A',
    userListText: '#E0E0E0',
    userListBorder: '#2A2A2A',
    userOp: '#F44336',
    userVoice: '#4CAF50',
    userNormal: '#E0E0E0',
    highlightBackground: 'rgba(33, 150, 243, 0.2)',
  },
};

const LIGHT_THEME: Theme = {
  id: 'light',
  name: t('Light'),
  isCustom: false,
  colors: {
    background: '#FFFFFF',
    surface: '#FAFAFA',
    surfaceVariant: '#F5F5F5',
    
    text: '#212121',
    textSecondary: '#757575',
    textDisabled: '#9E9E9E',
    
    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#64B5F6',
    onPrimary: '#FFFFFF',
    
    secondary: '#FF9800',
    onSecondary: '#FFFFFF',
    
    accent: '#4CAF50',
    onAccent: '#FFFFFF',
    
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    
    border: '#E0E0E0',
    borderLight: '#F5F5F5',
    divider: '#E0E0E0',
    
    messageBackground: '#FFFFFF',
    messageText: '#212121',
    messageNick: '#1976D2',
    messageTimestamp: '#9E9E9E',
    
    systemMessage: '#757575',
    joinMessage: '#4CAF50',
    partMessage: '#FF9800',
    quitMessage: '#F44336',
    inviteMessage: '#2196F3',
    monitorMessage: '#2196F3',
    topicMessage: '#9C27B0',
    modeMessage: '#5DADE2',
    actionMessage: '#9E9E9E',
    
    inputBackground: '#F5F5F5',
    inputText: '#212121',
    inputBorder: '#E0E0E0',
    inputPlaceholder: '#9E9E9E',
    
    buttonPrimary: '#2196F3',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#E0E0E0',
    buttonSecondaryText: '#212121',
    buttonDisabled: '#F5F5F5',
    buttonDisabledText: '#9E9E9E',
    
    tabActive: '#2196F3',
    tabInactive: '#F5F5F5',
    tabActiveText: '#FFFFFF',
    tabInactiveText: '#757575',
    tabBorder: '#E0E0E0',
    
    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#FFFFFF',
    modalText: '#212121',
    
    userListBackground: '#FAFAFA',
    userListText: '#212121',
    userListBorder: '#E0E0E0',
    userOp: '#F44336',
    userVoice: '#4CAF50',
    userNormal: '#212121',
    highlightBackground: 'rgba(33, 150, 243, 0.1)',
  },
};

class ThemeService {
  private currentTheme: Theme = DARK_THEME;
  private customThemes: Theme[] = [];
  private listeners: Array<(theme: Theme) => void> = [];
  private readonly STORAGE_KEY = '@AndroidIRCX:currentTheme';
  private readonly CUSTOM_THEMES_KEY = '@AndroidIRCX:customThemes';

  async initialize(): Promise<void> {
    try {
      // Load current theme
      const savedThemeId = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (savedThemeId) {
        if (savedThemeId === 'dark' || savedThemeId === 'light') {
          this.currentTheme = savedThemeId === 'dark' ? DARK_THEME : LIGHT_THEME;
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
    } catch (error) {
      console.error('Failed to initialize ThemeService:', error);
    }
  }

  private async loadCustomThemes(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.CUSTOM_THEMES_KEY);
      if (stored) {
        this.customThemes = JSON.parse(stored);
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
    return this.currentTheme.colors;
  }

  async setTheme(themeId: string): Promise<void> {
    if (themeId === 'dark') {
      this.currentTheme = DARK_THEME;
    } else if (themeId === 'light') {
      this.currentTheme = LIGHT_THEME;
    } else {
      const customTheme = this.customThemes.find(t => t.id === themeId);
      if (customTheme) {
        this.currentTheme = customTheme;
      } else {
        console.warn(`Theme ${themeId} not found, using dark theme`);
        this.currentTheme = DARK_THEME;
      }
    }

    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, themeId);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }

    this.notifyListeners();
  }

  getAvailableThemes(): Theme[] {
    return [DARK_THEME, LIGHT_THEME, ...this.customThemes];
  }

  getBuiltInThemes(): Theme[] {
    return [DARK_THEME, LIGHT_THEME];
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
    }

    await this.saveCustomThemes();

    // If this is the current theme, update it
    if (this.currentTheme.id === themeId) {
      this.currentTheme = this.customThemes[themeIndex];
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
}

export const themeService = new ThemeService();

