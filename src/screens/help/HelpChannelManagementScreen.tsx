/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Text } from 'react-native';
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

interface HelpChannelManagementScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpChannelManagementScreen: React.FC<HelpChannelManagementScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();

  return (
    <HelpScreenBase visible={visible} onClose={onClose} title={t('Channel Management Guide')}>
      <HelpSection title={t('Channel Basics')}>
        <HelpSubsection title={t('What is a Channel?')}>
          <HelpParagraph>
            <Text>
              {t('IRC channels are group chat rooms where multiple users can communicate.')}
              {'\n'}
              {t('Channel names start with # (e.g., #DBase).')}
            </Text>
          </HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title={t('Channel Types')}>
          <HelpBullet>{t('Public Channels - Anyone can join')}</HelpBullet>
          <HelpBullet>{t('Private Channels - Require invite')}</HelpBullet>
          <HelpBullet>{t('Secret Channels - Hidden from channel list')}</HelpBullet>
          <HelpBullet>{t('Moderated Channels - Only voiced users can speak')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Creating a Channel')}>
        <HelpSubsection title={t('Join/Create Channel')}>
          <HelpCode>/join #MyChannel</HelpCode>
          <HelpParagraph>
            {t('If the channel doesn\'t exist, you\'ll create it and become the operator.')}
          </HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title={t('Set Channel Topic')}>
          <HelpCode>/topic Welcome to my channel!</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Channel Modes')}>
        <HelpSubsection title={t('User Modes')}>
          <HelpBullet>{t('+o (Operator) - Full channel control')}</HelpBullet>
          <HelpBullet>{t('+v (Voice) - Can speak in moderated channels')}</HelpBullet>
          <HelpBullet>{t('+h (Half-op) - Limited operator powers')}</HelpBullet>
          <HelpBullet>{t('+q (Owner) - Channel owner (some networks)')}</HelpBullet>
          <HelpBullet>{t('+a (Admin) - Channel admin (some networks)')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Give Operator Status')}>
          <HelpCode>/mode #channel +o Nick</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Give Voice')}>
          <HelpCode>/mode #channel +v Nick</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Remove Operator')}>
          <HelpCode>/mode #channel -o Nick</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Channel Settings')}>
        <HelpSubsection title={t('Moderated (+m)')}>
          <HelpParagraph>{t('Only ops and voiced users can speak:')}</HelpParagraph>
          <HelpCode>/mode #channel +m</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Private (+p)')}>
          <HelpParagraph>{t('Channel won\'t appear in /list:')}</HelpParagraph>
          <HelpCode>/mode #channel +p</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Secret (+s)')}>
          <HelpParagraph>{t('Hide channel completely:')}</HelpParagraph>
          <HelpCode>/mode #channel +s</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Invite Only (+i)')}>
          <HelpParagraph>{t('Requires invitation to join:')}</HelpParagraph>
          <HelpCode>/mode #channel +i</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('No External Messages (+n)')}>
          <HelpParagraph>{t('Only members can send messages:')}</HelpParagraph>
          <HelpCode>/mode #channel +n</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Topic Lock (+t)')}>
          <HelpParagraph>{t('Only ops can change topic:')}</HelpParagraph>
          <HelpCode>/mode #channel +t</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('User Limit (+l)')}>
          <HelpParagraph>{t('Set maximum users:')}</HelpParagraph>
          <HelpCode>/mode #channel +l 50</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Channel Key (+k)')}>
          <HelpParagraph>{t('Set password:')}</HelpParagraph>
          <HelpCode>/mode #channel +k mypassword</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Moderation')}>
        <HelpSubsection title={t('Kick User')}>
          <HelpParagraph>{t('Remove user from channel:')}</HelpParagraph>
          <HelpCode>/kick Nick Stop spamming</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Ban User')}>
          <HelpParagraph>{t('Prevent user from rejoining:')}</HelpParagraph>
          <HelpCode>/mode #channel +b Nick!*@*</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Quiet/Mute User')}>
          <HelpParagraph>{t('Prevent user from speaking:')}</HelpParagraph>
          <HelpCode>/mode #channel +q Nick!*@*</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Unban User')}>
          <HelpCode>/mode #channel -b Nick!*@*</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('View Ban List')}>
          <HelpCode>/mode #channel +b</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Advanced Management')}>
        <HelpSubsection title={t('Channel Registration')}>
          <HelpParagraph>{t('Register channel with ChanServ (if available):')}</HelpParagraph>
          <HelpCode>/msg ChanServ REGISTER #channel password description</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Access List')}>
          <HelpParagraph>{t('Add user to channel access list:')}</HelpParagraph>
          <HelpCode>/msg ChanServ ACCESS #channel ADD Nick 10</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Auto-Op')}>
          <HelpParagraph>{t('Set user to auto-op on join:')}</HelpParagraph>
          <HelpCode>/msg ChanServ FLAGS #channel Nick +O</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Best Practices')}>
        <HelpSubsection title={t('Security')}>
          <HelpBullet>{t('Set +n and +t modes for public channels')}</HelpBullet>
          <HelpBullet>{t('Use +i for private channels')}</HelpBullet>
          <HelpBullet>{t('Register your channel with ChanServ')}</HelpBullet>
          <HelpBullet>{t('Keep access list updated')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Moderation')}>
          <HelpBullet>{t('Have at least 2-3 trusted operators')}</HelpBullet>
          <HelpBullet>{t('Clearly communicate channel rules')}</HelpBullet>
          <HelpBullet>{t('Use +q (quiet) before +b (ban) for first offenses')}</HelpBullet>
          <HelpBullet>{t('Document bans with reasons')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Growth')}>
          <HelpBullet>{t('Set clear, welcoming topic')}</HelpBullet>
          <HelpBullet>{t('Make channel public (+p/-s) if you want growth')}</HelpBullet>
          <HelpBullet>{t('Promote on social media or forums')}</HelpBullet>
          <HelpBullet>{t('Keep conversation active and friendly')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Troubleshooting')}>
        <HelpSubsection title={t('Lost operator status')}>
          <HelpParagraph>
            {t('If you\'re the channel founder, ask ChanServ to op you:')}
          </HelpParagraph>
          <HelpCode>/msg ChanServ OP #channel</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Can\'t change modes')}>
          <HelpParagraph>{t('You need operator (+o) status.')}</HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title={t('User keeps rejoining after kick')}>
          <HelpParagraph>{t('Use ban (+b) mode instead.')}</HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title={t('Channel stolen/taken over')}>
          <HelpParagraph>
            {t('Contact network administrators or register the channel with ChanServ.')}
          </HelpParagraph>
        </HelpSubsection>
      </HelpSection>
    </HelpScreenBase>
  );
};
