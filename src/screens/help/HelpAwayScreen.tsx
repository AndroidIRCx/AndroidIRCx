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
import { useT } from '../../i18n/localization';

interface HelpAwayScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpAwayScreen: React.FC<HelpAwayScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();

  return (
    <HelpScreenBase
      visible={visible}
      onClose={onClose}
      title={t('Away & Presence')}
    >
      <HelpSection title={t('Overview')}>
        <HelpParagraph>
          {t(
            'Mark yourself away with a short reason so people know you are not around, and clear it when you return. Everything below is in Settings > Away.',
          )}
        </HelpParagraph>
      </HelpSection>

      <HelpSection title={t('Going Away')}>
        <HelpBullet>
          {t('Go Away Now / Return - set or clear your away status')}
        </HelpBullet>
        <HelpBullet>
          {t('Default away reason - the message sent when you go away')}
        </HelpBullet>
        <HelpBullet>
          {t('Away presets - save reusable away reasons')}
        </HelpBullet>
      </HelpSection>

      <HelpSection title={t('Auto-Away')}>
        <HelpBullet>
          {t('Auto-away - automatically go away after a set idle time')}
        </HelpBullet>
        <HelpBullet>
          {t('Auto-away minutes / reason - when it triggers and what it says')}
        </HelpBullet>
      </HelpSection>

      <HelpSection title={t('Away Behaviors')}>
        <HelpBullet>
          {t('Change nick to a pattern (e.g. me^away) while away')}
        </HelpBullet>
        <HelpBullet>{t('Notify me if my nick is mentioned')}</HelpBullet>
        <HelpBullet>{t('De-op on channels while away')}</HelpBullet>
        <HelpBullet>
          {t('Announce away status in channels at an interval')}
        </HelpBullet>
        <HelpBullet>
          {t(
            'Auto-answer - automatically reply to private messages while away',
          )}
        </HelpBullet>
        <HelpBullet>{t('Disable notification sounds while away')}</HelpBullet>
        <HelpBullet>
          {t('Multiserver - apply away to all connected networks at once')}
        </HelpBullet>
      </HelpSection>
    </HelpScreenBase>
  );
};
