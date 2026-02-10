/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import {
  HelpScreenBase,
  HelpSection,
  HelpSubsection,
  HelpParagraph,
  HelpBullet,
  HelpCode,
  HelpInfoBox,
  HelpWarningBox,
} from './HelpScreenBase';
import { useT } from '../../i18n/transifex';

interface HelpCommandsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpCommandsScreen: React.FC<HelpCommandsScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();

  return (
    <HelpScreenBase visible={visible} onClose={onClose} title={t('IRC Commands Reference')}>
      <HelpSection title={t('Basic Commands')}>
        <HelpSubsection title="/join <channel>">
          <HelpParagraph>{t('Join an IRC channel')}</HelpParagraph>
          <HelpCode>{t('Example: /join #DBase')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/part [channel] [reason]">
          <HelpParagraph>{t('Leave a channel')}</HelpParagraph>
          <HelpCode>{t('Example: /part #channel Goodbye!')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/msg <nick> <message>">
          <HelpParagraph>{t('Send private message')}</HelpParagraph>
          <HelpCode>{t('Example: /msg John Hello there!')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/query <nick>">
          <HelpParagraph>{t('Open private chat window')}</HelpParagraph>
          <HelpCode>{t('Example: /query John')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/nick <newnick>">
          <HelpParagraph>{t('Change your nickname')}</HelpParagraph>
          <HelpCode>{t('Example: /nick MyNewNick')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/quit [reason]">
          <HelpParagraph>{t('Disconnect from server')}</HelpParagraph>
          <HelpCode>{t('Example: /quit See you later')}</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Channel Management')}>
        <HelpSubsection title="/mode <channel> <+/-mode> [parameters]">
          <HelpParagraph>{t('Change channel modes')}</HelpParagraph>
          <HelpCode>
            {t(
              'Examples:\n/mode #channel +m (moderated)\n/mode #channel +o John (give op)\n/mode #channel +b *!*@spam.com (ban)'
            )}
          </HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/topic [new topic]">
          <HelpParagraph>{t('View or set channel topic')}</HelpParagraph>
          <HelpCode>{t('Example: /topic Welcome to #DBase!')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/kick <nick> [reason]">
          <HelpParagraph>{t('Kick user from channel')}</HelpParagraph>
          <HelpCode>{t('Example: /kick Spammer Stop spamming')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/ban [options] [#channel] <nick|mask> [type] [kick message]">
          <HelpParagraph>
            {t(
              'Ban (and optionally kick/quiet) a user. Usually used in a channel tab so the channel is implied.'
            )}
          </HelpParagraph>
          <HelpCode>
            {t(
              'Examples:\n/ban spammer\n/ban -k spammer Stop spamming\n/ban -q spammer\n/ban #channel spammer'
            )}
          </HelpCode>
          <HelpParagraph>
            {t(
              'Tip: Options are client-side helpers. Common ones are -k (kick), -q (quiet), and -u (auto-unban).'
            )}
          </HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title="/unban <nick|mask> [channel]">
          <HelpParagraph>{t('Remove a ban for a user mask in a channel')}</HelpParagraph>
          <HelpCode>{t('Example: /unban *!*@spam.com')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/kickban <nick> [channel] [reason]">
          <HelpParagraph>{t('Kick and ban a user in one step')}</HelpParagraph>
          <HelpCode>{t('Example: /kickban Spammer Stop spamming')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/invite <nick> [channel]">
          <HelpParagraph>{t('Invite a user to a channel')}</HelpParagraph>
          <HelpCode>{t('Example: /invite FriendNick #DBase')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/hop [channel] [reason]">
          <HelpParagraph>{t('Quickly part and rejoin a channel')}</HelpParagraph>
          <HelpCode>{t('Example: /hop #DBase brb')}</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('User Information')}>
        <HelpSubsection title="/whois <nick>">
          <HelpParagraph>{t('Get information about user')}</HelpParagraph>
          <HelpCode>{t('Example: /whois John')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/whowas <nick>">
          <HelpParagraph>{t('Get past information about user')}</HelpParagraph>
          <HelpCode>{t('Example: /whowas OldNick')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/clones [channel]">
          <HelpParagraph>
            {t(
              'Detect clones (users with same hostname) in a channel. Requires userhost-in-names capability.'
            )}
          </HelpParagraph>
          <HelpCode>{t('Example: /clones #channel')}</HelpCode>
          <HelpCode>{t('Aliases: /dc, /detectclones, /clonesdetect')}</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Action & Formatting')}>
        <HelpSubsection title="/me <action>">
          <HelpParagraph>{t('Send action message')}</HelpParagraph>
          <HelpCode>{t('Example: /me waves hello')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/action <action>">
          <HelpParagraph>{t('Alternative to /me')}</HelpParagraph>
          <HelpCode>{t('Example: /action is away')}</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Encryption Commands')}>
        <HelpSubsection title="/sharekey <nick>">
          <HelpParagraph>{t('Share DM encryption key')}</HelpParagraph>
          <HelpCode>{t('Example: /sharekey Alice')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/requestkey <nick>">
          <HelpParagraph>{t('Request DM encryption key')}</HelpParagraph>
          <HelpCode>{t('Example: /requestkey Bob')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/encmsg <nick> <message>">
          <HelpParagraph>{t('Send encrypted DM')}</HelpParagraph>
          <HelpCode>{t('Example: /encmsg Alice Secret message')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/chankey <action> [params]">
          <HelpParagraph>{t('Channel encryption management')}</HelpParagraph>
          <HelpCode>{t('Examples:\n/chankey generate\n/chankey share Nick1,Nick2\n/chankey status')}</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Advanced')}>
        <HelpSubsection title="/quote <raw command>">
          <HelpParagraph>{t('Send raw IRC command')}</HelpParagraph>
          <HelpCode>{t('Example: /quote NAMES #channel')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/raw <command>">
          <HelpParagraph>{t('Alias for /quote (send a raw IRC command)')}</HelpParagraph>
          <HelpCode>{t('Example: /raw NAMES #channel')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/setname <realname>">
          <HelpParagraph>{t('Change real name')}</HelpParagraph>
          <HelpCode>{t('Example: /setname John Smith')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/bot [on|off]">
          <HelpParagraph>{t('Toggle bot mode')}</HelpParagraph>
          <HelpCode>{t('Example: /bot on')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/register <email|*> <password>">
          <HelpParagraph>
            {t(
              'Register an account using IRCv3 account registration (only if supported by the server).'
            )}
          </HelpParagraph>
          <HelpCode>{t('Example: /register user@example.com mypassword')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/register <account> <email|*> <password>">
          <HelpParagraph>{t('Alternative syntax that includes an explicit account name')}</HelpParagraph>
          <HelpCode>{t('Example: /register MyAccount user@example.com mypassword')}</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Connection & Status')}>
        <HelpSubsection title="/away [message]">
          <HelpParagraph>{t('Set an away message (no message clears away status)')}</HelpParagraph>
          <HelpCode>{t('Example: /away AFK for 10 minutes')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/back">
          <HelpParagraph>{t('Clear away status (same as /away with no message)')}</HelpParagraph>
          <HelpCode>{t('Example: /back')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/reconnect">
          <HelpParagraph>{t('Reconnect to the current server')}</HelpParagraph>
          <HelpCode>{t('Example: /reconnect')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/disconnect [reason]">
          <HelpParagraph>{t('Disconnect from server (alias for /quit)')}</HelpParagraph>
          <HelpCode>{t('Example: /disconnect brb')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/server [-m] [-e] [-t] <address> [port] [password] ...">
          <HelpParagraph>{t('Connect to a server using mIRC-compatible /server parameters')}</HelpParagraph>
          <HelpCode>{t('Example: /server irc.libera.chat 6697')}</HelpCode>
          <HelpCode>
            {t(
              'Tip: In most cases it is easier to add networks/servers via the UI, but /server is useful for quick testing.'
            )}
          </HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Utility Commands')}>
        <HelpSubsection title="/clear">
          <HelpParagraph>{t('Clear messages in the current tab')}</HelpParagraph>
          <HelpCode>{t('Example: /clear')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/close">
          <HelpParagraph>{t('Close the current tab')}</HelpParagraph>
          <HelpCode>{t('Example: /close')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/echo <message>">
          <HelpParagraph>{t('Print a local message (useful for scripts/aliases)')}</HelpParagraph>
          <HelpCode>{t('Example: /echo hello')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/help [command]">
          <HelpParagraph>{t('Show help for a command')}</HelpParagraph>
          <HelpCode>{t('Example: /help ban')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/dns <hostname>">
          <HelpParagraph>{t('Perform a DNS lookup')}</HelpParagraph>
          <HelpCode>{t('Example: /dns irc.libera.chat')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/timer <name> <delayMs> <repetitions> <command>">
          <HelpParagraph>{t('Run a command later, optionally repeated')}</HelpParagraph>
          <HelpCode>{t('Example: /timer ping1 5000 1 /raw PING :test')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/window [-a] <name>">
          <HelpParagraph>{t('Open/create a tab or activate an existing tab')}</HelpParagraph>
          <HelpCode>{t('Examples:\n/window #DBase\n/window -a #DBase')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/filter [-g] <text>">
          <HelpParagraph>{t('Filter messages by text (use -g for global filter)')}</HelpParagraph>
          <HelpCode>{t('Examples:\n/filter error\n/filter -g timeout')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/ignore <nick|mask> [reason]">
          <HelpParagraph>{t('Ignore messages from a user')}</HelpParagraph>
          <HelpCode>{t('Example: /ignore Spammer spamming')}</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="/unignore <nick|mask>">
          <HelpParagraph>{t('Stop ignoring a user')}</HelpParagraph>
          <HelpCode>{t('Example: /unignore Spammer')}</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Services Shortcuts (Aliases)')}>
        <HelpParagraph>
          {t(
            'AndroidIRCX includes convenience aliases that expand into common NickServ/ChanServ commands. These depend on services availability on your network.'
          )}
        </HelpParagraph>

        <HelpSubsection title="NickServ">
          <HelpCode>
            {t(
              'Examples:\n/nsid mypassword\n/nsreg mypassword user@example.com\n/nsghost YourNick mypassword\n/nsrecover YourNick mypassword'
            )}
          </HelpCode>
        </HelpSubsection>

        <HelpSubsection title="ChanServ">
          <HelpCode>
            {t(
              'Examples:\n/csop #channel Nick\n/csdeop #channel Nick\n/cvoice #channel Nick\n/csdevoice #channel Nick\n/csregister #channel password\n/cspass #channel newpassword'
            )}
          </HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpInfoBox>
        {t(
          'Tip: You can also use tab completion to auto-complete commands and nicknames in the message input field.'
        )}
      </HelpInfoBox>

      <HelpWarningBox>
        {t('Some commands may require operator privileges or services support on your network.')}
      </HelpWarningBox>
    </HelpScreenBase>
  );
};
