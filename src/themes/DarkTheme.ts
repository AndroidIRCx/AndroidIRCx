/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/transifex';
import { Theme } from '../services/ThemeService';

const t = (key: string) => tx.t(key);

export const DARK_THEME: Theme = {
  id: 'dark',
  name: t('Dark'),
  isCustom: false,
  colors: {
    background: '#121212',
    surface: '#1E1E1E',
    surfaceVariant: '#2C2C2C',
    surfaceAlt: '#1A1A1A',
    cardBackground: '#1E1E1E',

    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textDisabled: '#666666',

    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#64B5F6',
    onPrimary: '#FFFFFF',

    secondary: '#FF9800',
    onSecondary: '#FFFFFF',

    accent: '#4CAF50',
    onAccent: '#FFFFFF',

    success: '#4CAF50',
    error: '#B91C1C',
    warning: '#DC2626',
    info: '#2196F3',

    border: '#333333',
    borderLight: '#2A2A2A',
    divider: '#2A2A2A',

    messageBackground: '#1E1E1E',
    messageText: '#E0E0E0',
    messageNick: '#64B5F6',
    messageTimestamp: '#757575',

    systemMessage: '#9E9E9E',
    noticeMessage: '#FF9800',
    joinMessage: '#4CAF50',
    partMessage: '#F97316',
    quitMessage: '#B91C1C',
    kickMessage: '#B91C1C',
    nickMessage: '#1976D2',
    inviteMessage: '#2196F3',
    monitorMessage: '#1E3A8A',
    topicMessage: '#9C27B0',
    modeMessage: '#5DADE2',
    actionMessage: '#9E9E9E',
    rawMessage: '#B0B0B0',
    ctcpMessage: '#4CAF50',

    inputBackground: '#2C2C2C',
    inputText: '#FFFFFF',
    inputBorder: '#333333',
    inputPlaceholder: '#757575',

    buttonPrimary: '#2196F3',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#424242',
    buttonSecondaryText: '#FFFFFF',
    buttonDisabled: '#2C2C2C',
    buttonDisabledText: '#666666',
    buttonText: '#FFFFFF',

    tabActive: '#2196F3',
    tabInactive: '#1E1E1E',
    tabActiveText: '#FFFFFF',
    tabInactiveText: '#B0B0B0',
    tabBorder: '#333333',

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#1E1E1E',
    modalText: '#FFFFFF',

    userListBackground: '#1A1A1A',
    userListText: '#E0E0E0',
    userListBorder: '#2A2A2A',
    userOwner: '#9C27B0',     // ~ purple
    userAdmin: '#F44336',     // & red
    userOp: '#FF9800',        // @ orange
    userHalfop: '#2196F3',    // % blue
    userVoice: '#4CAF50',     // + green
    userNormal: '#E0E0E0',
    highlightBackground: 'rgba(33, 150, 243, 0.2)',
    highlightText: '#FFEB3B',       // Yellow text for mentions
    selectionBackground: 'rgba(33, 150, 243, 0.12)'
  },
};