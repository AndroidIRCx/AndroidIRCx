import AsyncStorage from '@react-native-async-storage/async-storage';

export type TabPosition = 'top' | 'bottom' | 'left' | 'right';
export type UserListPosition = 'left' | 'right' | 'top' | 'bottom';
export type ViewMode = 'compact' | 'comfortable' | 'spacious';
export type FontSize = 'small' | 'medium' | 'large' | 'custom';

export interface LayoutConfig {
  tabPosition: TabPosition;
  userListPosition: UserListPosition;
  viewMode: ViewMode;
  fontSize: FontSize;
  fontSizeValues: {
    small: number;
    medium: number;
    large: number;
    custom: number;
  };
  messageSpacing: number; // Spacing between messages (0-20)
  messagePadding: number; // Padding inside message container (0-20)
  timestampDisplay: 'always' | 'grouped' | 'never';
  timestampFormat: '12h' | '24h';
  showNickColors: boolean;
  compactMode: boolean; // Legacy compact mode flag
  navigationBarOffset: number; // Additional bottom offset for Android navigation (0-100px)
}

class LayoutService {
  private config: LayoutConfig = {
    tabPosition: 'top',
    userListPosition: 'right',
    viewMode: 'comfortable',
    fontSize: 'medium',
    fontSizeValues: {
      small: 12,
      medium: 14,
      large: 16,
      custom: 18,
    },
    messageSpacing: 4,
    messagePadding: 8,
    timestampDisplay: 'always',
    timestampFormat: '24h',
    showNickColors: true,
    compactMode: false,
    navigationBarOffset: 0,
  };

  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private listeners: Array<(config: LayoutConfig) => void> = [];
  private readonly STORAGE_KEY = '@AndroidIRCX:layoutConfig';

  /**
   * Initialize layout service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          const nextConfig = { ...this.config, ...data };
          if (data.fontSize === 'xlarge') {
            nextConfig.fontSize = 'custom';
            nextConfig.fontSizeValues = {
              ...nextConfig.fontSizeValues,
              custom: 18,
            };
          }
          if (!data.fontSizeValues) {
            nextConfig.fontSizeValues = { ...this.config.fontSizeValues };
          }
          this.config = nextConfig;
          if (!data.userListPosition) {
            this.config.userListPosition = 'right';
          }
          // Migrate old compactMode to viewMode if needed
          if (data.compactMode !== undefined && !data.viewMode) {
            this.config.viewMode = data.compactMode ? 'compact' : 'comfortable';
          }
          // Migrate old showTimestamps to timestampDisplay
          if (data.showTimestamps !== undefined && !data.timestampDisplay) {
            this.config.timestampDisplay = data.showTimestamps ? 'grouped' : 'never';
          }
        }
      } catch (error) {
        console.error('Failed to load layout config:', error);
      } finally {
        this.initialized = true;
        this.initPromise = null;
        this.notifyListeners();
      }
    })();
    return this.initPromise;
  }

  /**
   * Get current layout config
   */
  getConfig(): LayoutConfig {
    return { ...this.config };
  }

  /**
   * Update layout config
   */
  async setConfig(updates: Partial<LayoutConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
    this.notifyListeners();
  }

  /**
   * Get tab position
   */
  getTabPosition(): TabPosition {
    return this.config.tabPosition;
  }

  /**
   * Set tab position
   */
  async setTabPosition(position: TabPosition): Promise<void> {
    await this.setConfig({ tabPosition: position });
  }

  /**
   * Get user list position
   */
  getUserListPosition(): UserListPosition {
    return this.config.userListPosition;
  }

  /**
   * Set user list position
   */
  async setUserListPosition(position: UserListPosition): Promise<void> {
    await this.setConfig({ userListPosition: position });
  }

  /**
   * Get view mode
   */
  getViewMode(): ViewMode {
    return this.config.viewMode;
  }

  /**
   * Set view mode
   */
  async setViewMode(mode: ViewMode): Promise<void> {
    await this.setConfig({ viewMode: mode });
    // Update message spacing and padding based on view mode
    const spacingMap: Record<ViewMode, { spacing: number; padding: number }> = {
      compact: { spacing: 2, padding: 4 },
      comfortable: { spacing: 4, padding: 8 },
      spacious: { spacing: 8, padding: 12 },
    };
    const { spacing, padding } = spacingMap[mode];
    await this.setConfig({ messageSpacing: spacing, messagePadding: padding });
  }

  /**
   * Get font size
   */
  getFontSize(): FontSize {
    return this.config.fontSize;
  }

  /**
   * Get font size in pixels
   */
  getFontSizePixels(): number {
    const sizeMap = this.config.fontSizeValues || {
      small: 12,
      medium: 14,
      large: 16,
      custom: 18,
    };
    return sizeMap[this.config.fontSize] || 14;
  }

  /**
   * Set font size
   */
  async setFontSize(size: FontSize): Promise<void> {
    await this.setConfig({ fontSize: size });
  }

  /**
   * Set font size value (8-30px)
   */
  async setFontSizeValue(size: keyof LayoutConfig['fontSizeValues'], value: number): Promise<void> {
    const nextValue = Math.max(8, Math.min(30, value));
    await this.setConfig({
      fontSizeValues: {
        ...this.config.fontSizeValues,
        [size]: nextValue,
      },
    });
  }

  /**
   * Get message spacing
   */
  getMessageSpacing(): number {
    return this.config.messageSpacing;
  }

  /**
   * Set message spacing
   */
  async setMessageSpacing(spacing: number): Promise<void> {
    await this.setConfig({ messageSpacing: Math.max(0, Math.min(20, spacing)) });
  }

  /**
   * Get message padding
   */
  getMessagePadding(): number {
    return this.config.messagePadding;
  }

  /**
   * Set message padding
   */
  async setMessagePadding(padding: number): Promise<void> {
    await this.setConfig({ messagePadding: Math.max(0, Math.min(20, padding)) });
  }

  /**
   * Get timestamp display option
   */
  getTimestampDisplay(): 'always' | 'grouped' | 'never' {
    return this.config.timestampDisplay;
  }

  /**
   * Set timestamp display option
   */
  async setTimestampDisplay(display: 'always' | 'grouped' | 'never'): Promise<void> {
    await this.setConfig({ timestampDisplay: display });
  }

  /**
   * Get timestamp format
   */
  getTimestampFormat(): '12h' | '24h' {
    return this.config.timestampFormat;
  }

  /**
   * Set timestamp format
   */
  async setTimestampFormat(format: '12h' | '24h'): Promise<void> {
    await this.setConfig({ timestampFormat: format });
  }

  /**
   * Get nick colors visibility
   */
  getShowNickColors(): boolean {
    return this.config.showNickColors;
  }

  /**
   * Set nick colors visibility
   */
  async setShowNickColors(show: boolean): Promise<void> {
    await this.setConfig({ showNickColors: show });
  }

  /**
   * Get navigation bar offset
   */
  getNavigationBarOffset(): number {
    return this.config.navigationBarOffset;
  }

  /**
   * Set navigation bar offset (0-100px)
   */
  async setNavigationBarOffset(offset: number): Promise<void> {
    await this.setConfig({ navigationBarOffset: Math.max(0, Math.min(100, offset)) });
  }

  /**
   * Listen for config changes
   */
  onConfigChange(callback: (config: LayoutConfig) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify listeners
   */
  private notifyListeners(): void {
    const config = this.getConfig();
    this.listeners.forEach(callback => {
      try {
        callback(config);
      } catch (error) {
        console.error('Error in layout config listener:', error);
      }
    });
  }

  /**
   * Save configuration
   */
  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save layout config:', error);
    }
  }
}

export const layoutService = new LayoutService();

