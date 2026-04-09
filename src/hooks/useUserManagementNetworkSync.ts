/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect } from 'react';
import type { UserManagementService } from '../services/UserManagementService';

interface UseUserManagementNetworkSyncParams {
  networkName: string;
  getActiveUserManagementService: () => UserManagementService;
}

export const useUserManagementNetworkSync = (
  params: UseUserManagementNetworkSyncParams,
) => {
  const { networkName, getActiveUserManagementService } = params;

  useEffect(() => {
    if (networkName && networkName !== 'Not connected') {
      const activeUserMgmt = getActiveUserManagementService();
      activeUserMgmt.setNetwork(networkName);
    }
  }, [networkName, getActiveUserManagementService]);
};
