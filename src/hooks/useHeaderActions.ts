/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';
import { debugLogger } from '../services/DebugLogger';

export const useHeaderActions = () => {
  const handleDropdownPress = useCallback(() => {
    debugLogger.debug('headerActions', 'Dropdown menu pressed');
    const setShowOptionsMenu = useUIStore.getState().setShowOptionsMenu;
    setShowOptionsMenu(true);
    debugLogger.debug('headerActions', 'Options menu state set to true');
  }, []);

  const handleMenuPress = useCallback(() => {
    debugLogger.debug('headerActions', 'Hamburger menu pressed');
    useUIStore.getState().setShowSettings(true);
    debugLogger.debug('headerActions', 'Settings state updated', useUIStore.getState().showSettings);
  }, []);

  const handleToggleUserList = useCallback(() => {
    const currentValue = useUIStore.getState().showUserList;
    const setShowUserList = useUIStore.getState().setShowUserList;
    setShowUserList(!currentValue);
  }, []);

  return {
    handleDropdownPress,
    handleMenuPress,
    handleToggleUserList,
  };
};
