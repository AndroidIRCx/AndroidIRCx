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
} from './HelpScreenBase';

interface HelpTroubleshootingScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpTroubleshootingScreen: React.FC<HelpTroubleshootingScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();

  return (
    <HelpScreenBase visible={visible} onClose={onClose} title={t('Troubleshooting Guide')}>
      <HelpSection title={t('Connection Issues')}>
        <HelpSubsection title={t('Can\'t Connect to Server')}>
          <HelpParagraph>{t('Symptoms: Connection timeout, "Unable to connect"')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Check your internet connection')}</HelpBullet>
          <HelpBullet>{t('Verify server address is correct')}</HelpBullet>
          <HelpBullet>{t('Try different port (6667 for non-SSL, 6697 for SSL)')}</HelpBullet>
          <HelpBullet>{t('Disable VPN/proxy temporarily')}</HelpBullet>
          <HelpBullet>{t('Check if firewall is blocking IRC ports')}</HelpBullet>
          <HelpBullet>{t('Try connecting via mobile data instead of WiFi')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Disconnects Frequently')}>
          <HelpParagraph>{t('Symptoms: Random disconnections, "Connection lost"')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Enable auto-reconnect: Settings → Connection & Network → Auto-Reconnect')}</HelpBullet>
          <HelpBullet>{t('Adjust auto-reconnect delays: Settings → Connection & Network → Auto-Reconnect')}</HelpBullet>
          <HelpBullet>{t('Check network stability')}</HelpBullet>
          <HelpBullet>{t('Try different server in same network')}</HelpBullet>
          <HelpBullet>{t('Review lag settings: Settings → Connection & Network → Connection Quality')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('SSL/TLS Errors')}>
          <HelpParagraph>{t('Symptoms: "SSL handshake failed", "Certificate error"')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Verify server supports SSL on that port (usually 6697)')}</HelpBullet>
          <HelpBullet>{t('Try disabling "Verify SSL Certificate" in network settings')}</HelpBullet>
          <HelpBullet>{t('Update to latest app version')}</HelpBullet>
          <HelpBullet>{t('Check server certificate validity')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Authentication Problems')}>
        <HelpSubsection title={t('Nickname Already in Use')}>
          <HelpParagraph>{t('Symptoms: "Nickname is already in use"')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Try alternate nickname')}</HelpBullet>
          <HelpBullet>{t('Wait a few minutes (old session timeout)')}</HelpBullet>
          <HelpBullet>{t('Use /msg NickServ GHOST YourNick password')}</HelpBullet>
          <HelpBullet>{t('Change nickname: dropdown (▼) → Choose Network → Edit → Nickname')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('NickServ Won\'t Identify')}>
          <HelpParagraph>{t('Symptoms: "Password incorrect", Not identified')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Verify password is correct')}</HelpBullet>
          <HelpBullet>{t('Wait for NickServ notice before identifying')}</HelpBullet>
          <HelpBullet>{t('Manually identify: /msg NickServ IDENTIFY password')}</HelpBullet>
          <HelpBullet>{t('Check if account is suspended')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('SASL Authentication Failed')}>
          <HelpParagraph>{t('Symptoms: "SASL authentication failed"')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Verify SASL username and password')}</HelpBullet>
          <HelpBullet>{t('Check if SASL is enabled on server')}</HelpBullet>
          <HelpBullet>{t('Try plain authentication method')}</HelpBullet>
          <HelpBullet>{t('Ensure nickname matches SASL account')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Message Issues')}>
        <HelpSubsection title={t('Messages Not Sending')}>
          <HelpParagraph>{t('Symptoms: Message appears locally but others don\'t see it')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Check if you\'re still connected')}</HelpBullet>
          <HelpBullet>{t('Verify you\'re not banned/quieted')}</HelpBullet>
          <HelpBullet>{t('Check channel modes (+m moderated)')}</HelpBullet>
          <HelpBullet>{t('Ensure you have voice (+v) if channel is moderated')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Keyboard Covers Input')}>
          <HelpParagraph>{t('Symptoms: Keyboard overlaps the message input')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Go to Settings  Display & UI  Keyboard Avoiding')}</HelpBullet>
          <HelpBullet>{t('Android: try Behavior = Height (default) or Padding')}</HelpBullet>
          <HelpBullet>{t('iOS: try Behavior = Padding or Position')}</HelpBullet>
          <HelpBullet>{t('Adjust Keyboard Vertical Offset (e.g., 16-48)')}</HelpBullet>
          <HelpBullet>{t('Android: toggle "Android Bottom Safe Area" for fullscreen vs. inset')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Can\'t See Messages')}>
          <HelpParagraph>{t('Symptoms: Channel appears empty, no messages visible')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Check Settings → Display & UI → Show Raw Commands')}</HelpBullet>
          <HelpBullet>{t('Verify filters in Settings → Messages & History')}</HelpBullet>
          <HelpBullet>{t('Restart app to reload message history')}</HelpBullet>
          <HelpBullet>{t('Check if user is ignored')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Encrypted Messages Show as Gibberish')}>
          <HelpParagraph>{t('Symptoms: Messages display as random characters')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Exchange encryption keys with sender')}</HelpBullet>
          <HelpBullet>{t('Request key: /requestkey TheirNick')}</HelpBullet>
          <HelpBullet>{t('Verify E2EE is enabled')}</HelpBullet>
          <HelpBullet>{t('Check Key Management in Settings')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Channel Problems')}>
        <HelpSubsection title={t('Can\'t Join Channel')}>
          <HelpParagraph>{t('Symptoms: "Cannot join channel", Error 473-475')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('+i (Invite-only): Ask operator for invite')}</HelpBullet>
          <HelpBullet>{t('+k (Key required): Join with password: /join #channel password')}</HelpBullet>
          <HelpBullet>{t('+l (User limit): Wait for space')}</HelpBullet>
          <HelpBullet>{t('+b (Banned): Ask operator to unban you')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Can\'t Send Messages in Channel')}>
          <HelpParagraph>{t('Symptoms: Message rejected, channel is quiet')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Check if channel is moderated (+m)')}</HelpBullet>
          <HelpBullet>{t('Ask operator for voice (+v)')}</HelpBullet>
          <HelpBullet>{t('Check if you\'re banned or quieted')}</HelpBullet>
          <HelpBullet>{t('Verify you\'re still in the channel')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Channel Won\'t Stay Open')}>
          <HelpParagraph>{t('Symptoms: Channel tab closes automatically')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Add it to auto-join: dropdown (▼) → Choose Network → Edit → Auto-Join Channels')}</HelpBullet>
          <HelpBullet>{t('Rejoin channel manually')}</HelpBullet>
          <HelpBullet>{t('Check network connection')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('App Performance')}>
        <HelpSubsection title={t('App is Slow/Laggy')}>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Clear message history cache')}</HelpBullet>
          <HelpBullet>{t('Reduce message batch size: Settings → Performance')}</HelpBullet>
          <HelpBullet>{t('Disable animated emojis/GIFs')}</HelpBullet>
          <HelpBullet>{t('Close unused tabs')}</HelpBullet>
          <HelpBullet>{t('Restart app')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('High Battery Usage')}>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Disable background service')}</HelpBullet>
          <HelpBullet>{t('Reduce notification frequency')}</HelpBullet>
          <HelpBullet>{t('Use WiFi instead of mobile data')}</HelpBullet>
          <HelpBullet>{t('Enable battery optimization')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('App Crashes')}>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Update to latest version')}</HelpBullet>
          <HelpBullet>{t('Clear app cache and data')}</HelpBullet>
          <HelpBullet>{t('Restart device')}</HelpBullet>
          <HelpBullet>{t('Report crash with logs to developers')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Notification Issues')}>
        <HelpSubsection title={t('Not Receiving Notifications')}>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Check notification permissions')}</HelpBullet>
          <HelpBullet>{t('Verify Settings → Notifications → Enabled')}</HelpBullet>
          <HelpBullet>{t('Disable battery optimization for app')}</HelpBullet>
          <HelpBullet>{t('Check Do Not Disturb is off')}</HelpBullet>
          <HelpBullet>{t('Re-enable background service')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Too Many Notifications')}>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Adjust notification filters')}</HelpBullet>
          <HelpBullet>{t('Enable "Highlights only" mode')}</HelpBullet>
          <HelpBullet>{t('Mute specific channels')}</HelpBullet>
          <HelpBullet>{t('Set quiet hours')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Media/File Issues')}>
        <HelpSubsection title={t('Can\'t Send Media')}>
          <HelpParagraph>{t('Symptoms: Attachment button missing/disabled')}</HelpParagraph>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Verify E2EE is enabled for channel/DM')}</HelpBullet>
          <HelpBullet>{t('Enable media feature in Settings')}</HelpBullet>
          <HelpBullet>{t('Exchange encryption keys first')}</HelpBullet>
          <HelpBullet>{t('Check file size (max 50MB)')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Media Won\'t Download')}>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Check internet connection')}</HelpBullet>
          <HelpBullet>{t('Enable auto-download: Settings → Media → Auto-Download Media')}</HelpBullet>
          <HelpBullet>{t('Verify storage permission')}</HelpBullet>
          <HelpBullet>{t('Clear media cache')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Media Appears Encrypted')}>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Request decryption key from sender')}</HelpBullet>
          <HelpBullet>{t('Verify E2EE key exchange')}</HelpBullet>
          <HelpBullet>{t('Check Security → Manage Encryption Keys')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Account & Settings')}>
        <HelpSubsection title={t('Lost PIN/Password')}>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Use biometric unlock if enabled')}</HelpBullet>
          <HelpBullet>{t('Settings → Security → Reset PIN')}</HelpBullet>
          <HelpBullet>{t('Backup/restore may help')}</HelpBullet>
          <HelpBullet>{t('Last resort: Clear app data (loses all data)')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Settings Not Saving')}>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Check storage permission')}</HelpBullet>
          <HelpBullet>{t('Verify storage space available')}</HelpBullet>
          <HelpBullet>{t('Restart app')}</HelpBullet>
          <HelpBullet>{t('Clear app cache')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Backup/Restore Failed')}>
          <HelpParagraph>{t('Solutions:')}</HelpParagraph>
          <HelpBullet>{t('Verify file integrity')}</HelpBullet>
          <HelpBullet>{t('Check storage permission')}</HelpBullet>
          <HelpBullet>{t('Use latest backup file')}</HelpBullet>
          <HelpBullet>{t('Try export/import individually')}</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title={t('Still Need Help?')}>
        <HelpSubsection title={t('Get Support')}>
          <HelpBullet>{t('Join #AndroidIRCX on irc.dbase.in.rs')}</HelpBullet>
          <HelpBullet>{t('Email: support@androidircx.com')}</HelpBullet>
          <HelpBullet>{t('GitHub Issues: github.com/yourrepo/issues')}</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title={t('Gather Information')}>
          <HelpParagraph>{t('Before reporting, collect:')}</HelpParagraph>
          <HelpBullet>{t('App version')}</HelpBullet>
          <HelpBullet>{t('Android version')}</HelpBullet>
          <HelpBullet>{t('Device model')}</HelpBullet>
          <HelpBullet>{t('Error message/screenshot')}</HelpBullet>
          <HelpBullet>{t('Steps to reproduce')}</HelpBullet>
        </HelpSubsection>

        <HelpInfoBox>
          {t('Enable Debug Logging:\\nSettings → Development → Enable Console Logging (debug builds only)\\nSend logs with your report.')}
        </HelpInfoBox>
      </HelpSection>
    </HelpScreenBase>
  );
};
