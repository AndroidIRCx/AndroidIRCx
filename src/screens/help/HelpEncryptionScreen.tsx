/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { useT } from '../../i18n/transifex';
import {
  HelpScreenBase,
  HelpSection,
  HelpSubsection,
  HelpParagraph,
  HelpBullet,
  HelpCode,
  HelpInfoBox,
  HelpWarningBox,
  HelpSuccessBox,
} from './HelpScreenBase';

interface HelpEncryptionScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpEncryptionScreen: React.FC<HelpEncryptionScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();

  return (
    <HelpScreenBase visible={visible} onClose={onClose} title={t('Encryption Guide')}>
      <HelpSection title={t('What is E2EE?')}>
        <HelpParagraph>
          {t('End-to-End Encryption ensures that only you and the recipient can read messages.\\nEven the IRC server cannot decrypt them.')}
        </HelpParagraph>
      </HelpSection>

      <HelpSection title={t('DM (Direct Message) Encryption')}>
        <HelpSubsection title={t('Step 1: Generate Keys')}>
          <HelpParagraph>
            {t('Encryption keys are automatically generated when you install AndroidIRCX.')}
          </HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title={t('Step 2: Share Your Key')}>
          <HelpParagraph>{t('To start encrypted conversation:')}</HelpParagraph>
          <HelpBullet>{t('Open private chat: /query Nick')}</HelpBullet>
          <HelpBullet>{t('Share your key: /sharekey Nick')}</HelpBullet>
          <HelpBullet>{t('Wait for them to share their key')}</HelpBullet>
          <HelpBullet>{t('Messages are now automatically encrypted 🔒')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Request Someone\'s Key')}>
          <HelpCode>/requestkey Nick</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Channel Encryption')}>
        <HelpSubsection title={t('Generate Channel Key')}>
          <HelpParagraph>{t('As a channel operator:')}</HelpParagraph>
          <HelpCode>/chankey generate</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Share Channel Key')}>
          <HelpParagraph>{t('Share key with trusted members:')}</HelpParagraph>
          <HelpCode>/chankey share Nick1,Nick2,Nick3</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Check Encryption Status')}>
          <HelpCode>/chankey status</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Revoke Access')}>
          <HelpParagraph>{t('Remove someone\'s access:')}</HelpParagraph>
          <HelpCode>/chankey revoke Nick</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Security Best Practices')}>
        <HelpSuccessBox>
          {t(
            '✅ Verify key fingerprints out-of-band (phone call)\n✅ Rotate channel keys periodically\n✅ Only share keys with trusted users\n✅ Keep your device secure with PIN/biometric lock'
          )}
        </HelpSuccessBox>

        <HelpWarningBox>
          {t(
            "❌ Don't share keys over unencrypted channels\n❌ Don't share keys publicly\n❌ Don't ignore key verification warnings\n❌ Don't leave encrypted channels unattended"
          )}
        </HelpWarningBox>
      </HelpSection>

      <HelpSection title={t('Troubleshooting')}>
        <HelpSubsection title={t('Messages appear as gibberish')}>
          <HelpParagraph>{t('The sender hasn\'t shared their encryption key with you yet.')}</HelpParagraph>
          <HelpParagraph>{t('Solution:')}</HelpParagraph>
          <HelpCode>/requestkey TheirNick</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Can\'t decrypt old messages')}>
          <HelpParagraph>
            {t('You joined the channel after messages were sent, or key was rotated.')}
          </HelpParagraph>
          <HelpParagraph>{t('Solution: Ask channel operator to reshare the key.')}</HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title={t('Lock icon not showing')}>
          <HelpParagraph>{t('Encryption may be disabled or keys not exchanged.')}</HelpParagraph>
          <HelpParagraph>{t('Solution: Check Settings → Display & UI → Show Encryption Indicators')}</HelpParagraph>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Key Management')}>
        <HelpInfoBox>
          {t('View and manage your keys in:\nSettings → Security → Manage Encryption Keys')}
        </HelpInfoBox>
      </HelpSection>
    </HelpScreenBase>
  );
};
