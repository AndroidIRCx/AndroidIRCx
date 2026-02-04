/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/transifex';
import { Theme, ThemeColors, ThemeMessageFormats } from '../services/ThemeService';

const t = (key: string) => tx.t(key);

export const IRCAP_THEME: Theme = {
  id: 'ircap',
  name: t('IRcap Theme'),
  isCustom: false,
  colors: {
    background: "#E6E6E6",
    surface: "#6B6B6B",
    surfaceVariant: "#8A8A8A",
    surfaceAlt: "#FFFFFF",
    cardBackground: "#FFFFFF",
    text: "#1A1A1A",
    textSecondary: "#000000",
    textDisabled: "#9E9E9E",
    primary: "#000000",
    primaryDark: "#0F766E",
    primaryLight: "#64B5F6",
    onPrimary: "#FFFFFF",
    secondary: "#FF9800",
    onSecondary: "#FFFFFF",
    accent: "#4CAF50",
    onAccent: "#FFFFFF",
    success: "#16A34A",
    error: "#B91C1C",
    warning: "#DC2626",
    info: "#1A1A1A",
    border: "#E0E0E0",
    borderLight: "#F5F5F5",
    divider: "#E0E0E0",
    messageBackground: "#B0B0B0",
    messageText: "#212121",
    messageNick: "#0F766E",
    messageTimestamp: "#000000",
    systemMessage: "#4A4A4A",
    noticeMessage: "#212121",
    joinMessage: "#A855F7",
    partMessage: "#F97316",
    quitMessage: "#B91C1C",
    kickMessage: "#B91C1C",
    nickMessage: "#1976D2",
    inviteMessage: "#212121",
    monitorMessage: "#1E3A8A",
    topicMessage: "#212121",
    modeMessage: "#5C5C5C",
    actionMessage: "#7C3AED",
    rawMessage: "#212121",
    ctcpMessage: "#212121",
    inputBackground: "#F5F5F5",
    inputText: "#212121",
    inputBorder: "#E0E0E0",
    inputPlaceholder: "#9E9E9E",
    buttonPrimary: "#2196F3",
    buttonPrimaryText: "#FFFFFF",
    buttonSecondary: "#E0E0E0",
    buttonSecondaryText: "#212121",
    buttonDisabled: "#F5F5F5",
    buttonDisabledText: "#9E9E9E",
    buttonText: "#FFFFFF",
    tabActive: "#2D2D2D",
    tabInactive: "#F5F5F5",
    tabActiveText: "#FFFFFF",
    tabInactiveText: "#757575",
    tabBorder: "#E0E0E0",
    modalOverlay: "rgba(0, 0, 0, 0.5)",
    modalBackground: "#FFFFFF",
    modalText: "#212121",
    userListBackground: "#FAFAFA",
    userListText: "#212121",
    userListBorder: "#E0E0E0",
    userOwner: "#B91C1C",
    userAdmin: "#B91C1C",
    userOp: "#B91C1C",
    userHalfop: "#B91C1C",
    userVoice: "#212121",
    userNormal: "#212121",
    highlightBackground: "rgba(33, 150, 243, 0.1)",
    highlightText: "#000000",
    selectionBackground: "rgba(33, 150, 243, 0.12)"
  },
  messageFormats: {
    message: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "]",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#000074"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "text",
        "value": "¦",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "token",
        "value": "message"
      }
    ],
    messageMention: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "]",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#000074",
          "bold": true
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "text",
        "value": "¦",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "token",
        "value": "message"
      }
    ],
    action: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "]",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "text",
        "value": "*",
        "style": {
          "color": "#740074"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#740074"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "text",
        "value": "¦",
        "style": {
          "color": "#740074"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "token",
        "value": "message",
        "style": {
          "color": "#740074"
        }
      }
    ],
    actionMention: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "]",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "text",
        "value": "*",
        "style": {
          "color": "#740074",
          "bold": false
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#740074",
          "bold": true
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "text",
        "value": "¦",
        "style": {
          "color": "#740074",
          "bold": false
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "token",
        "value": "message",
        "style": {
          "color": "#740074",
          "bold": false
        }
      }
    ],
    notice: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "]",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "text",
        "value": "-",
        "style": {
          "bold": false,
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "(",
        "style": {
          "bold": true,
          "color": "#000000"
        }
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": ")",
        "style": {
          "bold": true,
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "-",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "text",
        "value": "-",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "token",
        "value": "message",
        "style": {
          "color": "#000000"
        }
      }
    ],
    event: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "]",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " => ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "¦ ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "message",
        "style": {}
      },
      {
        "type": "text",
        "value": "]",
        "style": {
          "color": "#0063b5"
        }
      }
    ],
    join: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "->",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ¦ ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#5C5C5C",
          "bold": true
        }
      },
      {
        "type": "text",
        "value": " [",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "username",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": "@",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "hostname",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": "]",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": ` ${t('enters')}`,
        "style": {
          "color": "#5C5C5C"
        }
      }
    ],
    part: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "<-",
        "style": {
          "color": "#740074"
        }
      },
      {
        "type": "text",
        "value": " ¦ ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": " [",
        "style": {
          "color": "#740074"
        }
      },
      {
        "type": "token",
        "value": "username",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": "@",
        "style": {
          "color": "#740074"
        }
      },
      {
        "type": "token",
        "value": "hostname",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": "]",
        "style": {
          "color": "#740074"
        }
      },
      {
        "type": "text",
        "value": ` ${t('leaves')}`,
        "style": {
          "color": "#5C5C5C"
        }
      }
    ],
    quit: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "<-",
        "style": {
          "color": "#7F0000"
        }
      },
      {
        "type": "text",
        "value": " ¦ ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": " [",
        "style": {
          "color": "#7F0000"
        }
      },
      {
        "type": "token",
        "value": "username",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": "@",
        "style": {
          "color": "#7F0000"
        }
      },
      {
        "type": "token",
        "value": "hostname",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": "]",
        "style": {
          "color": "#7F0000"
        }
      },
      {
        "type": "text",
        "value": ` ${t('closes')}`,
        "style": {
          "color": "#5C5C5C"
        }
      }
    ],
    kick: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "=>",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ¦ ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "target",
        "style": {
          "color": "#b50000"
        }
      },
      {
        "type": "text",
        "value": ` ${t('kicked_by')} `,
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": " [",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "reason",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": " ]",
        "style": {
          "color": "#0063b5"
        }
      }
    ],
    nick: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "=>",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ¦ ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "oldnick",
        "style": {
          "color": "#5C5C5C",
          "bold": true
        }
      },
      {
        "type": "text",
        "value": ` ${t('now_known_as')} `,
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "token",
        "value": "newnick",
        "style": {
          "color": "#0063b5"
        }
      }
    ],
    invite: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "-",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": "(",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "username",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": "@",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "hostname",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": ")",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "- ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": ` ${t('invites_you_to')} `,
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "token",
        "value": "channel",
        "style": {
          "bold": true
        }
      }
    ],
    monitor: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "=> ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": ` ${t('joined_monitor_list')}`,
        "style": {
          "color": "#000074"
        }
      }
    ],
    mode: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "=>",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ¦ ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": ` ${t('sets_mode')}`,
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": " [",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "mode",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "token",
        "value": "account",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": " ",
        "style": {}
      },
      {
        "type": "text",
        "value": "]",
        "style": {
          "color": "#0063b5"
        }
      }
    ],
    topic: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "=>",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": " ¦ ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "text",
        "value": ` ${t('sets_topic')}: `,
        "style": {
          "color": "#5C5C5C"
        }
      },
      {
        "type": "token",
        "value": "message",
        "style": {}
      }
    ],
    raw: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "*** ",
        "style": {}
      },
      {
        "type": "text",
        "value": "RAW ",
        "style": {}
      },
      {
        "type": "token",
        "value": "numeric",
        "style": {}
      },
      {
        "type": "text",
        "value": ":",
        "style": {}
      },
      {
        "type": "text",
        "value": "* ",
        "style": {}
      },
      {
        "type": "token",
        "value": "message"
      }
    ],
    error: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#7F7F7F"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "message"
      }
    ],
    ctcp: [
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "time",
        "style": {
          "color": "#000000"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "--> ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "CTCP ",
        "style": {
          "color": "#000074"
        }
      },
      {
        "type": "text",
        "value": "[",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "nick",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "text",
        "value": "] ",
        "style": {
          "color": "#0063b5"
        }
      },
      {
        "type": "token",
        "value": "message"
      }
    ]
  },
  // Preporučena podešavanja za optimalan izgled IRcap teme
  recommendedSettings: {
    // Appearance
    tabPosition: 'bottom',
    userListSize: 98,
    userListNickFontSize: 13,
    nickListTongueSize: 8,
    fontSize: 'medium',
    messageSpacing: 2,
    messagePadding: 4,
    navigationBarOffset: 0,
    
    // Display & UI
    noticeRouting: 'server',
    showTimestamps: true,
    groupMessages: false,
    messageTextAlignment: 'left',
    messageTextDirection: 'auto',
    timestampDisplay: 'always',
    timestampFormat: '24h',
    bannerPosition: 'above_header',
    keyboardBehavior: 'height',
  },
};
