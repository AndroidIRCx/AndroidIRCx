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

interface HelpMediaScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpMediaScreen: React.FC<HelpMediaScreenProps> = ({
  visible,
  onClose,
}) => {
  return (
    <HelpScreenBase visible={visible} onClose={onClose} title="Media Sharing Guide">
      <HelpSection title="Overview">
        <HelpParagraph>
          AndroidIRCX supports end-to-end encrypted media sharing:
        </HelpParagraph>
        <HelpBullet>📷 Photos (camera or gallery)</HelpBullet>
        <HelpBullet>🎥 Videos (camera or gallery)</HelpBullet>
        <HelpBullet>🎤 Voice messages</HelpBullet>
        <HelpBullet>📁 Files</HelpBullet>
      </HelpSection>

      <HelpSection title="Requirements">
        <HelpBullet>E2EE must be enabled for the channel/DM</HelpBullet>
        <HelpBullet>Both sender and recipient must have exchanged encryption keys</HelpBullet>
        <HelpBullet>Internet connection for upload/download</HelpBullet>
      </HelpSection>

      <HelpSection title="How to Send Media">
        <HelpSubsection title="Step 1: Enable Media Feature">
          <HelpBullet>Open Settings (☰ menu)</HelpBullet>
          <HelpBullet>Go to "Media"</HelpBullet>
          <HelpBullet>Enable "Enable Encrypted Media Sharing"</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Step 2: Send Photo">
          <HelpBullet>Open encrypted channel or DM (must have 🔒 icon)</HelpBullet>
          <HelpBullet>Tap the 📎 attachment button</HelpBullet>
          <HelpBullet>Select "Photo" or "Camera"</HelpBullet>
          <HelpBullet>Choose or take photo</HelpBullet>
          <HelpBullet>Add optional caption</HelpBullet>
          <HelpBullet>Tap "Send"</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Step 3: Send Video">
          <HelpBullet>Tap 📎 attachment button</HelpBullet>
          <HelpBullet>Select "Video" or "Record Video"</HelpBullet>
          <HelpBullet>Choose or record video</HelpBullet>
          <HelpBullet>Preview and add caption</HelpBullet>
          <HelpBullet>Tap "Send"</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Step 4: Voice Message">
          <HelpBullet>Tap 📎 attachment button</HelpBullet>
          <HelpBullet>Select "Voice Message"</HelpBullet>
          <HelpBullet>Record your message</HelpBullet>
          <HelpBullet>Preview and send</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="How to Receive Media">
        <HelpSubsection title="Automatic Download">
          <HelpParagraph>By default, media is downloaded automatically on WiFi.</HelpParagraph>
        </HelpSubsection>

        <HelpSubsection title="Manual Download">
          <HelpParagraph>If auto-download is disabled:</HelpParagraph>
          <HelpBullet>Tap the media message</HelpBullet>
          <HelpBullet>Tap "Download" button</HelpBullet>
          <HelpBullet>Wait for decryption</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="View Media">
          <HelpBullet>Tap image/video to open in full screen</HelpBullet>
          <HelpBullet>Pinch to zoom images</HelpBullet>
          <HelpBullet>Play/pause videos</HelpBullet>
          <HelpBullet>Save to gallery (if enabled)</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Settings">
        <HelpSubsection title="Media Quality">
          <HelpParagraph>Settings → Media → Media Quality</HelpParagraph>
          <HelpBullet>Original - Full quality (larger file)</HelpBullet>
          <HelpBullet>High - 90% quality</HelpBullet>
          <HelpBullet>Medium - 70% quality</HelpBullet>
          <HelpBullet>Low - 50% quality (smaller file)</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Auto-Download">
          <HelpParagraph>Settings → Media → Auto-Download Media</HelpParagraph>
          <HelpBullet>WiFi only (recommended)</HelpBullet>
          <HelpBullet>WiFi + Mobile Data</HelpBullet>
          <HelpBullet>Never (manual only)</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Storage">
          <HelpParagraph>Settings → Media → Maximum Cache Size / Clear Media Cache</HelpParagraph>
          <HelpBullet>View cache size</HelpBullet>
          <HelpBullet>Clear cache</HelpBullet>
          <HelpBullet>Set max cache size</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Privacy & Security">
        <HelpSubsection title="Encryption">
          <HelpBullet>All media is encrypted with XChaCha20-Poly1305 before upload</HelpBullet>
          <HelpBullet>Encryption keys are only shared with authorized recipients</HelpBullet>
          <HelpBullet>Server cannot decrypt media</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Metadata">
          <HelpBullet>Original filename is encrypted</HelpBullet>
          <HelpBullet>EXIF data is stripped from photos</HelpBullet>
          <HelpBullet>GPS location is removed</HelpBullet>
        </HelpSubsection>
      </HelpSection>

      <HelpSection title="Troubleshooting">
        <HelpSubsection title="Can't see attachment button">
          <HelpBullet>Check if channel/DM has encryption enabled (🔒 icon)</HelpBullet>
          <HelpBullet>Enable media feature in Settings</HelpBullet>
          <HelpBullet>Exchange encryption keys first</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Upload failed">
          <HelpBullet>Check internet connection</HelpBullet>
          <HelpBullet>Check file size (max 50MB)</HelpBullet>
          <HelpBullet>Try reducing quality</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Download failed">
          <HelpBullet>Check internet connection</HelpBullet>
          <HelpBullet>Check storage space</HelpBullet>
          <HelpBullet>Try clearing media cache</HelpBullet>
        </HelpSubsection>

        <HelpSubsection title="Media appears as 'Encrypted data'">
          <HelpBullet>You don't have the decryption key</HelpBullet>
          <HelpBullet>Request key from sender</HelpBullet>
        </HelpSubsection>
      </HelpSection>
    </HelpScreenBase>
  );
};
