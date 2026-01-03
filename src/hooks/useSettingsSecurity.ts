import { useState, useEffect, useCallback } from 'react';
import { settingsService } from '../services/SettingsService';

export interface UseSettingsSecurityReturn {
  // Kill switch settings
  killSwitchEnabledOnHeader: boolean;
  killSwitchEnabledOnLockScreen: boolean;
  killSwitchShowWarnings: boolean;
  
  // Quick connect
  quickConnectNetworkId: string | null;
  
  // Actions
  setKillSwitchEnabledOnHeader: (value: boolean) => Promise<void>;
  setKillSwitchEnabledOnLockScreen: (value: boolean) => Promise<void>;
  setKillSwitchShowWarnings: (value: boolean) => Promise<void>;
  setQuickConnectNetworkId: (networkId: string | null) => Promise<void>;
}

export const useSettingsSecurity = (): UseSettingsSecurityReturn => {
  const [killSwitchEnabledOnHeader, setKillSwitchEnabledOnHeaderState] = useState(false);
  const [killSwitchEnabledOnLockScreen, setKillSwitchEnabledOnLockScreenState] = useState(false);
  const [killSwitchShowWarnings, setKillSwitchShowWarningsState] = useState(true);
  const [quickConnectNetworkId, setQuickConnectNetworkIdState] = useState<string | null>(null);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      const headerKillSwitch = await settingsService.getSetting('killSwitchEnabledOnHeader', false);
      const lockScreenKillSwitch = await settingsService.getSetting('killSwitchEnabledOnLockScreen', false);
      const showWarnings = await settingsService.getSetting('killSwitchShowWarnings', true);
      const quickConnectNetId = await settingsService.getSetting<string | null>('quickConnectNetworkId', null);
      
      setKillSwitchEnabledOnHeaderState(headerKillSwitch);
      setKillSwitchEnabledOnLockScreenState(lockScreenKillSwitch);
      setKillSwitchShowWarningsState(showWarnings);
      setQuickConnectNetworkIdState(quickConnectNetId);
    };
    loadSettings();
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

  const setQuickConnectNetworkId = useCallback(async (networkId: string | null) => {
    await settingsService.setSetting('quickConnectNetworkId', networkId);
    setQuickConnectNetworkIdState(networkId);
  }, []);

  return {
    killSwitchEnabledOnHeader,
    killSwitchEnabledOnLockScreen,
    killSwitchShowWarnings,
    quickConnectNetworkId,
    setKillSwitchEnabledOnHeader,
    setKillSwitchEnabledOnLockScreen,
    setKillSwitchShowWarnings,
    setQuickConnectNetworkId,
  };
};
