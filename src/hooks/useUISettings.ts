/**
 * useUISettings Hook
 *
 * Loads and syncs UI-related settings from storage to UI store:
 * - Raw command visibility and categories
 * - Message visibility (join/part/quit messages)
 * - Auto-switch and tab sorting preferences
 * - Encryption indicator visibility
 * - Auto-connect preferences
 */

import { useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';
import { settingsService } from '../services/SettingsService';
import { scriptingService } from '../services/ScriptingService';
import { getDefaultRawCategoryVisibility, RawMessageCategory } from '../services/IRCService';

interface UseUISettingsProps {
  setAutoSwitchPrivate: (value: boolean) => void;
  setTabSortAlphabetical: (value: boolean) => void;
  setShowEncryptionIndicators: (value: boolean) => void;
  setAutoConnectFavoriteServer: (value: boolean) => void;
}

export function useUISettings({
  setAutoSwitchPrivate,
  setTabSortAlphabetical,
  setShowEncryptionIndicators,
  setAutoConnectFavoriteServer,
}: UseUISettingsProps) {

  /**
   * Normalize raw category visibility to ensure all categories have a boolean value
   */
  const normalizeRawCategoryVisibility = useCallback(
    (savedValue: Partial<Record<RawMessageCategory, boolean>> | undefined) => {
      const defaults = getDefaultRawCategoryVisibility();
      return {
        ...defaults,
        ...savedValue,
      };
    },
    []
  );

  // Effect: Load raw command settings on mount
  useEffect(() => {
    const loadSetting = async () => {
      const savedValue = await settingsService.getSetting('showRawCommands', true);
      const savedCategories = await settingsService.getSetting(
        'rawCategoryVisibility',
        getDefaultRawCategoryVisibility()
      );

      const store = useUIStore.getState();
      store.setShowRawCommands(savedValue);
      store.setRawCategoryVisibility(normalizeRawCategoryVisibility(savedCategories));
    };

    loadSetting();

    // Initialize scripting service
    scriptingService.initialize();
  }, [normalizeRawCategoryVisibility]);

  // Effect: Load message visibility settings and listen for changes
  useEffect(() => {
    const loadMessageVisibility = async () => {
      const store = useUIStore.getState();

      // Load message visibility settings
      store.setHideJoinMessages(
        await settingsService.getSetting('hideJoinMessages', false)
      );
      store.setHidePartMessages(
        await settingsService.getSetting('hidePartMessages', false)
      );
      store.setHideQuitMessages(
        await settingsService.getSetting('hideQuitMessages', false)
      );
      store.setHideIrcServiceListenerMessages(
        await settingsService.getSetting('hideIrcServiceListenerMessages', true)
      );

      // Load other UI settings (these aren't in UI store yet, so use setters)
      setAutoSwitchPrivate(
        await settingsService.getSetting('autoSwitchPrivate', false)
      );
      setTabSortAlphabetical(
        await settingsService.getSetting('tabSortAlphabetical', true)
      );
      setShowEncryptionIndicators(
        await settingsService.getSetting('showEncryptionIndicators', true)
      );
      setAutoConnectFavoriteServer(
        await settingsService.getSetting('autoConnectFavoriteServer', false)
      );
    };

    loadMessageVisibility();

    // Subscribe to setting changes
    const unsubJoin = settingsService.onSettingChange('hideJoinMessages', (v: boolean) => {
      useUIStore.getState().setHideJoinMessages(Boolean(v));
    });

    const unsubPart = settingsService.onSettingChange('hidePartMessages', (v: boolean) => {
      useUIStore.getState().setHidePartMessages(Boolean(v));
    });

    const unsubQuit = settingsService.onSettingChange('hideQuitMessages', (v: boolean) => {
      useUIStore.getState().setHideQuitMessages(Boolean(v));
    });

    const unsubListenerHide = settingsService.onSettingChange(
      'hideIrcServiceListenerMessages',
      (v: boolean) => {
        useUIStore.getState().setHideIrcServiceListenerMessages(Boolean(v));
      }
    );

    const unsubAutoFavorite = settingsService.onSettingChange(
      'autoConnectFavoriteServer',
      (v: boolean) => setAutoConnectFavoriteServer(Boolean(v))
    );

    return () => {
      unsubJoin && unsubJoin();
      unsubPart && unsubPart();
      unsubQuit && unsubQuit();
      unsubListenerHide && unsubListenerHide();
      unsubAutoFavorite && unsubAutoFavorite();
    };
  }, [
    setAutoSwitchPrivate,
    setTabSortAlphabetical,
    setShowEncryptionIndicators,
    setAutoConnectFavoriteServer,
  ]);
}
