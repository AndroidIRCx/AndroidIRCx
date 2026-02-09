# AndroidIRCX

[![GitHub Release](https://img.shields.io/github/v/release/androidircx/androidircx)](https://github.com/androidircx/androidircx/releases)
[![GitHub Issues](https://img.shields.io/github/issues/androidircx/androidircx)](https://github.com/androidircx/androidircx/issues)
[![GitHub License](https://img.shields.io/github/license/androidircx/androidircx)](https://github.com/androidircx/androidircx/blob/main/LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/androidircx/androidircx?style=flat)](https://github.com/androidircx/androidircx/stargazers)

Modern IRC client for Android and iOS built with React Native, inspired by the classic AndroIRC client. This project aims to provide a full-featured, IRCv3-compliant IRC client with a clean and intuitive user interface.

## 📸 Screenshots

<p align="center">
  <a 
href="https://cloud.dbase.in.rs/apps/files_sharing/publicpreview/N4nTYTLQy7C5CeH?file=/&fileId=1001705&x=1920&y=1080&a=true&etag=6dc8973fe555cd64a830cebb4bbda42e"
     target="_blank" rel="noopener noreferrer">
    <img src="https://cloud.dbase.in.rs/apps/files_sharing/publicpreview/N4nTYTLQy7C5CeH?file=/&fileId=1001705&x=1920&y=1080&a=true&etag=6dc8973fe555cd64a830cebb4bbda42e"
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

### 📲 Download

**🎉 AndroidIRCX is now publicly available!**

- **Google Play Store:**
  https://play.google.com/store/apps/details?id=com.androidircx

- **Direct APK Download (Official Website):**
  https://androidircx.com/app-release.apk

## 📱 About

AndroidIRCX is a cross-platform IRC (Internet Relay Chat) client that brings the classic IRC
experience to mobile devices. Built with React Native 0.83, it supports multiple networks, secure
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
  - **Client certificate authentication (SASL EXTERNAL)** - Passwordless login with X.509
    certificates
  - Proxy/Tor support

- **Encryption & Trust**
    - Encrypted DMs and encrypted channels
    - Key verification with fingerprints and QR codes
    - Offline key exchange via file and NFC
    - TOFU + key pinning with change warnings
  - Context-bound AAD for encrypted messages and media (network/nick/channel/mediaId)
  - Backward-compatible decryption for legacy ciphertext (update to v1.6.3+ for new AAD)

- **IRCv3 Full Compliance** 🎉
    - **Complete Implementation**: All 18 IRCv3 capabilities supported (Standard + Draft)
    - **Full CAP Negotiation**: Multi-line capability negotiation (CAP LS 302) with 27 total
      capabilities requested
    - **SASL Authentication**: Full SASL PLAIN mechanism with proper CAP integration

    - **IRCv3.2 Standard Capabilities** (10):
        - **BATCH**: Message grouping for efficient processing (netsplit, netjoin, chathistory
          batches)
        - **LABELED-RESPONSE**: Command/response correlation with unique labels (30s timeout)
        - **CAP-NOTIFY**: Dynamic capability notifications (CAP NEW/DEL handling)
        - **ACCOUNT-TAG**: Messages tagged with sender's account name
        - **SETNAME**: Change realname without reconnecting (`/setname` command)
        - **STANDARD-REPLIES**: Standardized FAIL/WARN/NOTE server responses
        - **MESSAGE-IDS**: Unique message identifiers with deduplication (1000 msgid cache)
        - **BOT**: Mark user account as bot (`/bot on|off` command)
        - **UTF8ONLY**: UTF-8 encoding enforcement
        - **EXTENDED-MONITOR**: Enhanced MONITOR with online/offline tracking

    - **Draft IRCv3 Capabilities** (8):
        - **CHATHISTORY**: Request message history from server (`/chathistory` command, up to 100
          messages)
        - **MULTILINE**: Send/receive multi-line messages (5s assembly timeout)
        - **READ-MARKER**: Mark messages as read (`/markread` command)
        - **MESSAGE-REDACTION**: Delete/redact messages (`/redact` command)
        - **REPLY**: Reply to specific messages (threaded conversations)
        - **REACT**: Emoji reactions to messages (MessageReactionsService integration)
        - **TYPING**: Real-time typing indicators (see below for details)
        - **CHANNEL-CONTEXT**: PM channel context tracking

    - **IRCv3.1/3.2 Base Extensions**:
        - **Message Tags**: Complete @tag=value parsing and client-only tags (+tag)
        - **Server-Time**: Accurate server-provided timestamps for all messages
        - **Account Notify**: Automatic tracking of account login/logout events
        - **Extended Join**: Enhanced JOIN messages with account information
        - **Userhost in Names**: Support for userhost information in NAMES replies
        - **Away Notify**: Real-time away status notifications
        - **CHGHOST**: Support for hostname changes
        - **Echo Message**: Support for echo-message capability
        - **Multi-Prefix**: Multiple user mode prefixes display
        - **Invite Notify**: Real-time invite notifications
        - **Monitor**: Track user online/offline status

- **User Interface**
  - Clean, modern UI inspired by AndroIRC
  - Configurable channel tabs (top/bottom/left/right) for navigation
  - **Real-time typing indicators**: "nick is typing..." with auto-hide (5s timeout)
      - Multi-user support: "Alice and Bob are typing..." / "Alice, Bob, and 2 others are typing..."
      - Fade animations for smooth display
      - Protocol: `+typing=active|paused|done` tags via TAGMSG
      - Debounced typing detection (active, paused after 3s, done on submit)
  - **Smart command autocomplete**: Dropdown with up to 8 suggestions
      - Built-in commands (21): `/join`, `/msg`, `/setname`, `/bot`, `/chathistory`, `/markread`,
        `/redact`, etc.
      - Aliases (70+): IRC shortcuts, ZNC commands, IRCop helpers, NickServ/ChanServ
      - Command history (last 30 with deduplication)
      - Context-aware scoring (prefers channel commands in channels, query commands in PMs)
      - Touch to autocomplete with auto-space insertion
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
  - Google Mobile Ads (with premium ad removal options)
  - In-App Purchases: Remove Ads, Pro Unlimited, Supporter Pro tiers
  - Scripting system with time-based access (watch ads for time or purchase unlimited)

- **ZNC Subscription Service** 🆕
    - **Multiple ZNC Accounts** - Purchase and manage multiple ZNC bouncer accounts
    - **Restore Purchases** - Full Google Play restore functionality
    - **One-Click Setup** - Auto-configure ZNC to any network (default: DBase)
    - **Network Integration** - ZNC servers integrate with existing Network/Server settings
    - **Account Management**:
        - View account status (active, pending, expired)
        - Refresh account credentials
        - Copy username/password
        - Assign/unassign from networks

## 🛠️ Technology Stack

- **Framework**: React Native 0.83.1
- **Language**: TypeScript 5.9.3
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
│   │   ├── MessageInput.tsx # Message input (autocomplete + typing sender)
│   │   ├── TypingIndicator.tsx # Real-time typing display (NEW v1.4.4)
│   │   └── UserList.tsx     # Channel user list
│   ├── services/            # Business logic
│   │   ├── IRCService.ts    # IRC protocol (Full IRCv3 - 18 capabilities)
│   │   ├── MessageReactionsService.ts # Reaction tracking (NEW v1.4.4)
│   │   ├── SubscriptionService.ts # ZNC multi-account management (NEW v1.6.6)
│   │   ├── CommandService.ts # Command aliases (70+) and history
│   │   └── SettingsService.ts # Network/server configuration
│   ├── screens/             # Full-screen views
│   │   ├── NetworksListScreen.tsx
│   │   ├── NetworkSettingsScreen.tsx
│   │   ├── ServerSettingsScreen.tsx
│   │   └── ZncSubscriptionScreen.tsx # ZNC subscription management (NEW v1.6.6)
│   └── types/               # TypeScript type definitions
├── android/                 # Android native code
├── ios/                     # iOS native code
├── App.tsx                  # Main application component
└── package.json
```

## 🔧 Configuration

### Quick Connect

**When disconnected**, you can quickly connect by:

- **Tapping the network name** in the header → connects to that network
- **Tapping the dropdown (▼)** → "Connect to Default" → connects using default configuration

### Adding a New Network

1. **Open Networks List:**
    - Tap the **dropdown button (▼)** in the header
    - Select **"Choose Network"** (when disconnected) or **"Connect Another Network"** (when
      connected)

2. **Create New Network:**
    - In the Networks List screen, tap the **[+]** button in the header
    - This opens the Network Settings screen

3. **Configure Network Details:**
    - **Network Name** (e.g., "dbase.in.rs") - required
    - **Nickname** (e.g., "MyNick") - required, set per network
    - **Alternative Nickname** - fallback if primary nick is taken
    - **Real Name** (e.g., "John Doe") - required
    - **Ident/Username** - optional
    - **Auto-Join Channels** - comma-separated (e.g., "#lobby, #help")
    - **SASL PLAIN** - account and password for authentication
    - **Proxy Settings** - Tor/SOCKS5/HTTP support
    - **Client Certificate** - for SASL EXTERNAL

4. **Save the Network:**
    - Tap **[Save]** in the header

### Adding a Server to Network

1. In the **Networks List**, find your network
2. Tap **[+ Add Server]** under that network
3. **Configure Server Settings:**
    - **Hostname** (e.g., "irc.example.com") - required
    - **Port** (default: 6697 for SSL, 6667 for plain) - required
    - **Display Name** - optional friendly name
    - **Use SSL/TLS** - recommended, enabled by default
    - **Reject Unauthorized Certificates** - disabled by default (allows self-signed certs)
    - **Server Password** - if required by server
    - **Favorite Server** - mark as preferred server for this network

4. **Save the Server:**
    - Tap **[Save]**

### Connecting to a Network

**Method 1 - Quick Connect (when disconnected):**

- Tap the **network name** in the header

**Method 2 - Via Dropdown Menu:**

1. Tap the **dropdown button (▼)** in the header
2. Select:
    - **"Connect to Default"** - uses default network
    - **"Choose Network"** - opens Networks List to select a network

**Method 3 - From Networks List:**

1. Open Networks List (dropdown → "Choose Network")
2. **Tap the network name** to connect to that network
3. Or **tap a specific server** under that network to connect to that exact server

**When already connected to one network:**

- Use dropdown (▼) → **"Connect Another Network"** to connect to additional networks simultaneously

### Changing Your Nickname

**Setting Initial Nickname (per network):**

1. Open Networks List (dropdown → "Choose Network")
2. Find your network and tap **[Edit]**
3. Edit the **"Nickname"** field
4. Optionally set **"Alternative Nickname"** (used if primary is taken)
5. Tap **[Save]**

**Changing Nickname While Connected:**

- Type in the message input:
  ```
  /nick NewNickname
  ```
  or use the alias:
  ```
  /n NewNickname
  ```
- This changes your nickname for the current session only
- To make it permanent, edit the network settings as described above

### Settings Access

- **Hamburger Menu (☰)**: Opens Settings screen for app configuration (theme, notifications, etc.)
- **Dropdown Menu (▼)**: Access connection menu and Networks List for network/server configuration

**Note:** Network and server configuration is done through the **Dropdown Menu (▼)** → Networks
List, **NOT** through the Hamburger Menu (☰).

**Connection Sequence (IRCv3 Compliant):**

1. **TCP Connection**: Establish connection via TcpSocketModule (with SSL/TLS if configured)
2. **CAP Negotiation Start**: Send `CAP LS 302` (multi-line capability listing)
3. **Server Capabilities**: Receive list of available capabilities from server
4. **Request Capabilities**: Send `CAP REQ` with 27 supported capabilities
5. **Capability Acknowledgment**: Receive `CAP ACK` for enabled capabilities
6. **SASL Authentication** (if configured):
    - Send `AUTHENTICATE PLAIN`
    - Exchange SASL credentials
    - Wait for authentication success (903)
7. **End CAP Negotiation**: Send `CAP END`
8. **IRC Registration**: Send `NICK` and `USER` commands
9. **Connection Complete**: Receive `001` (RPL_WELCOME) - registered event
10. **Post-Connection**:
    - Load saved tabs for network
    - Auto-join configured channels
    - Enable server-time timestamps
    - Activate all negotiated IRCv3 features

## 🔐 Client Certificate Authentication (SASL EXTERNAL)

AndroidIRCX supports client certificate authentication for passwordless, secure IRC connections
using SASL EXTERNAL.

### What are Client Certificates?

Client certificates are X.509 digital certificates that uniquely identify you to IRC servers using
cryptographic authentication. They provide stronger security than passwords and enable automatic
authentication without entering credentials.

**Key Features:**

- RSA-2048 bit encryption
- SHA-256 fingerprints
- Self-signed certificates (no CA required)
- Stored securely in device Keychain
- Valid for 1-10 years (configurable)

**Benefits:**

- **No password transmission** - Identity verified cryptographically
- **Stronger authentication** - 2048-bit keys are more secure than typical passwords
- **Device-specific** - Each device has its own certificate
- **Automatic login** - No need to type NickServ password on each connection

### Quick Start Guide

**5 Steps to Get Started:**

1. **Generate Certificate**
    - Go to Settings → Network Settings → Select your network
    - Scroll to "SASL EXTERNAL" section
    - Tap "➕ Generate New"
    - Fill in: Certificate Name, Common Name, Validity Period
    - Wait ~2 seconds for generation
    - Copy the fingerprint

2. **Add to NickServ**
    - Connect to your IRC network
    - Send fingerprint: `/msg NickServ CERT ADD <fingerprint>`
    - Or use app command: `/certadd` (after connecting)

3. **Configure Network**
    - Ensure SASL EXTERNAL is enabled in Network Settings
    - Certificate should already be applied (from step 1)
    - Save settings

4. **Connect**
    - Connect to your IRC network
    - Authentication happens automatically via SASL EXTERNAL

5. **Verify**
    - Check connection messages for SASL success
    - You should be automatically identified to NickServ

### Generating a Certificate

1. Open **Settings** → **Network Settings**
2. Select the network you want to configure
3. Scroll down to **SASL EXTERNAL** section
4. Tap **"➕ Generate New"** button

**Certificate Form:**

- **Certificate Name**: A friendly name (e.g., "My Phone", "Android Device")
- **Common Name (CN)**: Your IRC nickname or identifier (e.g., "YourNick/AndroidIRCX")
- **Validity Period**: How long the certificate is valid (1-10 years)
    - Recommendation: 1-2 years for security, 5+ years for convenience

5. Tap **"Generate Certificate"**
6. Wait 1-2 seconds for RSA key generation
7. **Copy the fingerprint** from the success screen

The certificate is automatically applied to your network settings.

### Registering Certificate with IRC Service

**Option A: Using NickServ (Most Common)**

1. Connect to your IRC network
2. Send command: `/msg NickServ CERT ADD <fingerprint>`
    - Replace `<fingerprint>` with the fingerprint you copied
    - Use the fingerprint format: `AA:BB:CC:DD:...` (with colons)

**Option B: Using App Command (After Certificate is Configured)**

1. Configure certificate in Network Settings first
2. Connect to your IRC network
3. Use command: `/certadd` (sends to NickServ by default)
4. Or specify service: `/certadd CertFP` or `/certadd HostServ`

**Option C: Using Context Menu**

1. Connect to your IRC network with certificate configured
2. Long-press the server tab
3. Select "Share Cert with NickServ" from context menu
4. Fingerprint is sent automatically

**Verification:**

- You should receive a confirmation from NickServ
- Typical response: "Added fingerprint to your account"
- Check your certificate list: `/msg NickServ CERT LIST`

### Network Configuration

**Enable SASL EXTERNAL:**

1. Go to Network Settings → Your Network
2. Scroll to **SASL** section
3. Enable "Enable SASL"
4. Set SASL Mechanism to **"EXTERNAL"**
5. Ensure your certificate is configured (should show in SASL EXTERNAL section)

**Certificate Options:**

- **Generate New** - Create a new certificate
- **Select Existing** - Choose from previously generated certificates
- **View Fingerprint** - Display current certificate's fingerprint
- **Manual Entry** - Paste PEM-encoded certificate/key manually

### Managing Certificates

**View All Certificates:**

- Network Settings → SASL EXTERNAL → "📁 Select Existing"
- Shows all generated certificates with status indicators:
    - 🟢 Valid (green) - Certificate is active
    - 🟠 Expires Soon (orange) - Less than 30 days remaining
    - 🔴 Expired (red) - Certificate has expired

**View Fingerprint:**

- Network Settings → SASL EXTERNAL → "🔑 View Fingerprint"
- Or long-press server tab → "View Certificate Fingerprint"
- Or use command: `/certfp` (when connected)

**Delete Certificate:**

- Open Certificate Selector
- Tap certificate → Delete button
- Confirm deletion
- Remember to remove from NickServ: `/msg NickServ CERT DEL <fingerprint>`

### IRC Commands

**`/certfp`** - Display your current certificate fingerprint

Usage:

```
/certfp
```

Output:

```
*** Certificate Fingerprint (SHA-256):
*** AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
***
*** To add to NickServ:
*** /msg NickServ CERT ADD AA:BB:CC:...
***
*** Or use: /certadd [service] (default: NickServ)
```

**`/certadd [service]`** - Send certificate fingerprint to IRC service

Usage:

```
/certadd              # Sends to NickServ (default)
/certadd NickServ     # Explicitly send to NickServ
/certadd CertFP       # Send to CertFP service
/certadd HostServ     # Send to HostServ service
```

### Troubleshooting

**Problem: "SASL authentication failed"**

Possible causes:

1. **Certificate not added to NickServ**
    - Solution: Add fingerprint with `/msg NickServ CERT ADD <fingerprint>`
    - Verify: `/msg NickServ CERT LIST`

2. **Wrong SASL mechanism**
    - Solution: Ensure SASL mechanism is set to "EXTERNAL" (not PLAIN)
    - Check: Network Settings → SASL → SASL Mechanism

3. **Certificate/key mismatch**
    - Solution: Regenerate certificate and re-add to NickServ

4. **Server doesn't support SASL EXTERNAL**
    - Solution: Contact network administrators
    - Alternative: Use SASL PLAIN with password

**Problem: "No certificate configured"**

Solutions:

- Go to Network Settings → SASL EXTERNAL
- Tap "Generate New" or "Select Existing"
- Ensure certificate is applied (should show "View Fingerprint" button)

**Problem: Certificate expired**

Solutions:

- Generate new certificate
- Add new fingerprint to NickServ
- Remove old certificate from app (optional)

### Security Best Practices

**Certificate Management:**

1. **Use separate certificates per device**
    - Don't share certificates between devices
    - Each device should have its own certificate
    - Easier to revoke if device is lost

2. **Set appropriate validity periods**
    - 1-2 years: Better security (force periodic renewal)
    - 5+ years: More convenient (less maintenance)
    - Balance security vs. convenience

3. **Backup certificates**
    - Export certificate from NickServ: `/msg NickServ CERT LIST`
    - Write down fingerprint for reference
    - Don't backup private keys (defeats purpose)

4. **Revoke old certificates**
    - Remove from NickServ: `/msg NickServ CERT DEL <fingerprint>`
    - Delete from app: Certificate Selector → Tap certificate → Delete

**Lost Device:**

If your device is lost or stolen:

1. From another device, remove certificate from NickServ:
   ```
   /msg NickServ CERT DEL <fingerprint>
   ```
2. Change your NickServ password (if you have one)
3. Check for unauthorized access: `/msg NickServ LISTVHOST`

### Supported Networks

Most modern IRC networks support SASL EXTERNAL:

- Libera.Chat
- OFTC
- Rizon
- EFnet (with Atheme)
- And many others

Check your network's documentation for specific instructions.

### Additional Resources

- **Network Documentation:**
    - Libera.Chat: https://libera.chat/guides/certfp
    - OFTC: https://www.oftc.net/NickServ/CertFP/
    - Rizon: https://wiki.rizon.net/index.php?title=CertFP

- **Technical References:**
    - RFC 5280: X.509 Certificate Standard
    - SASL EXTERNAL: RFC 4422, Section 4
    - IRC SASL: https://ircv3.net/specs/extensions/sasl-3.1

## 🔐 Security

- **TLS/SSL**: Full support for encrypted connections
- **App Lock**: Biometric/PIN lock with a quick lock action
    - Biometric unlock with improved error handling and retry mechanism
    - PIN unlock with error messages and retry support
    - Auto-lock on background/launch options
- **SASL**: Complete SASL PLAIN authentication support with proper CAP integration
- **Certificate Validation**: Configurable certificate checking
- **Password Storage**: Secure storage for secrets with biometric/PIN support (fallback to
  AsyncStorage when unavailable)

## 📝 IRC Protocol Compliance

This client implements the IRC protocol according to:

- **RFC 1459** (Internet Relay Chat Protocol) - Full compliance
- **RFC 2812** (IRC Client Protocol) - Extended numeric support
- **IRCv3 Specifications** (Complete implementation - 18 capabilities)

  **IRCv3.2 Standard Capabilities** (10):
    - CAP Negotiation (Multi-line LS 302 support)
    - SASL Authentication (RFC 4422 - PLAIN mechanism)
  - Message Tags (IRCv3.2)
  - Server-Time (IRCv3.2)
    - BATCH (IRCv3.2) - Message grouping
    - LABELED-RESPONSE (IRCv3.2) - Command correlation
    - CAP-NOTIFY (IRCv3.2) - Dynamic capabilities
    - ACCOUNT-TAG (IRCv3.2) - Account identification
    - SETNAME (IRCv3.2) - Realname changes
    - STANDARD-REPLIES (IRCv3.2) - FAIL/WARN/NOTE

  **IRCv3.3 Standard Capabilities** (1):
    - MESSAGE-IDS (IRCv3.3) - Unique message identifiers with deduplication

  **IRCv3 Additional Standards**:
    - BOT (IRCv3.2) - Bot mode marking
    - UTF8ONLY (IRCv3.2) - UTF-8 enforcement
    - EXTENDED-MONITOR (IRCv3.2) - Enhanced user monitoring
  - Account Notify (IRCv3.1)
  - Extended Join (IRCv3.1)
  - Away Notify (IRCv3.1)
  - CHGHOST (IRCv3.2)
  - Echo Message (IRCv3.2)
    - Multi-Prefix (IRCv3.1)
    - Invite Notify (IRCv3.2)

  **Draft IRCv3 Capabilities** (8):
    - draft/chathistory - Message history retrieval
    - draft/multiline - Multi-line message support
    - draft/read-marker - Read status tracking
    - draft/message-redaction - Message deletion
    - +draft/reply - Threaded conversations
    - +draft/react - Emoji reactions
    - +typing - Real-time typing indicators
    - +draft/channel-context - PM context tracking

**Total**: 27 capabilities requested, 18 major features implemented with graceful fallbacks

---

## 📄 License

This project is licensed under the GNU General Public License v3.0 or later (GPL-3.0-or-later).

Copyright (C) 2025-2026 Velimir Majstorov

This program is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
the [GNU General Public License](LICENSE.md) for more details.

You should have received a copy of the GNU General Public License along with this program. If not,
see <https://www.gnu.org/licenses/>.

---

## 🤖 AI Usage Disclaimer

This project was built with modern tools, including AI-assisted development.

Like robotics in manufacturing, autopilot systems in agriculture, and autocomplete in software,  
AI is a tool - no more, no less.

**AI did not build this project on its own.**  
Every decision, architectural choice, security consideration, and final line of code was reviewed,  
validated, and maintained by a human engineer with more than 25 years of professional experience.

AI did not replace engineering judgment; it accelerated routine work so more time could be spent
on  
architecture, quality, and usability.

If you prefer software created without automation or AI assistance, that choice is fully
respected.  
At the same time, refusing tools has never stopped progress - it has only determined who  
participates in shaping it.

This project exists to contribute something real to open source, with practical value and  
long-term maintenance. You are welcome to:

- use it or study it
- fork it or improve it
- or simply ignore it

All are valid choices.

Builders shape the future in silence. Spectators explain it when the work is already done.

In the end, technology moves forward with or without permission. The only question is who chose to
be part of it.

Some build loudly. Others build correctly.

Those who recognize the work will understand. Time will explain the rest.

🜂🜃🜂

---

## 📚 Additional Documentation

- [Debug Notes](DEBUG_NOTES.md) - Troubleshooting guide

**Note**: This project is in active development. Some features may be incomplete or subject to change.

