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
    <HelpScreenBase
      visible={visible}
      onClose={onClose}
      title={t('Encryption Guide')}
    >
      <HelpSection title={t('What is E2EE?')}>
        <HelpParagraph>
          {t(
            'End-to-End Encryption ensures that only you and the recipient can read messages.\\nEven the IRC server cannot decrypt them.',
          )}
        </HelpParagraph>
      </HelpSection>

      <HelpSection title={t('DM (Direct Message) Encryption')}>
        <HelpSubsection title={t('Step 1: Generate Keys')}>
          <HelpParagraph>
            {t(
              'Encryption keys are automatically generated when you install AndroidIRCX.',
            )}
          </HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title={t('Step 2: Share Your Key')}>
          <HelpParagraph>{t('To start encrypted conversation:')}</HelpParagraph>
          <HelpBullet>{t('Open private chat: /query Nick')}</HelpBullet>
          <HelpBullet>{t('Share your key: /sharekey Nick')}</HelpBullet>
          <HelpBullet>{t('Wait for them to share their key')}</HelpBullet>
          <HelpBullet>
            {t('Messages are now automatically encrypted 🔒')}
          </HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t("Request Someone's Key")}>
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
          <HelpParagraph>{t("Remove someone's access:")}</HelpParagraph>
          <HelpCode>/chankey revoke Nick</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Sharing keys in person')}>
        <HelpParagraph>
          {t(
            'Encryption keys are generated automatically when you install the app. To exchange them in person, open a private chat and tap the encryption menu (the lock icon).',
          )}
        </HelpParagraph>
        <HelpInfoBox>
          {t(
            'In-person exchange methods are turned on under Settings → Security (Allow QR Verification, Allow File Key Exchange, Allow NFC Key Exchange).',
          )}
        </HelpInfoBox>

        <HelpSubsection title={t('QR code')}>
          <HelpBullet>
            {t(
              'Tap "Share Key Bundle QR" to display your key, and have the other person tap "Scan QR Code" to import it.',
            )}
          </HelpBullet>
          <HelpBullet>
            {t(
              'To verify an existing key, tap "Show Fingerprint QR (Verify)", scan it on the other phone, and if the fingerprints match tap "Mark Verified".',
            )}
          </HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('NFC (phone to phone)')}>
          <HelpBullet>{t('On one phone, tap "Share via NFC".')}</HelpBullet>
          <HelpBullet>
            {t('On the other phone, tap "Receive via NFC".')}
          </HelpBullet>
          <HelpBullet>
            {t('Hold the two phones back to back until they connect.')}
          </HelpBullet>
          <HelpBullet>
            {t(
              'The receiver taps "Accept" on the "Import DM Key" prompt to save the key.',
            )}
          </HelpBullet>
          <HelpInfoBox>
            {t(
              'If NFC is turned off, the app opens your NFC settings so you can enable it, then try again.',
            )}
          </HelpInfoBox>
        </HelpSubsection>

        <HelpSubsection title={t('Key file')}>
          <HelpBullet>
            {t(
              'Tap "Share Key File" to export your key, then send the file however you like.',
            )}
          </HelpBullet>
          <HelpBullet>
            {t('The other person taps "Import Key File" to load it.')}
          </HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Device security')}>
        <HelpBullet>
          {t(
            'App Lock: require a PIN or biometric to open the app (Settings → Security).',
          )}
        </HelpBullet>
        <HelpBullet>
          {t(
            'Kill Switch: instantly disconnect from everything, optionally wiping your data (Settings → Security).',
          )}
        </HelpBullet>
        <HelpBullet>
          {t('Screenshot protection: block screenshots while the app is open.')}
        </HelpBullet>
      </HelpSection>

      <HelpSection title={t('Security Best Practices')}>
        <HelpSuccessBox>
          {t(
            '✅ Verify key fingerprints out-of-band (phone call)\n✅ Rotate channel keys periodically\n✅ Only share keys with trusted users\n✅ Keep your device secure with PIN/biometric lock',
          )}
        </HelpSuccessBox>

        <HelpWarningBox>
          {t(
            "❌ Don't share keys over unencrypted channels\n❌ Don't share keys publicly\n❌ Don't ignore key verification warnings\n❌ Don't leave encrypted channels unattended",
          )}
        </HelpWarningBox>
      </HelpSection>

      <HelpSection title={t('Troubleshooting')}>
        <HelpSubsection title={t('Messages appear as gibberish')}>
          <HelpParagraph>
            {t("The sender hasn't shared their encryption key with you yet.")}
          </HelpParagraph>
          <HelpParagraph>{t('Solution:')}</HelpParagraph>
          <HelpCode>/requestkey TheirNick</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t("Can't decrypt old messages")}>
          <HelpParagraph>
            {t(
              'You joined the channel after messages were sent, or key was rotated.',
            )}
          </HelpParagraph>
          <HelpParagraph>
            {t('Solution: Ask channel operator to reshare the key.')}
          </HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title={t('Lock icon not showing')}>
          <HelpParagraph>
            {t('Encryption may be disabled or keys not exchanged.')}
          </HelpParagraph>
          <HelpParagraph>
            {t(
              'Solution: Check Settings → Display & UI → Show Encryption Indicators',
            )}
          </HelpParagraph>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Key Management')}>
        <HelpInfoBox>
          {t(
            'View and manage your keys in:\nSettings → Security → Manage Encryption Keys',
          )}
        </HelpInfoBox>
      </HelpSection>
    </HelpScreenBase>
  );
};
