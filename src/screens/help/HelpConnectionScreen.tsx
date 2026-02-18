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
} from './HelpScreenBase';
import { useT } from '../../i18n/transifex';

interface HelpConnectionScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpConnectionScreen: React.FC<HelpConnectionScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();

  return (
    <HelpScreenBase visible={visible} onClose={onClose} title={t('IRC Connection Guide')}>
      <HelpSection title={t('Quick Start')}>
        <HelpParagraph>{t('Follow these simple steps to connect to an IRC server:')}</HelpParagraph>
        <HelpBullet>{t('1. Tap the dropdown (▼) in the header')}</HelpBullet>
        <HelpBullet>{t('2. Choose "Choose Network" (or "Connect Another Network")')}</HelpBullet>
        <HelpBullet>{t('3. Tap the [+] button to add a network')}</HelpBullet>
        <HelpBullet>{t('4. Save, then tap the network name to connect')}</HelpBullet>
      </HelpSection>

      <HelpSection title={t('Detailed Guide')}>
        <HelpSubsection title={t('Step 1: Open the Networks list')}>
          <HelpBullet>{t('Tap the dropdown (▼) in the header')}</HelpBullet>
          <HelpBullet>{t('Select "Choose Network" (or "Connect Another Network" if connected)')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Step 2: Add a network')}>
          <HelpParagraph>{t('Tap the [+] button in the Networks header to open Network Settings:')}</HelpParagraph>
          <HelpBullet>{t('Network Name: Friendly name (e.g., "DBase")')}</HelpBullet>
          <HelpBullet>{t('Nickname + Real Name: Required identity fields')}</HelpBullet>
          <HelpBullet>{t('Alt Nick + Ident: Optional fallbacks')}</HelpBullet>
          <HelpBullet>{t('Auto-Join Channels: Optional list like "#lobby, #help"')}</HelpBullet>
          <HelpBullet>{t('Save with the [Save] button in the header')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Step 3: Add a server (optional)')}>
          <HelpParagraph>{t('In the Networks list, tap "+ Add Server" under your network:')}</HelpParagraph>
          <HelpBullet>{t('Hostname: e.g., irc.dbase.in.rs')}</HelpBullet>
          <HelpBullet>{t('Port: 6697 (SSL) or 6667 (plain)')}</HelpBullet>
          <HelpBullet>{t('Use SSL/TLS: Recommended')}</HelpBullet>
          <HelpBullet>{t('Server Password / Favorite Server: Optional')}</HelpBullet>
          <HelpBullet>{t('Tap [Save]')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Step 4: Set identity profiles (advanced)')}>
          <HelpParagraph>{t('Identity profiles are managed in Settings:')}</HelpParagraph>
          <HelpBullet>{t('Tap the ☰ menu → Settings')}</HelpBullet>
          <HelpBullet>{t('Open "Connection & Network"')}</HelpBullet>
          <HelpBullet>{t('Tap "Identity Profiles"')}</HelpBullet>
          <HelpBullet>{t('Select a network, then "+ Add / Edit Identity"')}</HelpBullet>
          <HelpBullet>{t('Save and select the profile for that network')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Step 5: Connect')}>
          <HelpBullet>{t('Open the Networks list again (dropdown → "Choose Network")')}</HelpBullet>
          <HelpBullet>{t('Tap the network name to connect')}</HelpBullet>
          <HelpBullet>{t('Or tap a specific server under that network to connect to it')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Quick Connect Tips')}>
        <HelpBullet>{t('When disconnected, tap the network name in the header to connect')}</HelpBullet>
        <HelpBullet>{t('Use dropdown → "Connect to Default" for a one-tap connect')}</HelpBullet>
      </HelpSection>

      <HelpSection title={t('Popular IRC Networks')}>
        <HelpSubsection title={t('DBase IRC (Recommended)')}>
          <HelpCode>Server: irc.dbase.in.rs{'\n'}Port: 6697 (SSL){'\n'}Channels: #DBase, #AndroidIRCX{'\n'}Description: Serbian IRC network with tech community</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('Libera.Chat')}>
          <HelpCode>Server: irc.libera.chat{'\n'}Port: 6697 (SSL){'\n'}Description: Free software and open source community</HelpCode>
        </HelpSubsection>

        <HelpSubsection title={t('OFTC')}>
          <HelpCode>Server: irc.oftc.net{'\n'}Port: 6697 (SSL){'\n'}Description: Open and Free Technology Community</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Troubleshooting')}>
        <HelpSubsection title={t('Connection Failed')}>
          <HelpBullet>{t('Check your internet connection')}</HelpBullet>
          <HelpBullet>{t('Verify server address and port')}</HelpBullet>
          <HelpBullet>{t('Try disabling SSL/TLS')}</HelpBullet>
          <HelpBullet>{t('Check if firewall is blocking IRC ports')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Nickname Already in Use')}>
          <HelpBullet>{t('Use your alternate nickname')}</HelpBullet>
          <HelpBullet>{t('Register your nickname with NickServ')}</HelpBullet>
          <HelpBullet>{t('Choose a different nickname')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Can\'t Join Channels')}>
          <HelpBullet>{t('Some channels require registration')}</HelpBullet>
          <HelpBullet>{t('Channel may be invite-only (+i mode)')}</HelpBullet>
          <HelpBullet>{t('You may be banned from the channel')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Need More Help?')}>
        <HelpInfoBox>
          <Text style={{ lineHeight: 22 }}>
            {t('Join #AndroidIRCX on irc.dbase.in.rs')}
            {'\n'}
            {t('Visit our website: androidircx.com')}
            {'\n'}
            {t('Email: support@androidircx.com')}
          </Text>
        </HelpInfoBox>
      </HelpSection>
    </HelpScreenBase>
  );
};
