import { useState, useEffect, useCallback } from 'react';
import { settingsService } from '../services/SettingsService';

export interface UseSettingsSecurityReturn {
  // Kill switch settings
  killSwitchEnabledOnHeader: boolean;
  killSwitchEnabledOnLockScreen: boolean;
  killSwitchShowWarnings: boolean;
  killSwitchCustomName: string;
  killSwitchCustomIcon: string;
  killSwitchCustomColor: string;

  // Quick connect
  quickConnectNetworkId: string | null;

  // Actions
  setKillSwitchEnabledOnHeader: (value: boolean) => Promise<void>;
  setKillSwitchEnabledOnLockScreen: (value: boolean) => Promise<void>;
  setKillSwitchShowWarnings: (value: boolean) => Promise<void>;
  setKillSwitchCustomName: (name: string) => Promise<void>;
  setKillSwitchCustomIcon: (icon: string) => Promise<void>;
  setKillSwitchCustomColor: (color: string) => Promise<void>;
  setQuickConnectNetworkId: (networkId: string | null) => Promise<void>;
}

export const useSettingsSecurity = (): UseSettingsSecurityReturn => {
  const [killSwitchEnabledOnHeader, setKillSwitchEnabledOnHeaderState] = useState(false);
  const [killSwitchEnabledOnLockScreen, setKillSwitchEnabledOnLockScreenState] = useState(false);
  const [killSwitchShowWarnings, setKillSwitchShowWarningsState] = useState(true);
  const [killSwitchCustomName, setKillSwitchCustomNameState] = useState('Meow Meow');
  const [killSwitchCustomIcon, setKillSwitchCustomIconState] = useState('cat');
  const [killSwitchCustomColor, setKillSwitchCustomColorState] = useState('#f44336');
  const [quickConnectNetworkId, setQuickConnectNetworkIdState] = useState<string | null>(null);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      const headerKillSwitch = await settingsService.getSetting('killSwitchEnabledOnHeader', false);
      const lockScreenKillSwitch = await settingsService.getSetting('killSwitchEnabledOnLockScreen', false);
      const showWarnings = await settingsService.getSetting('killSwitchShowWarnings', true);
      const customName = await settingsService.getSetting('killSwitchCustomName', 'Meow Meow');
      const customIcon = await settingsService.getSetting('killSwitchCustomIcon', 'cat');
      const customColor = await settingsService.getSetting('killSwitchCustomColor', '#f44336');
      const quickConnectNetId = await settingsService.getSetting<string | null>('quickConnectNetworkId', null);

      setKillSwitchEnabledOnHeaderState(headerKillSwitch);
      setKillSwitchEnabledOnLockScreenState(lockScreenKillSwitch);
      setKillSwitchShowWarningsState(showWarnings);
      setKillSwitchCustomNameState(customName);
      setKillSwitchCustomIconState(customIcon);
      setKillSwitchCustomColorState(customColor);
      setQuickConnectNetworkIdState(quickConnectNetId);
    };
    loadSettings();

    // Subscribe to changes
    const unsubscribeCustomName = settingsService.onSettingChange<string>('killSwitchCustomName', (value) => {
      setKillSwitchCustomNameState(value);
    });
    const unsubscribeCustomIcon = settingsService.onSettingChange<string>('killSwitchCustomIcon', (value) => {
      setKillSwitchCustomIconState(value);
    });
    const unsubscribeCustomColor = settingsService.onSettingChange<string>('killSwitchCustomColor', (value) => {
      setKillSwitchCustomColorState(value);
    });
    const unsubscribeHeader = settingsService.onSettingChange<boolean>('killSwitchEnabledOnHeader', (value) => {
      setKillSwitchEnabledOnHeaderState(value);
    });
    const unsubscribeLockScreen = settingsService.onSettingChange<boolean>('killSwitchEnabledOnLockScreen', (value) => {
      setKillSwitchEnabledOnLockScreenState(value);
    });
    const unsubscribeWarnings = settingsService.onSettingChange<boolean>('killSwitchShowWarnings', (value) => {
      setKillSwitchShowWarningsState(value);
    });

    return () => {
      unsubscribeCustomName();
      unsubscribeCustomIcon();
      unsubscribeCustomColor();
      unsubscribeHeader();
      unsubscribeLockScreen();
      unsubscribeWarnings();
    };
  }, []);

  const setKillSwitchEnabledOnHeader = useCallback(async (value: boolean) => {
    await settingsService.setSetting('killSwitchEnabledOnHeader', value);
    setKillSwitchEnabledOnHeaderState(value);
  }, []);

  const setKillSwitchEnabledOnLockScreen = useCallback(async (value: boolean) => {
    await settingsService.setSetting('killSwitchEnabledOnLockScreen', value);
    setKillSwitchEnabledOnLockScreenState(value);
  }, []);

  const setKillSwitchShowWarnings = useCallback(async (value: boolean) => {
    await settingsService.setSetting('killSwitchShowWarnings', value);
    setKillSwitchShowWarningsState(value);
  }, []);

  const setKillSwitchCustomName = useCallback(async (name: string) => {
    await settingsService.setSetting('killSwitchCustomName', name);
    setKillSwitchCustomNameState(name);
  }, []);

  const setKillSwitchCustomIcon = useCallback(async (icon: string) => {
    await settingsService.setSetting('killSwitchCustomIcon', icon);
    setKillSwitchCustomIconState(icon);
  }, []);

  const setKillSwitchCustomColor = useCallback(async (color: string) => {
    await settingsService.setSetting('killSwitchCustomColor', color);
    setKillSwitchCustomColorState(color);
  }, []);

  const setQuickConnectNetworkId = useCallback(async (networkId: string | null) => {
    await settingsService.setSetting('quickConnectNetworkId', networkId);
    setQuickConnectNetworkIdState(networkId);
  }, []);

  return {
    killSwitchEnabledOnHeader,
    killSwitchEnabledOnLockScreen,
    killSwitchShowWarnings,
    killSwitchCustomName,
    killSwitchCustomIcon,
    killSwitchCustomColor,
    quickConnectNetworkId,
    setKillSwitchEnabledOnHeader,
    setKillSwitchEnabledOnLockScreen,
    setKillSwitchShowWarnings,
    setKillSwitchCustomName,
    setKillSwitchCustomIcon,
    setKillSwitchCustomColor,
    setQuickConnectNetworkId,
  };
};
