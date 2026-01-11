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
  return (
    <HelpScreenBase visible={visible} onClose={onClose} title="Encryption Guide">
      <HelpSection title="What is E2EE?">
        <HelpParagraph>
          End-to-End Encryption ensures that only you and the recipient can read messages.
          Even the IRC server cannot decrypt them.
        </HelpParagraph>
      </HelpSection>

      <HelpSection title="DM (Direct Message) Encryption">
        <HelpSubsection title="Step 1: Generate Keys">
          <HelpParagraph>
            Encryption keys are automatically generated when you install AndroidIRCX.
          </HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title="Step 2: Share Your Key">
          <HelpParagraph>To start encrypted conversation:</HelpParagraph>
          <HelpBullet>Open private chat: /query Nick</HelpBullet>
          <HelpBullet>Share your key: /sharekey Nick</HelpBullet>
          <HelpBullet>Wait for them to share their key</HelpBullet>
          <HelpBullet>Messages are now automatically encrypted 🔒</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Request Someone's Key">
          <HelpCode>/requestkey Nick</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Channel Encryption">
        <HelpSubsection title="Generate Channel Key">
          <HelpParagraph>As a channel operator:</HelpParagraph>
          <HelpCode>/chankey generate</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="Share Channel Key">
          <HelpParagraph>Share key with trusted members:</HelpParagraph>
          <HelpCode>/chankey share Nick1,Nick2,Nick3</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="Check Encryption Status">
          <HelpCode>/chankey status</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="Revoke Access">
          <HelpParagraph>Remove someone's access:</HelpParagraph>
          <HelpCode>/chankey revoke Nick</HelpCode>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Security Best Practices">
        <HelpSuccessBox>
          ✅ Verify key fingerprints out-of-band (phone call){'\n'}
          ✅ Rotate channel keys periodically{'\n'}
          ✅ Only share keys with trusted users{'\n'}
          ✅ Keep your device secure with PIN/biometric lock
        </HelpSuccessBox>

        <HelpWarningBox>
          ❌ Don't share keys over unencrypted channels{'\n'}
          ❌ Don't share keys publicly{'\n'}
          ❌ Don't ignore key verification warnings{'\n'}
          ❌ Don't leave encrypted channels unattended
        </HelpWarningBox>
      </HelpSection>

      <HelpSection title="Troubleshooting">
        <HelpSubsection title="Messages appear as gibberish">
          <HelpParagraph>The sender hasn't shared their encryption key with you yet.</HelpParagraph>
          <HelpParagraph>Solution:</HelpParagraph>
          <HelpCode>/requestkey TheirNick</HelpCode>
        </HelpSubsection>

        <HelpSubsection title="Can't decrypt old messages">
          <HelpParagraph>
            You joined the channel after messages were sent, or key was rotated.
          </HelpParagraph>
          <HelpParagraph>Solution: Ask channel operator to reshare the key.</HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title="Lock icon not showing">
          <HelpParagraph>Encryption may be disabled or keys not exchanged.</HelpParagraph>
          <HelpParagraph>Solution: Check Settings → Display & UI → Show Encryption Indicators</HelpParagraph>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Key Management">
        <HelpInfoBox>
          View and manage your keys in:{'\n'}
          Settings → Security → Manage Encryption Keys
        </HelpInfoBox>
      </HelpSection>
    </HelpScreenBase>
  );
};
