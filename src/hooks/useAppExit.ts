/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { backgroundService } from '../services/BackgroundService';
import {
  settingsService,
  DEFAULT_QUIT_MESSAGE,
} from '../services/SettingsService';
import { messageHistoryBatching } from '../services/MessageHistoryBatching';

interface UseAppExitParams {
  isConnected: boolean;
  getActiveIRCService: () => any;
  safeAlert: (title: string, message?: string, buttons?: any) => void;
  t: (key: string, options?: any) => string;
}

export const useAppExit = (params: UseAppExitParams) => {
  const { isConnected, getActiveIRCService, safeAlert, t } = params;

  const handleExit = useCallback(async () => {
    safeAlert(
      t('Exit Application', { _tags: 'screen:app,file:App.tsx,feature:exit' }),
      t(
        'Are you sure you want to exit? This will disconnect from the server.',
        {
          _tags: 'screen:app,file:App.tsx,feature:exit',
        },
      ),
      [
        {
          text: t('Cancel', { _tags: 'screen:app,file:App.tsx,feature:exit' }),
          style: 'cancel',
        },
        {
          text: t('Exit', { _tags: 'screen:app,file:App.tsx,feature:exit' }),
          style: 'destructive',
          onPress: async () => {
            try {
              // Disconnect gracefully if connected
              if (isConnected) {
                const activeIRCService = getActiveIRCService();
                const quitMessage = await settingsService.getSetting(
                  'quitMessage',
                  DEFAULT_QUIT_MESSAGE,
                );
                await activeIRCService.disconnect(quitMessage);
                // Wait a bit for disconnect to complete
                await new Promise<void>(resolve => setTimeout(resolve, 500));
              }
              // Flush any pending message history writes
              await messageHistoryBatching.flushSync().catch(err => {
                console.error('Error flushing message history on exit:', err);
              });
              // Cleanup services
              backgroundService.cleanup();
              // Exit the app
              if (Platform.OS === 'android') {
                BackHandler.exitApp();
              } else {
                // iOS doesn't support programmatic exit, but we can disconnect
                safeAlert(
                  t('Disconnected', {
                    _tags: 'screen:app,file:App.tsx,feature:exit',
                  }),
                  t('You can now close the app from the app switcher.', {
                    _tags: 'screen:app,file:App.tsx,feature:exit',
                  }),
                );
              }
            } catch (error) {
              console.error('Error during exit:', error);
              // Still try to exit
              if (Platform.OS === 'android') {
                BackHandler.exitApp();
              }
            }
          },
        },
      ],
    );
  }, [getActiveIRCService, isConnected, safeAlert, t]);

  return { handleExit };
};
