/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/transifex';
import { Theme } from '../services/ThemeService';

const t = (key: string) => tx.t(key);

export const LIGHT_THEME: Theme = {
  id: 'light',
  name: t('Light'),
  isCustom: false,
  colors: {
    background: '#FFFFFF',
    surface: '#FAFAFA',
    surfaceVariant: '#F5F5F5',
    surfaceAlt: '#FFFFFF',
    cardBackground: '#FFFFFF',

    text: '#212121',
    textSecondary: '#757575',
    textDisabled: '#9E9E9E',

    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#64B5F6',
    onPrimary: '#FFFFFF',

    secondary: '#FF9800',
    onSecondary: '#FFFFFF',

    accent: '#4CAF50',
    onAccent: '#FFFFFF',

    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',

    border: '#E0E0E0',
    borderLight: '#F5F5F5',
    divider: '#E0E0E0',

    messageBackground: '#FFFFFF',
    messageText: '#212121',
    messageNick: '#1976D2',
    messageTimestamp: '#9E9E9E',

    systemMessage: '#757575',
    noticeMessage: '#FF9800',
    joinMessage: '#4CAF50',
    partMessage: '#FF9800',
    quitMessage: '#F44336',
    kickMessage: '#F44336',
    nickMessage: '#1976D2',
    inviteMessage: '#2196F3',
    monitorMessage: '#2196F3',
    topicMessage: '#9C27B0',
    modeMessage: '#5DADE2',
    actionMessage: '#9E9E9E',
    rawMessage: '#757575',
    ctcpMessage: '#388E3C',

    inputBackground: '#F5F5F5',
    inputText: '#212121',
    inputBorder: '#E0E0E0',
    inputPlaceholder: '#9E9E9E',

    buttonPrimary: '#2196F3',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#E0E0E0',
    buttonSecondaryText: '#212121',
    buttonDisabled: '#F5F5F5',
    buttonDisabledText: '#9E9E9E',
    buttonText: '#FFFFFF',

    tabActive: '#2196F3',
    tabInactive: '#F5F5F5',
    tabActiveText: '#FFFFFF',
    tabInactiveText: '#757575',
    tabBorder: '#E0E0E0',

    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#FFFFFF',
    modalText: '#212121',

    userListBackground: '#FAFAFA',
    userListText: '#212121',
    userListBorder: '#E0E0E0',
    userOwner: '#7B1FA2',     // ~ purple (darker for light theme)
    userAdmin: '#D32F2F',     // & red (darker for light theme)
    userOp: '#F57C00',        // @ orange (darker for light theme)
    userHalfop: '#1976D2',    // % blue (darker for light theme)
    userVoice: '#388E3C',     // + green (darker for light theme)
    userNormal: '#212121',
    highlightBackground: 'rgba(33, 150, 243, 0.1)',
    highlightText: '#FF6F00',       // Orange text for mentions (darker for light theme)
    selectionBackground: 'rgba(33, 150, 243, 0.12)',
  },
};