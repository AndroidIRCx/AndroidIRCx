/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback } from 'react';
import { settingsService, IRCNetworkConfig } from '../services/SettingsService';
import { useUIStore } from '../stores/uiStore';

interface UseFirstRunSetupParams {
  setShowFirstRunSetup: (value: boolean) => void;
  handleConnect: (
    network?: IRCNetworkConfig,
    serverId?: string,
    connectNetworkId?: string,
  ) => Promise<void>;
}

export const useFirstRunSetup = (params: UseFirstRunSetupParams) => {
  const { setShowFirstRunSetup, handleConnect } = params;

  const handleFirstRunSetupComplete = useCallback(
    async (networkConfig?: IRCNetworkConfig | null) => {
      setShowFirstRunSetup(false);

      if (!networkConfig) {
        useUIStore.getState().setShowNetworksList(true);
        return;
      }

      console.log(
        'First run setup completed, connecting to:',
        networkConfig.name,
      );

      // Reload networks (the setup saved it already)
      const networks = await settingsService.loadNetworks();
      const savedNetwork = networks.find(n => n.name === networkConfig.name);

      if (savedNetwork) {
        // Connect to the network
        handleConnect(savedNetwork);
      }
    },
    [handleConnect, setShowFirstRunSetup],
  );

  return { handleFirstRunSetupComplete };
};
