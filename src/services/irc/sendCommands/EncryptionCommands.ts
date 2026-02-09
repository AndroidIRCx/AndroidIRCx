/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Encryption-related sendMessage command handlers:
 * SHAREKEY, SENDKEY, REQUESTKEY, ENCMSG, ENC, ENCRYPT, CHANKEY
 */

import { tx } from '../../../i18n/transifex';
import type { SendMessageHandler, SendMessageHandlerRegistry } from '../sendMessageTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** SHAREKEY / SENDKEY - Offer DM encryption key to a nick */
export const handleSHAREKEY: SendMessageHandler = (ctx, args) => {
  const encryptedDMService = ctx.getEncryptedDMService();
  if (args.length > 0) {
    const keyTarget = args[0];
    encryptedDMService.exportBundle().then((bundle: any) => {
      ctx.sendRaw(`PRIVMSG ${keyTarget} :!enc-offer ${JSON.stringify(bundle)}`);
      ctx.addMessage({
        type: 'system',
        channel: keyTarget,
        text: t('*** Encryption key offer sent to {nick}. Waiting for acceptance...', { nick: keyTarget }),
        timestamp: Date.now(),
      });
    }).catch((e: any) => {
      ctx.addMessage({
        type: 'error',
        text: t('*** Failed to share encryption key: {message}', { message: e.message }),
        timestamp: Date.now(),
      });
    });
  } else {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /sharekey <nick>'),
      timestamp: Date.now(),
    });
  }
};

/** REQUESTKEY - Request DM encryption key from a nick */
export const handleREQUESTKEY: SendMessageHandler = (ctx, args) => {
  if (args.length > 0) {
    const reqTarget = args[0];
    ctx.sendRaw(`PRIVMSG ${reqTarget} :!enc-req`);
    ctx.addMessage({
      type: 'system',
      channel: reqTarget,
      text: t('*** Encryption key requested from {nick}', { nick: reqTarget }),
      timestamp: Date.now(),
    });
  } else {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /requestkey <nick>'),
      timestamp: Date.now(),
    });
  }
};

/** ENCMSG - Send an encrypted DM */
export const handleENCMSG: SendMessageHandler = (ctx, args) => {
  const encryptedDMService = ctx.getEncryptedDMService();
  if (args.length >= 2) {
    const encTarget = args[0];
    const encPlaintext = args.slice(1).join(' ');
    const network = ctx.getNetworkName();
    encryptedDMService.encryptForNetwork(encPlaintext, network, encTarget).then((payload: any) => {
      ctx.sendRaw(`PRIVMSG ${encTarget} :!enc-msg ${JSON.stringify(payload)}`);
      ctx.addMessage({
        type: 'message',
        channel: encTarget,
        from: ctx.getCurrentNick(),
        text: t('🔒 {message}', { message: encPlaintext }),
        timestamp: Date.now(),
        status: 'sent',
      });
    }).catch((e: any) => {
      ctx.addMessage({
        type: 'error',
        text: t('*** Encrypted send failed ({message}). Use "Request Encryption Key" from the user menu.', { message: e.message }),
        timestamp: Date.now(),
      });
    });
  } else {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /encmsg <nick> <message>'),
      timestamp: Date.now(),
    });
  }
};

/** ENC / ENCRYPT - Display encryption help text */
export const handleENC: SendMessageHandler = (ctx) => {
  ctx.addMessage({
    type: 'notice',
    text: t('DM encryption:'),
    timestamp: Date.now(),
  });
  ctx.addMessage({
    type: 'notice',
    text: t('/sharekey <nick>          Offer your DM key'),
    timestamp: Date.now(),
  });
  ctx.addMessage({
    type: 'notice',
    text: t('/requestkey <nick>        Request DM key'),
    timestamp: Date.now(),
  });
  ctx.addMessage({
    type: 'notice',
    text: t('/encmsg <nick> <message>  Send encrypted DM'),
    timestamp: Date.now(),
  });
  ctx.addMessage({
    type: 'notice',
    text: t('Tips: keys must be exchanged first; use /requestkey if not paired.'),
    timestamp: Date.now(),
  });
};

/** CHANKEY - Channel encryption key management */
export const handleCHANKEY: SendMessageHandler = (ctx, args, target) => {
  const channelEncryptionService = ctx.getChannelEncryptionService();

  if (args.length === 0) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /chankey <generate|share|request|remove|send|help> [args]'),
      timestamp: Date.now(),
    });
    return;
  }

  const chankeyAction = args[0].toLowerCase();

  switch (chankeyAction) {
    case 'help':
      ctx.addMessage({
        type: 'notice',
        text: t('Channel encryption:'),
        timestamp: Date.now(),
      });
      ctx.addMessage({
        type: 'notice',
        text: t('/chankey generate          Create key for current channel'),
        timestamp: Date.now(),
      });
      ctx.addMessage({
        type: 'notice',
        text: t('/chankey share <nick>     Send key to a user (in channel)'),
        timestamp: Date.now(),
      });
      ctx.addMessage({
        type: 'notice',
        text: t('/chankey request <nick>   Ask a user for the channel key'),
        timestamp: Date.now(),
      });
      ctx.addMessage({
        type: 'notice',
        text: t('/chankey send <msg>       Send encrypted message to channel'),
        timestamp: Date.now(),
      });
      ctx.addMessage({
        type: 'notice',
        text: t('/chankey remove           Delete stored key for channel'),
        timestamp: Date.now(),
      });
      break;

    case 'generate':
      if (!target.startsWith('#') && !target.startsWith('&')) {
        ctx.addMessage({
          type: 'error',
          text: t('*** Channel key can only be generated in a channel'),
          timestamp: Date.now(),
        });
        break;
      }
      channelEncryptionService.generateChannelKey(target, ctx.getNetworkName()).then(() => {
        ctx.addMessage({
          type: 'notice',
          text: t('*** Channel encryption key generated for {channel}. Use /chankey share <nick> to share with others.', { channel: target }),
          timestamp: Date.now(),
        });
      }).catch((e: any) => {
        ctx.addMessage({
          type: 'error',
          text: t('*** Failed to generate channel key: {message}', { message: e.message }),
          timestamp: Date.now(),
        });
      });
      break;

    case 'send':
      if (args.length < 2) {
        ctx.addMessage({
          type: 'error',
          text: t('Usage: /chankey send <message>'),
          timestamp: Date.now(),
        });
        break;
      }
      if (!target.startsWith('#') && !target.startsWith('&')) {
        ctx.addMessage({
          type: 'error',
          text: t('*** Channel key send must be used from a channel'),
          timestamp: Date.now(),
        });
        break;
      }
      {
        const encText = args.slice(1).join(' ');
        channelEncryptionService
          .encryptMessage(encText, target, ctx.getNetworkName())
          .then((payload: any) => {
            ctx.sendRaw(`PRIVMSG ${target} :!chanenc-msg ${JSON.stringify(payload)}`);
            ctx.addMessage({
              type: 'message',
              channel: target,
              from: ctx.getCurrentNick(),
              text: t('🔒 {message}', { message: encText }),
              timestamp: Date.now(),
              status: 'sent',
            });
          })
          .catch((e: any) => {
            ctx.addMessage({
              type: 'error',
              text: t('*** Channel encryption send failed: {message}', {
                message: e.message === 'no channel key'
                  ? t('Missing channel key. Use /chankey generate and share first.')
                  : e.message,
              }),
              timestamp: Date.now(),
            });
          });
      }
      break;

    case 'share':
      if (args.length < 2) {
        ctx.addMessage({
          type: 'error',
          text: t('Usage: /chankey share <nick>'),
          timestamp: Date.now(),
        });
        break;
      }
      if (!target.startsWith('#') && !target.startsWith('&')) {
        ctx.addMessage({
          type: 'error',
          text: t('*** Channel key can only be shared from a channel'),
          timestamp: Date.now(),
        });
        break;
      }
      {
        const shareTarget = args[1];
        channelEncryptionService.exportChannelKey(target, ctx.getNetworkName()).then((keyData: any) => {
          ctx.sendRaw(`PRIVMSG ${shareTarget} :!chanenc-key ${keyData}`);
          ctx.addMessage({
            type: 'notice',
            text: t('*** Channel key for {channel} shared with {nick}', { channel: target, nick: shareTarget }),
            timestamp: Date.now(),
          });
        }).catch((e: any) => {
          ctx.addMessage({
            type: 'error',
            text: t('*** Failed to share channel key: {message}. Generate a key first with /chankey generate', { message: e.message }),
            timestamp: Date.now(),
          });
        });
      }
      break;

    case 'request':
      if (args.length < 2) {
        ctx.addMessage({
          type: 'error',
          text: t('Usage: /chankey request <nick>'),
          timestamp: Date.now(),
        });
        break;
      }
      if (!target.startsWith('#') && !target.startsWith('&')) {
        ctx.addMessage({
          type: 'error',
          text: t('*** Channel key request must be done from a channel'),
          timestamp: Date.now(),
        });
        break;
      }
      {
        const requestTarget = args[1];
        ctx.sendRaw(`PRIVMSG ${requestTarget} :${t('Please share the channel key for {channel} with /chankey share {nick}', { channel: target, nick: ctx.getCurrentNick() })}`);
        ctx.addMessage({
          type: 'notice',
          text: t('*** Channel key requested from {nick} for {channel}', { nick: requestTarget, channel: target }),
          timestamp: Date.now(),
        });
      }
      break;

    case 'remove':
      if (!target.startsWith('#') && !target.startsWith('&')) {
        ctx.addMessage({
          type: 'error',
          text: t('*** Channel key can only be removed from a channel'),
          timestamp: Date.now(),
        });
        break;
      }
      channelEncryptionService.removeChannelKey(target, ctx.getNetworkName()).then(() => {
        ctx.addMessage({
          type: 'notice',
          text: t('*** Channel encryption key removed for {channel}', { channel: target }),
          timestamp: Date.now(),
        });
      }).catch((e: any) => {
        ctx.addMessage({
          type: 'error',
          text: t('*** Failed to remove channel key: {message}', { message: e.message }),
          timestamp: Date.now(),
        });
      });
      break;

    default:
      ctx.addMessage({
        type: 'error',
        text: t('Usage: /chankey <generate|share|request|remove|send|help> [args]'),
        timestamp: Date.now(),
      });
  }
};

export const encryptionCommands: SendMessageHandlerRegistry = new Map([
  ['SHAREKEY', handleSHAREKEY],
  ['SENDKEY', handleSHAREKEY],
  ['REQUESTKEY', handleREQUESTKEY],
  ['ENCMSG', handleENCMSG],
  ['ENC', handleENC],
  ['ENCRYPT', handleENC],
  ['CHANKEY', handleCHANKEY],
]);
