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

interface HelpMediaScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpMediaScreen: React.FC<HelpMediaScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();

  return (
    <HelpScreenBase visible={visible} onClose={onClose} title={t('Media Sharing Guide')}>
      <HelpSection title={t('Overview')}>
        <HelpParagraph>
          {t('AndroidIRCX supports end-to-end encrypted media sharing:')}
        </HelpParagraph>
        <HelpBullet>{t('📷 Photos (camera or gallery)')}</HelpBullet>
        <HelpBullet>{t('🎥 Videos (camera or gallery)')}</HelpBullet>
        <HelpBullet>{t('🎤 Voice messages')}</HelpBullet>
        <HelpBullet>{t('📁 Files')}</HelpBullet>
      </HelpSection>

      <HelpSection title={t('Requirements')}>
        <HelpBullet>{t('E2EE must be enabled for the channel/DM')}</HelpBullet>
        <HelpBullet>{t('Both sender and recipient must have exchanged encryption keys')}</HelpBullet>
        <HelpBullet>{t('Internet connection for upload/download')}</HelpBullet>
      </HelpSection>

      <HelpSection title={t('How to Send Media')}>
        <HelpSubsection title={t('Step 1: Enable Media Feature')}>
          <HelpBullet>{t('Open Settings (☰ menu)')}</HelpBullet>
          <HelpBullet>{t('Go to "Media"')}</HelpBullet>
          <HelpBullet>{t('Enable "Enable Encrypted Media Sharing"')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Step 2: Send Photo')}>
          <HelpBullet>{t('Open encrypted channel or DM (must have 🔒 icon)')}</HelpBullet>
          <HelpBullet>{t('Tap the 📎 attachment button')}</HelpBullet>
          <HelpBullet>{t('Select "Photo" or "Camera"')}</HelpBullet>
          <HelpBullet>{t('Choose or take photo')}</HelpBullet>
          <HelpBullet>{t('Add optional caption')}</HelpBullet>
          <HelpBullet>{t('Tap "Send"')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Step 3: Send Video')}>
          <HelpBullet>{t('Tap 📎 attachment button')}</HelpBullet>
          <HelpBullet>{t('Select "Video" or "Record Video"')}</HelpBullet>
          <HelpBullet>{t('Choose or record video')}</HelpBullet>
          <HelpBullet>{t('Preview and add caption')}</HelpBullet>
          <HelpBullet>{t('Tap "Send"')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Step 4: Voice Message')}>
          <HelpBullet>{t('Tap 📎 attachment button')}</HelpBullet>
          <HelpBullet>{t('Select "Voice Message"')}</HelpBullet>
          <HelpBullet>{t('Record your message')}</HelpBullet>
          <HelpBullet>{t('Preview and send')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('How to Receive Media')}>
        <HelpSubsection title={t('Automatic Download')}>
          <HelpParagraph>{t('By default, media is downloaded automatically on WiFi.')}</HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title={t('Manual Download')}>
          <HelpParagraph>{t('If auto-download is disabled:')}</HelpParagraph>
          <HelpBullet>{t('Tap the media message')}</HelpBullet>
          <HelpBullet>{t('Tap "Download" button')}</HelpBullet>
          <HelpBullet>{t('Wait for decryption')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('View Media')}>
          <HelpBullet>{t('Tap image/video to open in full screen')}</HelpBullet>
          <HelpBullet>{t('Pinch to zoom images')}</HelpBullet>
          <HelpBullet>{t('Play/pause videos')}</HelpBullet>
          <HelpBullet>{t('Save to gallery (if enabled)')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Settings')}>
        <HelpSubsection title={t('Media Quality')}>
          <HelpParagraph>{t('Settings → Media → Media Quality')}</HelpParagraph>
          <HelpBullet>{t('Original - Full quality (larger file)')}</HelpBullet>
          <HelpBullet>{t('High - 90% quality')}</HelpBullet>
          <HelpBullet>{t('Medium - 70% quality')}</HelpBullet>
          <HelpBullet>{t('Low - 50% quality (smaller file)')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Auto-Download')}>
          <HelpParagraph>{t('Settings → Media → Auto-Download Media')}</HelpParagraph>
          <HelpBullet>{t('WiFi only (recommended)')}</HelpBullet>
          <HelpBullet>{t('WiFi + Mobile Data')}</HelpBullet>
          <HelpBullet>{t('Never (manual only)')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Storage')}>
          <HelpParagraph>{t('Settings → Media → Maximum Cache Size / Clear Media Cache')}</HelpParagraph>
          <HelpBullet>{t('View cache size')}</HelpBullet>
          <HelpBullet>{t('Clear cache')}</HelpBullet>
          <HelpBullet>{t('Set max cache size')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Privacy & Security')}>
        <HelpSubsection title={t('Encryption')}>
          <HelpBullet>{t('All media is encrypted with XChaCha20-Poly1305 before upload')}</HelpBullet>
          <HelpBullet>{t('Encryption keys are only shared with authorized recipients')}</HelpBullet>
          <HelpBullet>{t('Server cannot decrypt media')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Metadata')}>
          <HelpBullet>{t('Original filename is encrypted')}</HelpBullet>
          <HelpBullet>{t('EXIF data is stripped from photos')}</HelpBullet>
          <HelpBullet>{t('GPS location is removed')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Troubleshooting')}>
        <HelpSubsection title={t('Can\'t see attachment button')}>
          <HelpBullet>{t('Check if channel/DM has encryption enabled (🔒 icon)')}</HelpBullet>
          <HelpBullet>{t('Enable media feature in Settings')}</HelpBullet>
          <HelpBullet>{t('Exchange encryption keys first')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Upload failed')}>
          <HelpBullet>{t('Check internet connection')}</HelpBullet>
          <HelpBullet>{t('Check file size (max 50MB)')}</HelpBullet>
          <HelpBullet>{t('Try reducing quality')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Download failed')}>
          <HelpBullet>{t('Check internet connection')}</HelpBullet>
          <HelpBullet>{t('Check storage space')}</HelpBullet>
          <HelpBullet>{t('Try clearing media cache')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Media appears as \'Encrypted data\'')}>
          <HelpBullet>{t('You don\'t have the decryption key')}</HelpBullet>
          <HelpBullet>{t('Request key from sender')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>
    </HelpScreenBase>
  );
};
