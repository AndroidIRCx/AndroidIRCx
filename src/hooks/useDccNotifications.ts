/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect } from 'react';
import { dccFileService } from '../services/DCCFileService';
import { useUIStore } from '../stores/uiStore';
import notifee from '@notifee/react-native';
import { NOTIFICATION_CHANNELS } from '../services/NotificationService';

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
    const unsub = dccFileService.onTransferUpdate((transfer) => {
      const isMinimized = useUIStore.getState().dccTransfersMinimized;
      const title = transfer.status === 'completed'
        ? t('DCC Transfer Complete', { _tags: 'screen:app,file:App.tsx,feature:dcc' })
        : t('DCC Transfer Failed', { _tags: 'screen:app,file:App.tsx,feature:dcc' });
      const message = transfer.status === 'completed'
        ? t('{filename} received ({bytes} bytes).', {
            filename: transfer.offer.filename,
            bytes: transfer.bytesReceived,
            _tags: 'screen:app,file:App.tsx,feature:dcc',
          })
        : transfer.error || t('Transfer failed.', { _tags: 'screen:app,file:App.tsx,feature:dcc' });

      if (transfer.status === 'completed') {
        // Show in-app alert
        safeAlert(title, message);

        // If minimized, also send a system notification
        if (isMinimized) {
          sendDccNotification(title, message);
        }
      } else if (transfer.status === 'failed') {
        safeAlert(title, message);

        // If minimized, also send a system notification
        if (isMinimized) {
          sendDccNotification(title, message);
        }
      }

      if (isMountedRef.current) {
        const transfers = dccFileService.list();
        setDccTransfers(transfers);

        // Auto-restore modal if minimized and no more active transfers
        const activeTransfers = transfers.filter(
          t => t.status === 'downloading' || t.status === 'sending'
        );
        if (isMinimized && activeTransfers.length === 0) {
          useUIStore.getState().setDccTransfersMinimized(false);
        }
      }
    });
    return () => unsub();
  }, [safeAlert, t, setDccTransfers, isMountedRef]);
}
