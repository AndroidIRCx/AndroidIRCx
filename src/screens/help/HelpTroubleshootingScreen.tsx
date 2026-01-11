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

interface HelpTroubleshootingScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpTroubleshootingScreen: React.FC<HelpTroubleshootingScreenProps> = ({
  visible,
  onClose,
}) => {
  return (
    <HelpScreenBase visible={visible} onClose={onClose} title="Troubleshooting Guide">
      <HelpSection title="Connection Issues">
        <HelpSubsection title="Can't Connect to Server">
          <HelpParagraph>Symptoms: Connection timeout, "Unable to connect"</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Check your internet connection</HelpBullet>
          <HelpBullet>Verify server address is correct</HelpBullet>
          <HelpBullet>Try different port (6667 for non-SSL, 6697 for SSL)</HelpBullet>
          <HelpBullet>Disable VPN/proxy temporarily</HelpBullet>
          <HelpBullet>Check if firewall is blocking IRC ports</HelpBullet>
          <HelpBullet>Try connecting via mobile data instead of WiFi</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Disconnects Frequently">
          <HelpParagraph>Symptoms: Random disconnections, "Connection lost"</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Enable auto-reconnect: Settings → Connection & Network → Auto-Reconnect</HelpBullet>
          <HelpBullet>Adjust auto-reconnect delays: Settings → Connection & Network → Auto-Reconnect</HelpBullet>
          <HelpBullet>Check network stability</HelpBullet>
          <HelpBullet>Try different server in same network</HelpBullet>
          <HelpBullet>Review lag settings: Settings → Connection & Network → Connection Quality</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="SSL/TLS Errors">
          <HelpParagraph>Symptoms: "SSL handshake failed", "Certificate error"</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Verify server supports SSL on that port (usually 6697)</HelpBullet>
          <HelpBullet>Try disabling "Verify SSL Certificate" in network settings</HelpBullet>
          <HelpBullet>Update to latest app version</HelpBullet>
          <HelpBullet>Check server certificate validity</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Authentication Problems">
        <HelpSubsection title="Nickname Already in Use">
          <HelpParagraph>Symptoms: "Nickname is already in use"</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Try alternate nickname</HelpBullet>
          <HelpBullet>Wait a few minutes (old session timeout)</HelpBullet>
          <HelpBullet>Use /msg NickServ GHOST YourNick password</HelpBullet>
          <HelpBullet>Change nickname: dropdown (▼) → Choose Network → Edit → Nickname</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="NickServ Won't Identify">
          <HelpParagraph>Symptoms: "Password incorrect", Not identified</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Verify password is correct</HelpBullet>
          <HelpBullet>Wait for NickServ notice before identifying</HelpBullet>
          <HelpBullet>Manually identify: /msg NickServ IDENTIFY password</HelpBullet>
          <HelpBullet>Check if account is suspended</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="SASL Authentication Failed">
          <HelpParagraph>Symptoms: "SASL authentication failed"</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Verify SASL username and password</HelpBullet>
          <HelpBullet>Check if SASL is enabled on server</HelpBullet>
          <HelpBullet>Try plain authentication method</HelpBullet>
          <HelpBullet>Ensure nickname matches SASL account</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Message Issues">
        <HelpSubsection title="Messages Not Sending">
          <HelpParagraph>Symptoms: Message appears locally but others don't see it</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Check if you're still connected</HelpBullet>
          <HelpBullet>Verify you're not banned/quieted</HelpBullet>
          <HelpBullet>Check channel modes (+m moderated)</HelpBullet>
          <HelpBullet>Ensure you have voice (+v) if channel is moderated</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Can't See Messages">
          <HelpParagraph>Symptoms: Channel appears empty, no messages visible</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Check Settings → Display & UI → Show Raw Commands</HelpBullet>
          <HelpBullet>Verify filters in Settings → Messages & History</HelpBullet>
          <HelpBullet>Restart app to reload message history</HelpBullet>
          <HelpBullet>Check if user is ignored</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Encrypted Messages Show as Gibberish">
          <HelpParagraph>Symptoms: Messages display as random characters</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Exchange encryption keys with sender</HelpBullet>
          <HelpBullet>Request key: /requestkey TheirNick</HelpBullet>
          <HelpBullet>Verify E2EE is enabled</HelpBullet>
          <HelpBullet>Check Key Management in Settings</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Channel Problems">
        <HelpSubsection title="Can't Join Channel">
          <HelpParagraph>Symptoms: "Cannot join channel", Error 473-475</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>+i (Invite-only): Ask operator for invite</HelpBullet>
          <HelpBullet>+k (Key required): Join with password: /join #channel password</HelpBullet>
          <HelpBullet>+l (User limit): Wait for space</HelpBullet>
          <HelpBullet>+b (Banned): Ask operator to unban you</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Can't Send Messages in Channel">
          <HelpParagraph>Symptoms: Message rejected, channel is quiet</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Check if channel is moderated (+m)</HelpBullet>
          <HelpBullet>Ask operator for voice (+v)</HelpBullet>
          <HelpBullet>Check if you're banned or quieted</HelpBullet>
          <HelpBullet>Verify you're still in the channel</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Channel Won't Stay Open">
          <HelpParagraph>Symptoms: Channel tab closes automatically</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Add it to auto-join: dropdown (▼) → Choose Network → Edit → Auto-Join Channels</HelpBullet>
          <HelpBullet>Rejoin channel manually</HelpBullet>
          <HelpBullet>Check network connection</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="App Performance">
        <HelpSubsection title="App is Slow/Laggy">
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Clear message history cache</HelpBullet>
          <HelpBullet>Reduce message batch size: Settings → Performance</HelpBullet>
          <HelpBullet>Disable animated emojis/GIFs</HelpBullet>
          <HelpBullet>Close unused tabs</HelpBullet>
          <HelpBullet>Restart app</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="High Battery Usage">
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Disable background service</HelpBullet>
          <HelpBullet>Reduce notification frequency</HelpBullet>
          <HelpBullet>Use WiFi instead of mobile data</HelpBullet>
          <HelpBullet>Enable battery optimization</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="App Crashes">
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Update to latest version</HelpBullet>
          <HelpBullet>Clear app cache and data</HelpBullet>
          <HelpBullet>Restart device</HelpBullet>
          <HelpBullet>Report crash with logs to developers</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Notification Issues">
        <HelpSubsection title="Not Receiving Notifications">
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Check notification permissions</HelpBullet>
          <HelpBullet>Verify Settings → Notifications → Enabled</HelpBullet>
          <HelpBullet>Disable battery optimization for app</HelpBullet>
          <HelpBullet>Check Do Not Disturb is off</HelpBullet>
          <HelpBullet>Re-enable background service</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Too Many Notifications">
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Adjust notification filters</HelpBullet>
          <HelpBullet>Enable "Highlights only" mode</HelpBullet>
          <HelpBullet>Mute specific channels</HelpBullet>
          <HelpBullet>Set quiet hours</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Media/File Issues">
        <HelpSubsection title="Can't Send Media">
          <HelpParagraph>Symptoms: Attachment button missing/disabled</HelpParagraph>
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Verify E2EE is enabled for channel/DM</HelpBullet>
          <HelpBullet>Enable media feature in Settings</HelpBullet>
          <HelpBullet>Exchange encryption keys first</HelpBullet>
          <HelpBullet>Check file size (max 50MB)</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Media Won't Download">
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Check internet connection</HelpBullet>
          <HelpBullet>Enable auto-download: Settings → Media → Auto-Download Media</HelpBullet>
          <HelpBullet>Verify storage permission</HelpBullet>
          <HelpBullet>Clear media cache</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Media Appears Encrypted">
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Request decryption key from sender</HelpBullet>
          <HelpBullet>Verify E2EE key exchange</HelpBullet>
          <HelpBullet>Check Security → Manage Encryption Keys</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Account & Settings">
        <HelpSubsection title="Lost PIN/Password">
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Use biometric unlock if enabled</HelpBullet>
          <HelpBullet>Settings → Security → Reset PIN</HelpBullet>
          <HelpBullet>Backup/restore may help</HelpBullet>
          <HelpBullet>Last resort: Clear app data (loses all data)</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Settings Not Saving">
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Check storage permission</HelpBullet>
          <HelpBullet>Verify storage space available</HelpBullet>
          <HelpBullet>Restart app</HelpBullet>
          <HelpBullet>Clear app cache</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Backup/Restore Failed">
          <HelpParagraph>Solutions:</HelpParagraph>
          <HelpBullet>Verify file integrity</HelpBullet>
          <HelpBullet>Check storage permission</HelpBullet>
          <HelpBullet>Use latest backup file</HelpBullet>
          <HelpBullet>Try export/import individually</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Still Need Help?">
        <HelpSubsection title="Get Support">
          <HelpBullet>Join #AndroidIRCX on irc.dbase.in.rs</HelpBullet>
          <HelpBullet>Email: support@androidircx.com</HelpBullet>
          <HelpBullet>GitHub Issues: github.com/yourrepo/issues</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Gather Information">
          <HelpParagraph>Before reporting, collect:</HelpParagraph>
          <HelpBullet>App version</HelpBullet>
          <HelpBullet>Android version</HelpBullet>
          <HelpBullet>Device model</HelpBullet>
          <HelpBullet>Error message/screenshot</HelpBullet>
          <HelpBullet>Steps to reproduce</HelpBullet>
        </HelpSubsection>

        <HelpInfoBox>
          Enable Debug Logging:{'\n'}
          Settings → Development → Enable Console Logging (debug builds only){'\n'}
          Send logs with your report.
        </HelpInfoBox>
      </HelpSection>
    </HelpScreenBase>
  );
};
