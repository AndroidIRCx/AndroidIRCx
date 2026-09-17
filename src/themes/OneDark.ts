/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * "One Dark" built-in theme — the classic Atom / VS Code One Dark palette.
 *
 * A calm, low-contrast dark scheme built on the Gray/Slate `#282C34`
 * background with the signature One Dark accents (blue `#61AFEF`, green
 * `#98C379`, red `#E06C75`, yellow `#E5C07B`, purple `#C678DD`, cyan
 * `#56B6C2`, orange `#D19A66`). Structure mirrors the stock Dark theme with
 * the blue `#61AFEF` accent, and it uses the restrained "minimal" message
 * format preset to suit the muted palette.
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeMinimalFormats } from './formats';
import { withAlpha } from './palette';

const t = (key: string) => tx.t(key);

// One Dark signature accent — reused for highlight and selection washes.
const ONE_DARK_BLUE = '#61AFEF';

export const ONE_DARK_THEME: Theme = {
  id: 'one-dark',
  name: t('One Dark'),
  isCustom: false,
  colors: {
    background: '#282C34',
    surface: '#3A3F4B',
    surfaceVariant: '#21252B',
    surfaceAlt: '#2C313A',
    cardBackground: '#3A3F4B',

    text: '#ABB2BF',
    textSecondary: '#5C6370',
    textDisabled: '#4B5263',

    primary: '#61AFEF',
    primaryDark: '#4D8FCC',
    primaryLight: '#8CC6F5',
    onPrimary: '#282C34',

    secondary: '#D19A66',
    onSecondary: '#282C34',

    accent: '#98C379',
    onAccent: '#282C34',

    success: '#98C379',
    error: '#E06C75',
    warning: '#E5C07B',
    info: '#56B6C2',

    border: '#3E4451',
    borderLight: '#333842',
    divider: '#333842',

    messageBackground: '#3A3F4B',
    messageText: '#ABB2BF',
    messageNick: '#61AFEF',
    messageTimestamp: '#5C6370',

    systemMessage: '#5C6370',
    noticeMessage: '#E5C07B',
    joinMessage: '#98C379',
    partMessage: '#D19A66',
    quitMessage: '#E06C75',
    kickMessage: '#E06C75',
    nickMessage: '#61AFEF',
    inviteMessage: '#56B6C2',
    monitorMessage: '#56B6C2',
    topicMessage: '#C678DD',
    modeMessage: '#56B6C2',
    actionMessage: '#C678DD',
    rawMessage: '#5C6370',
    ctcpMessage: '#56B6C2',

    inputBackground: '#21252B',
    inputText: '#ABB2BF',
    inputBorder: '#3E4451',
    inputPlaceholder: '#5C6370',

    buttonPrimary: '#61AFEF',
    buttonPrimaryText: '#282C34',
    buttonSecondary: '#3A3F4B',
    buttonSecondaryText: '#ABB2BF',
    buttonDisabled: '#21252B',
    buttonDisabledText: '#4B5263',
    buttonText: '#ABB2BF',

    tabActive: '#61AFEF',
    tabInactive: '#3A3F4B',
    tabActiveText: '#ABB2BF',
    tabInactiveText: '#5C6370',
    tabBorder: '#3E4451',

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#3A3F4B',
    modalText: '#ABB2BF',

    userListBackground: '#2C313A',
    userListText: '#ABB2BF',
    userListBorder: '#333842',
    userOwner: '#C678DD', // ~ owner (purple)
    userAdmin: '#E06C75', // & admin (red)
    userOp: '#D19A66', // @ op (orange)
    userHalfop: '#56B6C2', // % halfop (cyan)
    userVoice: '#98C379', // + voice (green)
    userNormal: '#ABB2BF',
    highlightBackground: withAlpha(ONE_DARK_BLUE, 0.2),
    highlightText: '#E5C07B',
    selectionBackground: withAlpha(ONE_DARK_BLUE, 0.12),
  },
  messageFormats: makeMinimalFormats({
    timestamp: '#5C6370',
    punctuation: '#5C6370',
    nick: '#61AFEF',
    action: '#C678DD',
    notice: '#E5C07B',
    join: '#98C379',
    part: '#D19A66',
    quit: '#E06C75',
    kick: '#E06C75',
    nickChange: '#61AFEF',
    event: '#5C6370',
    muted: '#5C6370',
  }),
};
