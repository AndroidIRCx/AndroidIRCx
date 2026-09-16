/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * "Matrix Light" — the Matrix green terminal look inverted onto white paper.
 * Green ink on a white page: every role and message type stays in the green
 * family, with distinct green shades so channel roles remain distinguishable.
 * Body text (#0A3D0A on #FFFFFF) clears WCAG AA with a very high margin.
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeClassicMircFormats } from './formats';
import { darken, lighten, withAlpha } from './palette';

const t = (key: string) => tx.t(key);

// Signature Matrix green — every accent and role derives from this.
const MATRIX_GREEN = '#008F11';

export const MATRIX_LIGHT_THEME: Theme = {
  id: 'matrix-light',
  name: t('Matrix Light'),
  isCustom: false,
  colors: {
    background: '#FFFFFF',
    surface: '#F2FFF2',
    surfaceVariant: '#E6FFE6',
    surfaceAlt: '#FFFFFF',
    cardBackground: '#FFFFFF',

    text: '#0A3D0A',
    textSecondary: '#4E9A4E',
    textDisabled: '#9CC79C',

    primary: MATRIX_GREEN,
    primaryDark: darken(MATRIX_GREEN, 0.25),
    primaryLight: lighten(MATRIX_GREEN, 0.3),
    onPrimary: '#FFFFFF',

    secondary: '#2E7D32',
    onSecondary: '#FFFFFF',

    accent: MATRIX_GREEN,
    onAccent: '#FFFFFF',

    success: '#00701A',
    error: '#B71C1C', // a red is acceptable for errors even here
    warning: '#E65100',
    info: '#00701A',

    border: '#CDE6CD',
    borderLight: '#E6F2E6',
    divider: '#CDE6CD',

    messageBackground: '#FFFFFF',
    messageText: '#0A3D0A',
    messageNick: MATRIX_GREEN,
    messageTimestamp: '#6AA06A',

    systemMessage: '#4E9A4E',
    noticeMessage: '#1B5E20',
    joinMessage: '#00701A',
    partMessage: '#2E7D32',
    quitMessage: '#558B2F',
    kickMessage: '#558B2F',
    nickMessage: MATRIX_GREEN,
    inviteMessage: '#00701A',
    monitorMessage: '#00701A',
    topicMessage: '#2E7D32',
    modeMessage: '#00701A',
    actionMessage: '#2E7D32',
    rawMessage: '#4E9A4E',
    ctcpMessage: '#00701A',

    inputBackground: '#F2FFF2',
    inputText: '#0A3D0A',
    inputBorder: '#CDE6CD',
    inputPlaceholder: '#9CC79C',

    buttonPrimary: MATRIX_GREEN,
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#E6FFE6',
    buttonSecondaryText: '#0A3D0A',
    buttonDisabled: '#F2FFF2',
    buttonDisabledText: '#9CC79C',
    buttonText: '#FFFFFF',

    tabActive: MATRIX_GREEN,
    tabInactive: '#E6FFE6',
    tabActiveText: '#FFFFFF',
    tabInactiveText: '#4E9A4E',
    tabBorder: '#CDE6CD',

    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#FFFFFF',
    modalText: '#0A3D0A',

    userListBackground: '#F2FFF2',
    userListText: '#0A3D0A',
    userListBorder: '#CDE6CD',
    userOwner: '#004D00', // ~ owner (darkest green)
    userAdmin: '#00701A', // & admin
    userOp: MATRIX_GREEN, // @ op
    userHalfop: '#2E7D32', // % halfop
    userVoice: '#4E9A4E', // + voice (lightest green)
    userNormal: '#0A3D0A',
    highlightBackground: withAlpha(MATRIX_GREEN, 0.12),
    highlightText: '#E65100', // orange for contrast against green
    selectionBackground: withAlpha(MATRIX_GREEN, 0.12),
  },
  messageFormats: makeClassicMircFormats({
    timestamp: '#6AA06A',
    punctuation: '#4E9A4E',
    nick: '#008F11',
    action: '#2E7D32',
    notice: '#1B5E20',
    join: '#00701A',
    part: '#2E7D32',
    quit: '#558B2F',
    kick: '#558B2F',
    nickChange: '#008F11',
    event: '#4E9A4E',
    muted: '#6AA06A',
  }),
};
