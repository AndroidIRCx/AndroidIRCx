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

interface HelpConnectionScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpConnectionScreen: React.FC<HelpConnectionScreenProps> = ({
  visible,
  onClose,
}) => {
  return (
    <HelpScreenBase visible={visible} onClose={onClose} title="IRC Connection Guide">
      <HelpSection title="Quick Start">
        <HelpParagraph>Follow these simple steps to connect to an IRC server:</HelpParagraph>
        <HelpBullet>1. Tap the dropdown (▼) in the header</HelpBullet>
        <HelpBullet>2. Choose "Choose Network" (or "Connect Another Network")</HelpBullet>
        <HelpBullet>3. Tap the [+] button to add a network</HelpBullet>
        <HelpBullet>4. Save, then tap the network name to connect</HelpBullet>
      </HelpSection>

      <HelpSection title="Detailed Guide">
        <HelpSubsection title="Step 1: Open the Networks list">
          <HelpBullet>Tap the dropdown (▼) in the header</HelpBullet>
          <HelpBullet>Select "Choose Network" (or "Connect Another Network" if connected)</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Step 2: Add a network">
          <HelpParagraph>Tap the [+] button in the Networks header to open Network Settings:</HelpParagraph>
          <HelpBullet>Network Name: Friendly name (e.g., "DBase")</HelpBullet>
          <HelpBullet>Nickname + Real Name: Required identity fields</HelpBullet>
          <HelpBullet>Alt Nick + Ident: Optional fallbacks</HelpBullet>
          <HelpBullet>Auto-Join Channels: Optional list like "#lobby, #help"</HelpBullet>
          <HelpBullet>Save with the [Save] button in the header</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Step 3: Add a server (optional)">
          <HelpParagraph>In the Networks list, tap "+ Add Server" under your network:</HelpParagraph>
          <HelpBullet>Hostname: e.g., irc.dbase.in.rs</HelpBullet>
          <HelpBullet>Port: 6697 (SSL) or 6667 (plain)</HelpBullet>
          <HelpBullet>Use SSL/TLS: Recommended</HelpBullet>
          <HelpBullet>Server Password / Favorite Server: Optional</HelpBullet>
          <HelpBullet>Tap [Save]</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Step 4: Set identity profiles (advanced)">
          <HelpParagraph>Identity profiles are managed in Settings:</HelpParagraph>
          <HelpBullet>Tap the ☰ menu → Settings</HelpBullet>
          <HelpBullet>Open "Connection & Network"</HelpBullet>
          <HelpBullet>Tap "Identity Profiles"</HelpBullet>
          <HelpBullet>Select a network, then "+ Add / Edit Identity"</HelpBullet>
          <HelpBullet>Save and select the profile for that network</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Step 5: Connect">
          <HelpBullet>Open the Networks list again (dropdown → "Choose Network")</HelpBullet>
          <HelpBullet>Tap the network name to connect</HelpBullet>
          <HelpBullet>Or tap a specific server under that network to connect to it</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Quick Connect Tips">
        <HelpBullet>When disconnected, tap the network name in the header to connect</HelpBullet>
        <HelpBullet>Use dropdown → "Connect to Default" for a one-tap connect</HelpBullet>
      </HelpSection>

      <HelpSection title="Popular IRC Networks">
        <HelpSubsection title="DBase IRC (Recommended)">
          <HelpCode>Server: irc.dbase.in.rs{'\n'}Port: 6697 (SSL){'\n'}Channels: #DBase, #AndroidIRCX{'\n'}Description: Serbian IRC network with tech community</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="Libera.Chat">
          <HelpCode>Server: irc.libera.chat{'\n'}Port: 6697 (SSL){'\n'}Description: Free software and open source community</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="OFTC">
          <HelpCode>Server: irc.oftc.net{'\n'}Port: 6697 (SSL){'\n'}Description: Open and Free Technology Community</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Troubleshooting">
        <HelpSubsection title="Connection Failed">
          <HelpBullet>Check your internet connection</HelpBullet>
          <HelpBullet>Verify server address and port</HelpBullet>
          <HelpBullet>Try disabling SSL/TLS</HelpBullet>
          <HelpBullet>Check if firewall is blocking IRC ports</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Nickname Already in Use">
          <HelpBullet>Use your alternate nickname</HelpBullet>
          <HelpBullet>Register your nickname with NickServ</HelpBullet>
          <HelpBullet>Choose a different nickname</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Can't Join Channels">
          <HelpBullet>Some channels require registration</HelpBullet>
          <HelpBullet>Channel may be invite-only (+i mode)</HelpBullet>
          <HelpBullet>You may be banned from the channel</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Need More Help?">
        <HelpInfoBox>
          Join #AndroidIRCX on irc.dbase.in.rs{'\n'}
          Visit our website: androidircx.com{'\n'}
          Email: support@androidircx.com
        </HelpInfoBox>
      </HelpSection>
    </HelpScreenBase>
  );
};
