import { useState, useEffect } from 'react';
import { themeService, Theme, ThemeColors } from '../services/ThemeService';

export function useTheme(): { theme: Theme; colors: ThemeColors } {
  const [theme, setTheme] = useState<Theme>(themeService.getCurrentTheme());

  useEffect(() => {
    const unsubscribe = themeService.onThemeChange(newTheme => {
      setTheme(newTheme);
    });

    return unsubscribe;
  }, []);

  return {
    theme,
    colors: theme.colors,
  };
}

