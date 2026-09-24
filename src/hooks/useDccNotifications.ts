/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect } from 'react';
import { dccFileService } from '../services/DCCFileService';
import { useUIStore } from '../stores/uiStore';
import notifee from '@notifee/react-native';
import { NOTIFICATION_CHANNELS } from '../services/NotificationService';
import { scriptingService } from '../services/ScriptingService';
import { connectionManager } from '../services/ConnectionManager';
import { useTabStore } from '../stores/tabStore';

interface UseDccNotificationsProps {
  safeAlert: (title: string, message: string) => void;
  t: (key: string, params?: any) => string;
  setDccTransfers: (transfers: any[]) => void;
  isMountedRef: React.MutableRefObject<boolean>;
}

/**
 * Send a system notification for DCC transfer completion
 */
async function sendDccNotification(title: string, body: string) {
  try {
    // Create a channel for DCC notifications if it doesn't exist
    const channelId = await notifee.createChannel({
      id: NOTIFICATION_CHANNELS.DCC_TRANSFERS,
      name: 'DCC Transfers',
      importance: 4, // HIGH
    });

    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId,
        smallIcon: 'ic_notification',
        pressAction: {
          id: 'default',
        },
      },
    });
  } catch (error) {
    console.warn('[useDccNotifications] Failed to send notification:', error);
  }
}

/**
 * Hook to handle DCC transfer notifications
 */
export function useDccNotifications({
  safeAlert,
  t,
  setDccTransfers,
  isMountedRef,
}: UseDccNotificationsProps) {
  useEffect(() => {
    const unsub = dccFileService.onTransferUpdate(async transfer => {
      const isMinimized = useUIStore.getState().dccTransfersMinimized;
      const title =
        transfer.status === 'completed'
          ? t('DCC Transfer Complete', {
              _tags: 'screen:app,file:App.tsx,feature:dcc',
            })
          : t('DCC Transfer Failed', {
              _tags: 'screen:app,file:App.tsx,feature:dcc',
            });
      const message =
        transfer.status === 'completed'
          ? t('{filename} received ({bytes} bytes).', {
              filename: transfer.offer.filename,
              bytes: transfer.bytesReceived,
              _tags: 'screen:app,file:App.tsx,feature:dcc',
            })
          : transfer.error ||
            t('Transfer failed.', {
              _tags: 'screen:app,file:App.tsx,feature:dcc',
            });

      // Transfer state/UI is updated before addon display work. A slow or bad
      // addon may delay an alert, but it cannot delay the transfer lifecycle.
      if (isMountedRef.current) {
        const transfers = dccFileService.list();
        setDccTransfers(transfers);
        const activeTransfers = transfers.filter(
          item => item.status === 'downloading' || item.status === 'sending',
        );
        if (isMinimized && activeTransfers.length === 0) {
          useUIStore.getState().setDccTransfersMinimized(false);
        }
      }

      if (transfer.status === 'completed' || transfer.status === 'failed') {
        const display = await scriptingService.handleDccDisplay(transfer);
        const showDefault = display.hideDefaultRequestedBy.length === 0;
        if (showDefault) {
          safeAlert(title, message);
          if (isMinimized) {
            sendDccNotification(title, message);
          }
        }
        display.transformations.forEach(transformation => {
          const result = transformation.result;
          if (result.replacement === undefined) return;
          const routeNetwork = result.routeTo?.network || transfer.networkId;
          const connection =
            connectionManager.getConnection(routeNetwork) ||
            connectionManager.getActiveConnection();
          if (!connection) {
            safeAlert(title, result.replacement);
            return;
          }
          const activeTab = useTabStore.getState().getActiveTab?.();
          const routeTarget = result.routeTo?.target;
          const currentTarget =
            result.routeTo?.kind === 'current' &&
            activeTab?.networkId === routeNetwork &&
            (activeTab.type === 'channel' || activeTab.type === 'query')
              ? activeTab.name
              : undefined;
          connection.ircService.addMessage({
            type: 'notice',
            text: result.replacement,
            timestamp: Date.now(),
            channel:
              result.routeTo?.kind === 'server'
                ? undefined
                : routeTarget || currentTarget,
            addonDisplayStyle: result.style,
            addonDisplayProcessed: true,
          });
        });
      }
    });
    return () => unsub();
  }, [safeAlert, t, setDccTransfers, isMountedRef]);
}
