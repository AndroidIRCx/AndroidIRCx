import { useState, useEffect, useCallback } from 'react';
import { themeService, Theme } from '../services/ThemeService';
import { settingsService } from '../services/SettingsService';
import { layoutService, LayoutConfig, ViewMode, FontSize } from '../services/LayoutService';
import { SUPPORTED_LOCALES } from '../i18n/config';

export interface UseSettingsAppearanceReturn {
  // Theme
  currentTheme: Theme;
  availableThemes: Theme[];
  showThemeEditor: boolean;
  editingTheme: Theme | undefined;
  
  // Layout
  layoutConfig: LayoutConfig | null;
  
  // Language
  appLanguage: string;
  
  // Actions
  setShowThemeEditor: (show: boolean) => void;
  setEditingTheme: (theme: Theme | undefined) => void;
  refreshThemes: () => void;
  setAppLanguage: (lang: string) => Promise<void>;
  updateLayoutConfig: (config: Partial<LayoutConfig>) => Promise<void>;
}

export const useSettingsAppearance = (): UseSettingsAppearanceReturn => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(themeService.getCurrentTheme());
  const [availableThemes, setAvailableThemes] = useState<Theme[]>(themeService.getAvailableThemes());
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | undefined>(undefined);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null);
  const [appLanguage, setAppLanguageState] = useState<string>('system');

  // Load initial state
  useEffect(() => {
    const loadSettings = async () => {
      const lang = await settingsService.getSetting<string>('appLanguage', 'system');
      setAppLanguageState(lang);
      
      const config = layoutService.getConfig();
      setLayoutConfig(config);
    };
    loadSettings();
  }, []);

  // Listen for theme changes
  useEffect(() => {
    const unsubscribe = themeService.onThemeChange((theme) => {
      setCurrentTheme(theme);
      setAvailableThemes(themeService.getAvailableThemes());
    });
    return unsubscribe;
  }, []);

  const refreshThemes = useCallback(() => {
    setCurrentTheme(themeService.getCurrentTheme());
    setAvailableThemes(themeService.getAvailableThemes());
  }, []);

  const setAppLanguage = useCallback(async (lang: string) => {
    await settingsService.setSetting('appLanguage', lang);
    setAppLanguageState(lang);
  }, []);

  const updateLayoutConfig = useCallback(async (config: Partial<LayoutConfig>) => {
    await layoutService.setConfig(config);
    setLayoutConfig(layoutService.getConfig());
  }, []);

  return {
    currentTheme,
    availableThemes,
    showThemeEditor,
    editingTheme,
    layoutConfig,
    appLanguage,
    setShowThemeEditor,
    setEditingTheme,
    refreshThemes,
    setAppLanguage,
    updateLayoutConfig,
  };
};
