/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import {
  HelpScreenBase,
  HelpSection,
  HelpParagraph,
  HelpBullet,
} from './HelpScreenBase';
import { useT } from '../../i18n/transifex';

interface HelpProtectionScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpProtectionScreen: React.FC<HelpProtectionScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();

  return (
    <HelpScreenBase
      visible={visible}
      onClose={onClose}
      title={t('Protection & Anti-Flood')}
    >
      <HelpSection title={t('Overview')}>
        <HelpParagraph>
          {t(
            'AndroidIRCX can automatically ignore, block, or punish spammers, flooders, and people attacking your channels. Find these under Settings > Protection (Anti-Spam and Flood / DOS tabs).',
          )}
        </HelpParagraph>
      </HelpSection>

      <HelpSection title={t('Anti-Spam')}>
        <HelpBullet>
          {t(
            'Anti-spam on private messages - filter unwanted PMs (When open, or Always)',
          )}
        </HelpBullet>
        <HelpBullet>
          {t('Spam keywords - words or patterns that mark a message as spam')}
        </HelpBullet>
        <HelpBullet>
          {t('Anti-spam on channels - also filter channel messages')}
        </HelpBullet>
        <HelpBullet>
          {t('Logging in SPAM.log - record caught spam to a log file')}
        </HelpBullet>
      </HelpSection>

      <HelpSection title={t('Flood Protection')}>
        <HelpBullet>
          {t(
            'CTCP / Text / DCC / Query flood - block rapid bursts used to lag or annoy you',
          )}
        </HelpBullet>
        <HelpBullet>
          {t('Exclude protections on - let specific tokens through')}
        </HelpBullet>
      </HelpSection>

      <HelpSection title={t('Channel Attack Defenses')}>
        <HelpBullet>
          {t(
            'Anti deop/ban/kick - defend against attackers removing your ops, banning, or kicking you',
          )}
        </HelpBullet>
        <HelpBullet>
          {t('Using ChanServ - restore channel modes via ChanServ')}
        </HelpBullet>
        <HelpBullet>
          {t('Block Tsunamis - stop garbage-character channel floods')}
        </HelpBullet>
        <HelpBullet>
          {t('D.O.S. attacks - detect denial-of-service patterns')}
        </HelpBullet>
      </HelpSection>

      <HelpSection title={t('Enforcement (operators)')}>
        <HelpBullet>
          {t('Enforce with /silence - block users server-side')}
        </HelpBullet>
        <HelpBullet>
          {t(
            'IRCop auto action - if you are an operator, automatically BAN/KILL/KLINE/GLINE spam or flood',
          )}
        </HelpBullet>
      </HelpSection>

      <HelpSection title={t('Ban Masks & Kick Reasons')}>
        <HelpBullet>
          {t(
            'Default Ban Type - mask style used when you ban (a specific person vs a whole host or domain)',
          )}
        </HelpBullet>
        <HelpBullet>
          {t('Predefined Kick/Ban Reasons - reusable reasons to pick from')}
        </HelpBullet>
        <HelpBullet>
          {t('Show Ban Mask Preview - confirm the mask before it is applied')}
        </HelpBullet>
      </HelpSection>
    </HelpScreenBase>
  );
};
