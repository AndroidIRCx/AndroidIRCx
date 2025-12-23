# AndroidIRCX

[![GitHub Release](https://img.shields.io/github/v/release/androidircx/androidircx)](https://github.com/androidircx/androidircx/releases)
[![GitHub Issues](https://img.shields.io/github/issues/androidircx/androidircx)](https://github.com/androidircx/androidircx/issues)
[![GitHub License](https://img.shields.io/github/license/androidircx/androidircx)](https://github.com/androidircx/androidircx/blob/main/LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/androidircx/androidircx?style=flat)](https://github.com/androidircx/androidircx/stargazers)

Modern IRC client for Android and iOS built with React Native, inspired by the classic AndroIRC client. This project aims to provide a full-featured, IRCv3-compliant IRC client with a clean and intuitive user interface.

## 📸 Screenshots

<p align="center">
  <a href="https://cloud.dbase.in.rs/apps/files_sharing/publicpreview/D2dRyRHi5RRyb8S?file=/&fileId=1001141&x=1920&y=1080&a=true&etag=2e41b96e920c532604c12aa7b4c2918d"
     target="_blank" rel="noopener noreferrer">
    <img src="https://cloud.dbase.in.rs/apps/files_sharing/publicpreview/D2dRyRHi5RRyb8S?file=/&fileId=1001141&x=1920&y=1080&a=true&etag=2e41b96e920c532604c12aa7b4c2918d"
         alt="AndroidIRCX screenshot 1"
      />
  </a>

<a
href="https://cloud.dbase.in.rs/apps/files_sharing/publicpreview/4SCxyJfXZegfnCg?file=/&fileId=1001307&x=1920&y=1080&a=true&etag=123ba8b16edb14645957781cdc4f8538"
target="_blank" rel="noopener noreferrer">
<img
src="https://cloud.dbase.in.rs/apps/files_sharing/publicpreview/4SCxyJfXZegfnCg?file=/&fileId=1001307&x=1920&y=1080&a=true&etag=123ba8b16edb14645957781cdc4f8538"
alt="AndroidIRCX screenshot 2"
 />
</a>
</p>

### 📲 Download & Testing

**🧪 Join Testing Program**

- Google Play Testing:  
  https://play.google.com/apps/testing/com.androidircx
- Google Group (required for testing access):  
  https://groups.google.com/g/androidircx/

**🌐 Download APK (Official Website)**  
https://androidircx.com/app-release.apk

## 📱 About

AndroidIRCX is a cross-platform IRC (Internet Relay Chat) client that brings the classic IRC
experience to mobile devices. Built with React Native 0.82, it supports multiple networks, secure
connections (SSL/TLS), end-to-end encryption for DMs and channels, and modern IRC features while
maintaining full compatibility with IRCv3 standards.

## ✨ Features

### ✅ Implemented

- **Multi-Network Support**
  - Configure and manage multiple IRC networks
  - Multiple servers per network with failover support
  - Persistent network and server configurations
  - Background service for persistent connections

- **Secure Connections**
  - SSL/TLS encryption support
  - Certificate validation options
  - Server password authentication
  - Proxy/Tor support

- **Encryption & Trust**
    - Encrypted DMs and encrypted channels
    - Key verification with fingerprints and QR codes
    - Offline key exchange via file and NFC
    - TOFU + key pinning with change warnings

- **IRCv3 Full Support** 🎉
  - **Full CAP Negotiation**: Complete capability negotiation with multi-line support (CAP LS 302)
  - **SASL Authentication**: Full SASL PLAIN mechanism support with proper CAP integration
  - **Message Tags**: Complete parsing of IRCv3 message tags (@tag=value format)
  - **Server-Time Extension**: Accurate server-provided timestamps for all messages
  - **Account Notify**: Automatic tracking of account login/logout events
  - **Extended Join**: Enhanced JOIN messages with account information
  - **Userhost in Names**: Support for userhost information in NAMES replies
  - **Away Notify**: Real-time away status notifications
  - **CHGHOST**: Support for hostname changes
  - **Message Tags**: Full support for batched messages and labeled responses
  - **Echo Message**: Support for echo-message capability

- **User Interface**
  - Clean, modern UI inspired by AndroIRC
  - Configurable channel tabs (top/bottom/left/right) for navigation
  - Real-time message display with server-accurate timestamps
  - User list for channels
  - User list dockable to left/right/top/bottom
  - RAW command logging (toggleable) with category filters
  - Grouped, scrollable user list context menu
  - Connection/identity profile management with scrollable lists
  - Header lock button for quick app lock/unlock
  - Picture-in-Picture mode (Android)
  - Smart message routing (RAW messages to server tab only)
  - Landscape and portrait mode support

- **IRC Protocol Features**
  - Full IRC protocol implementation
  - Automatic nickname fallback (altnick support)
  - Channel joining and leaving
  - Private messaging (queries)
  - Message sending and receiving
  - Server status messages
  - Topic display
  - Mode changes tracking
  - Proper message routing (prevents self-query windows)

- **Network Configuration**
  - Network settings (name, nickname, altnick, realname, ident)
  - Server settings (hostname, port, SSL/TLS, password)
  - SASL authentication support (fully implemented)
  - Auto-join channels configuration
  - Identity profiles with on-connect commands
  - Persistent storage using AsyncStorage

- **Connection Management**
  - Automatic reconnection handling
  - Auto-connect favorite servers on startup (multi-network)
  - Connection status indicators
  - Ping measurement display
  - Error handling and reporting
  - Proper CAP negotiation before registration

- **Power Features**
    - Backup/restore with file export and clipboard copy
    - Connection quality monitoring (lag, rate limiting, flood protection)
    - Bouncer detection and ZNC compatibility
    - Extended command aliases (ZNC + IRCop helpers)
  - DCC file transfers
  - Notifications
  - Firebase Crashlytics integration
  - Google Mobile Ads

## 🛠️ Technology Stack

- **Framework**: React Native 0.82.1
- **Language**: TypeScript 5.8.3
- **Networking**: react-native-tcp-socket 6.3.0
- **Storage**: @react-native-async-storage/async-storage 2.2.0
- **UI**: React Native components with custom styling
- **Encryption**: libsodium
- **Analytics/Crash**: Firebase (Crashlytics, App Check)

## 📁 Project Structure

```text
AndroidIRCX/
├── src/
│   ├── components/          # UI components
│   │   ├── HeaderBar.tsx    # Top navigation bar
│   │   ├── ChannelTabs.tsx  # Channel/query tabs
│   │   ├── MessageArea.tsx  # Message display area
│   │   ├── MessageInput.tsx # Message input field
│   │   └── UserList.tsx     # Channel user list
│   ├── services/            # Business logic
│   │   ├── IRCService.ts    # IRC protocol implementation (IRCv3 compliant)
│   │   └── SettingsService.ts # Network/server configuration
│   ├── screens/             # Full-screen views
│   │   ├── NetworksListScreen.tsx
│   │   ├── NetworkSettingsScreen.tsx
│   │   └── ServerSettingsScreen.tsx
│   └── types/               # TypeScript type definitions
├── android/                 # Android native code
├── ios/                     # iOS native code
├── App.tsx                  # Main application component
└── package.json
```

## 🔧 Configuration

### Adding a Network

1. Open the app and tap the hamburger menu (☰)
2. Select "Networks"
3. Tap the "+" button to add a new network
4. Fill in network details:
   - Network name
   - Nickname and alternative nickname
   - Real name and ident
   - Auto-join channels (optional)
   - SASL credentials (optional, fully supported)

### Adding a Server

1. In the Networks screen, select a network
2. Tap "+ Add Server"
3. Configure server settings:
   - Hostname and port
   - SSL/TLS settings
   - Server password (if required)

### Connecting

- Tap the network name in the header (when disconnected)
- Or use the "+" button → "Choose Network"
- Select a network and server to connect

The client will automatically:

- Start CAP negotiation before registration
- Request all supported IRCv3 capabilities
- Authenticate with SASL if configured
- Display server-time accurate timestamps

## 🔐 Security

- **TLS/SSL**: Full support for encrypted connections
- **App Lock**: Biometric/PIN lock with a quick lock action
- **SASL**: Complete SASL PLAIN authentication support with proper CAP integration
- **Certificate Validation**: Configurable certificate checking
- **Password Storage**: Secure storage for secrets with biometric/PIN support (fallback to
  AsyncStorage when unavailable)

## 📝 IRC Protocol Compliance

This client implements the IRC protocol according to:

- **RFC 1459** (Internet Relay Chat Protocol)
- **IRCv3 Specifications** (Full support for major extensions)
  - CAP Negotiation (RFC specification)
  - SASL Authentication (RFC 4422)
  - Message Tags (IRCv3.2)
  - Server-Time (IRCv3.2)
  - Account Notify (IRCv3.1)
  - Extended Join (IRCv3.1)
  - Away Notify (IRCv3.1)
  - CHGHOST (IRCv3.2)
  - Batch (IRCv3.2)
  - Labeled Responses (IRCv3.2)
  - Echo Message (IRCv3.2)

## 📚 Additional Documentation

- [IRC Setup Guide](IRC_SETUP.md) - Detailed IRC connection setup
- [Debug Notes](DEBUG_NOTES.md) - Troubleshooting guide
- [PROJECT](PROJECT.md) - Project explained
## 🔄 Development Status

**Current Version**: 1.3.1 (Dignity)

---

**Note**: This project is in active development. Some features may be incomplete or subject to change.

