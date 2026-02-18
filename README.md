# AndroidIRCX

[![Build](https://github.com/androidircx/androidircx/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/androidircx/androidircx/actions/workflows/test.yml)
[![GitHub Release](https://img.shields.io/github/v/release/androidircx/androidircx)](https://github.com/androidircx/androidircx/releases)
[![Downloads](https://img.shields.io/github/downloads/androidircx/androidircx/total)](https://github.com/androidircx/androidircx/releases)
[![GitHub License](https://img.shields.io/github/license/androidircx/androidircx)](https://github.com/androidircx/androidircx/blob/master/LICENSE)

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/11929/badge)](https://www.bestpractices.dev/projects/11929)
[![CodeQL](https://img.shields.io/badge/CodeQL-enabled-blue)](https://github.com/AndroidIRCx/AndroidIRCx/security/code-scanning)
[![Dependabot](https://img.shields.io/badge/dependabot-enabled-brightgreen)](https://github.com/androidircx/androidircx/security/dependabot)
[![Coverage](https://codecov.io/gh/AndroidIRCx/AndroidIRCx/branch/master/graph/badge.svg)](https://app.codecov.io/gh/AndroidIRCx/AndroidIRCx/)

[![GitHub Stars](https://img.shields.io/github/stars/androidircx/androidircx?style=flat)](https://github.com/androidircx/androidircx/stargazers)
[![Contributors](https://img.shields.io/github/contributors/androidircx/androidircx)](https://github.com/androidircx/androidircx/graphs/contributors)
[![GitHub Issues](https://img.shields.io/github/issues/androidircx/androidircx)](https://github.com/androidircx/androidircx/issues)
[![Last Commit](https://img.shields.io/github/last-commit/androidircx/androidircx)](https://github.com/androidircx/androidircx/commits/master)

[![Google Play](https://img.shields.io/badge/Google%20Play-Download-green)](https://play.google.com/store/apps/details?id=com.androidircx)

**The open-source IRC client and framework for the mobile era.**

mIRC taught a generation how to script. [IRCap](http://ircap.net) by Carlos Esteve Cremades (since
1997) showed what a truly complete IRC experience could look like. AndroidIRCX carries that spirit
      forward - open source, built on React Native, and designed so you can learn, hack, extend, and
build your own IRC experience from real production code.

### 📲 Download

<p>
  <a href="https://play.google.com/store/apps/details?id=com.androidircx">
    <img alt="Get it on Google Play" src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" width="200" />
  </a>
</p>

|                                                                                               Google Play                                                                                                |  |                                                                                  Direct APK Download                                                                                  |
|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| <img src="https://api.qrserver.com/v1/create-qr-code/?size=360x360&qzone=4&ecc=M&data=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.androidircx" width="220" alt="Google Play QR" /> |  | <img src="https://api.qrserver.com/v1/create-qr-code/?size=360x360&qzone=4&ecc=M&data=https%3A%2F%2Fandroidircx.com%2Fuploads%2Fapp-release.apk" width="220" alt="APK Download QR" /> |
|                                                            [Google Play Store](https://play.google.com/store/apps/details?id=com.androidircx)                                                            |  |                                                             [Direct APK](https://androidircx.com/uploads/app-release.apk)                                                             |

### 🔒 Verified Builds

Every release APK and AAB is scanned with **VirusTotal** before publishing. Only builds matching the
published SHA-256 checksum are official releases.

- **SHA-256 checksum file:
  ** [app-release.apk.sha256](https://androidircx.com/uploads/app-release.apk.sha256)
- **VirusTotal scanning policy:** Every release build is scanned on VirusTotal before publishing.

**Verify your download:**

```bash
# Download the checksum
curl -O https://androidircx.com/uploads/app-release.apk.sha256

# Verify APK integrity
sha256sum -c app-release.apk.sha256
```

### 📱 System Requirements

| **_Requirements_** | **_Android version_** |
|--------------------|-----------------------|
| **Minimum**        | Android 7.0+ (API 24) |
| **Recommended**    | Android 11+ (API 30)  |
| **Target**         | Android 15 (API 36)   |

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

---

## 💡 Why AndroidIRCX?

Back in the day, mIRC wasn't just an IRC client - it was a platform. Scripts like IRCap turned it
into a complete environment with protection systems, away management, writing styles, and channel
moderation panels. People learned scripting, built addons, automated bots, and made IRC their own.

**AndroidIRCX is built for that same crowd, but open source and for today's platforms.**

This is a full-featured, production IRC client - but it's also a **learning platform** and a *
*framework** you can study, fork, and build on top of:

- **Learn TCP sockets** -- see how raw IRC protocol works over `react-native-tcp-socket`, TLS
  handshakes, proxy tunneling, SOCKS5/Tor
- **Learn state management** - 4 Zustand stores, 48 custom hooks, real-world patterns for complex
  React Native apps
- **Learn cryptography** - E2E encryption with libsodium (XChaCha20-Poly1305), SCRAM-SHA-256
  authentication (RFC 7677), X.509 certificate generation
- **Learn protocol implementation** - 390+ IRC numeric handlers, full IRCv3 compliance, CAP
  negotiation, SASL state machines
- **Learn architecture** - service-oriented design, EventEmitter patterns, context interfaces,
  modular handler extraction
- **Learn testing** - 160 test files covering services, hooks, components, stores, and utilities
- **Learn CI/CD** - GitHub Actions, Docker-based release builds, automated coverage reports

Everything is TypeScript. Everything is documented. Everything is yours to read, modify, and ship.

**This isn't a toy project.** It's a real app on Google Play with real users - and the entire
codebase is GPL-3.0, because the best way to learn is from code that actually works in production.

---

## ✨ Features

### Multi-Network IRC Client

- Connect to multiple IRC networks simultaneously
- Multiple servers per network with failover
- Background service for persistent connections
- Auto-connect favorites on startup
- Auto-join channels after connect
- Bouncer/ZNC detection and integration

### Full IRCv3 Compliance (27 capabilities)

**Standard capabilities:** server-time, account-notify, extended-join, userhost-in-names,
away-notify, chghost, message-tags, batch, labeled-response, echo-message, multi-prefix, monitor,
extended-monitor, cap-notify, account-tag, setname, standard-replies, message-ids, bot, sasl

**Draft capabilities:** typing indicators, chathistory, multiline, read-marker, message-redaction,
reply, react, channel-context, rename

### Security & Encryption

- **E2E Encrypted DMs** -- TOFU with key pinning, libsodium XChaCha20-Poly1305
- **Encrypted Channels** -- shared channel keys distributed via encrypted DM
- **SASL Authentication** -- PLAIN, SCRAM-SHA-256 (RFC 7677), EXTERNAL (client certificates)
- **Client Certificates** -- RSA-2048 X.509 generation, NickServ CERT integration
- **Key Verification** -- fingerprints, QR codes, NFC exchange, file export
- **App Lock** -- PIN and biometric authentication
- **Secure Storage** -- secrets in device Keychain, never in plain AsyncStorage

### Smart Command System

- 70+ command aliases (IRC, ZNC, IRCop, NickServ/ChanServ helpers)
- Context-aware autocomplete with scoring
- Command history (last 30 with dedup)
- IRC services panel (NickServ, ChanServ, HostServ, OperServ) with auto-detection across major IRCds

### Media & Communication

- DCC file transfers and DCC chat
- Voice messages, camera capture, video recording
- Media encryption with context-bound AAD
- Image/video preview and playback
- Link previews

### User Interface

- Configurable layout (tabs and userlist dockable to any edge)
- Real-time typing indicators (multi-user)
- Message search, reactions, read markers
- 3 themes (Dark, Light, IRcap) + custom theme editor
- Message format editor
- RAW command logging with 7 category filters
- Picture-in-Picture mode
- Landscape and portrait support

### Protection & Moderation

- Flood protection, anti-deop
- Clone detection
- Blacklist and ignore lists
- Ban mask types (0-9) with kick/ban reasons
- Away system with auto-answer, announce, presets

### Built-in Scripting Engine

- Write scripts to automate IRC tasks
- 50+ script hooks for events
- Time-based access (rewarded ads) or unlimited with Pro purchase
- Inspired by the mIRC scripting tradition
- Quick example:
  `module.exports = { onMessage: (msg) => {}, onCommand: (text) => text };`
- Common API: `api.log()`, `api.sendMessage()`, `api.sendCommand()`, `api.setTimer()`
- Full scripting API/docs: https://github.com/AndroidIRCx/AndroidIRCx/wiki/Scripting

### Internationalization

- 9 languages: English, French, German, Italian, Portuguese, Romanian, Russian, Serbian (Latin +
  Cyrillic), Spanish
- Transifex Native integration

---

## 🛠️ Tech Stack

|                   |                                                   |
|-------------------|---------------------------------------------------|
| **Framework**     | React Native 0.83.1, React 19.2.4                 |
| **Language**      | TypeScript 5.9.3                                  |
| **State**         | Zustand 5.0.11                                    |
| **Networking**    | react-native-tcp-socket (raw TCP/TLS)             |
| **Encryption**    | libsodium, node-forge, @noble/curves              |
| **Storage**       | AsyncStorage + Keychain (react-native-keychain)   |
| **Testing**       | Jest 30.2, Testing Library (160 test files)       |
| **CI/CD**         | GitHub Actions, Docker                            |
| **Notifications** | @notifee/react-native                             |
| **Media**         | vision-camera, react-native-video, audio-recorder |
| **i18n**          | Transifex Native (9 languages)                    |
| **Analytics**     | Firebase Crashlytics, App Check                   |

---

## 🏗️ Architecture

AndroidIRCX follows a service-oriented architecture with clear separation of concerns:

```
App.tsx (841 lines) -- Main UI orchestrator
|
+-- Zustand Stores (4)
|   connectionStore, tabStore, uiStore, messageStore
|
+-- Custom Hooks (48)
|   Connection lifecycle, tab management, message sending,
|   encryption, DCC, settings, UI state, and more
|
+-- Components (74 files)
|   AppLayout, MessageArea, MessageInput, ChannelTabs,
|   UserList, HeaderBar, 20+ modals, 15 settings sections
|
+-- Screens (33 files)
|   Settings, network config, theme editor, scripting,
|   key management, channel list, 7 help screens
|
+-- Services (69 root + 55 IRC modules = 124 files)
|   IRCService (2,711 lines) -- core protocol handler
|   irc/ (9,030 lines) -- extracted protocol modules:
|     18 command handlers, 15 numeric modules (390+ numerics),
|     10 send-command handlers, SCRAM-SHA-256 auth,
|     CTCP, batch/label, multiline, CAP negotiation
|   ConnectionManager, SettingsService, TabService,
|   EncryptedDMService, MediaEncryptionService,
|   ScriptingService, and 60+ more
|
+-- Utils (17 files)
    IRCFormatter, MessageParser, encodings, tab utils
```

### Key Design Patterns

- **Context Interfaces** -- extracted handler modules receive typed context objects, not full
  service references. This keeps modules testable and decoupled.
- **EventEmitter Communication** -- services talk via events, never cross-service direct mutation
- **Lazy Initialization** -- handlers instantiated on first use
- **Write Batching** -- messages batched (10/2s), tabs debounced (500ms)
- **StorageCache** -- LRU cache with TTL over AsyncStorage
- **Progressive Loading** -- critical data first, message history deferred per-tab

---

## 📁 Project Structure

```
AndroidIRCX/
+-- src/
|   +-- components/     74 UI components
|   |   +-- settings/   15 settings sections + 5 shared widgets
|   |   +-- modals/     4 certificate/network modals
|   +-- hooks/          48 custom hooks
|   +-- screens/        33 screens (+ 7 help screens)
|   +-- stores/         4 Zustand stores
|   +-- services/       69 root services
|   |   +-- irc/        55 extracted IRC protocol modules
|   |       +-- numerics/     15 numeric handler modules
|   |       +-- commands/     18 incoming command handlers
|   |       +-- sendCommands/ 10 outgoing command handlers
|   |       +-- protocol/     CTCP, batch/label, multiline
|   |       +-- cap/          CAP negotiation
|   |       +-- ScramAuth.ts  SCRAM-SHA-256 (RFC 7677)
|   +-- config/         App config + IRCd service detection
|   +-- themes/         Dark, Light, IRcap
|   +-- types/          6 type definition files
|   +-- utils/          17 utility modules
|   +-- i18n/           10 translation files
|   +-- core/           ServiceContainer (DI)
|   +-- interfaces/     Service type interfaces
|   +-- presets/        IRcap preset definitions
|
+-- __tests__/          160 test files
|   +-- services/       50+ service tests
|   +-- hooks/          40+ hook tests
|   +-- components/     15+ component tests
|   +-- stores/         4 store tests
|   +-- utils/          14 utility tests
|
+-- android/            Android native code
+-- scripts/
|   +-- docker/         Release build scripts
|   +-- transifex/      Translation sync scripts
+-- patches/            3 patch-package patches
+-- .github/workflows/  CI/CD (tests + Docker release)
+-- Dockerfile          Docker-based release builds
+-- App.tsx             Main component (841 lines)
+-- package.json        v1.7.5, GPL-3.0-or-later
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20
- Yarn
- Android SDK / Android Studio
- React Native CLI

### Setup

```bash
# Clone the repo
git clone https://github.com/androidircx/androidircx.git
cd androidircx

# Install dependencies
yarn install

# Start Metro bundler
yarn metro

# Run on Android device/emulator
yarn android
```

### Development Commands

```bash
yarn test             # Run all 160 test files
yarn type-check       # TypeScript check (tsc --noEmit)
yarn lint             # ESLint
yarn pre-push-check   # type-check + lint

# Translation management
yarn tx:pull          # Pull translations from Transifex
yarn tx:push          # Push source strings
yarn tx:merge-sr      # Merge missing Serbian keys
```

### Running Tests

```bash
# All tests with coverage
yarn test --coverage

# IRC protocol tests only (685+ tests)
npx jest --testPathPatterns="IRCService" --no-coverage

# Specific service
npx jest --testPathPatterns="services/EncryptedDMService" --no-coverage

# Specific hook
npx jest --testPathPatterns="hooks/useConnectionManager" --no-coverage
```

---

## 📚 For Developers & Learners

### Want to understand TCP sockets?

Start with `src/services/IRCService.ts` -- the `connect()` method shows raw TCP socket creation, TLS
upgrade, proxy tunneling (SOCKS5/HTTP/Tor), and buffer processing. Then look at `processBuffer()` to
see how IRC protocol lines are parsed from a TCP byte stream.

### Want to learn real-world React Native architecture?

Look at the hooks in `src/hooks/` -- 48 hooks that extract complex business logic from components.
`useConnectionLifecycle.ts` shows how to wire up event listeners for a real-time protocol.
`useLazyMessageHistory.ts` shows on-demand data loading patterns.

### Want to implement a network protocol?

The `src/services/irc/` directory is a textbook implementation of the IRC protocol:

- `numerics/` -- 15 modules handling 390+ server response codes
- `commands/` -- 18 handlers for every incoming IRC command
- `sendCommands/` -- 10 modules for user-initiated commands
- `cap/CAPHandlers.ts` -- IRCv3 capability negotiation state machine
- `ScramAuth.ts` -- SCRAM-SHA-256 challenge-response auth (RFC 7677/5802)

### Want to learn cryptography in practice?

- `src/services/EncryptedDMService.ts` -- TOFU key exchange, key pinning, XChaCha20-Poly1305
- `src/services/MediaEncryptionService.ts` -- file encryption with context-bound AAD
- `src/services/irc/ScramAuth.ts` -- SCRAM-SHA-256 with HMAC, PBKDF2, salted hashing
- `src/services/CertificateManagerService.ts` -- X.509 certificate generation with node-forge

### Want to add your own IRC command?

1. Create a handler in `src/services/irc/sendCommands/`
2. Register it in `IRCSendMessageHandlers.ts`
3. Add an alias in `CommandService.ts`
4. Write tests in `__tests__/`

That's it. The context interface pattern means your handler receives only what it needs -- no god
objects, no tight coupling.

---

## 📖 Wiki Guides

For end-user setup guides, feature walkthroughs, and troubleshooting, see the wiki:

- **Wiki Home:** https://github.com/AndroidIRCx/AndroidIRCx/wiki
- **Getting Started:** https://github.com/AndroidIRCx/AndroidIRCx/wiki/Getting-Started
- **Networks and Servers:** https://github.com/AndroidIRCx/AndroidIRCx/wiki/Networks-and-Servers
- **Connecting:** https://github.com/AndroidIRCx/AndroidIRCx/wiki/Connecting
- **User Management:** https://github.com/AndroidIRCx/AndroidIRCx/wiki/User-Management
- **IRC Services and Commands:
  ** https://github.com/AndroidIRCx/AndroidIRCx/wiki/IRC-Services-and-Commands
- **Channel Operations:** https://github.com/AndroidIRCx/AndroidIRCx/wiki/Channel-Operations
- **Channels and Tabs:** https://github.com/AndroidIRCx/AndroidIRCx/wiki/Channels-and-Tabs
- **DCC and File Transfers:** https://github.com/AndroidIRCx/AndroidIRCx/wiki/DCC-%26-File-Transfers
- **Security and Encryption:
  ** https://github.com/AndroidIRCx/AndroidIRCx/wiki/Security-and-Encryption
- **SASL EXTERNAL Certificates:
  ** https://github.com/AndroidIRCx/AndroidIRCx/wiki/SASL-EXTERNAL-Certificates
- **Commands and Scripting:** https://github.com/AndroidIRCx/AndroidIRCx/wiki/Commands-and-Scripting
- **Scripting (Full API):** https://github.com/AndroidIRCx/AndroidIRCx/wiki/Scripting
- **App Features:** https://github.com/AndroidIRCx/AndroidIRCx/wiki/App-Features
- **Advanced Settings:** https://github.com/AndroidIRCx/AndroidIRCx/wiki/Advanced-Settings
- **Troubleshooting:** https://github.com/AndroidIRCx/AndroidIRCx/wiki/Troubleshooting

---

## 🔧 Configuration

### Quick Connect

- **Tap the network name** in the header to connect
- **Tap the dropdown** -> "Connect to Default" for one-click connection
- **Connect Another Network** for simultaneous multi-network connections

### Adding a Network

1. Dropdown -> "Choose Network" -> tap **[+]** in the header
2. Configure: Network Name, Nickname, Alt Nick, Real Name, Auto-Join Channels
3. Add servers with hostname, port, SSL/TLS settings
4. Optional: SASL (PLAIN/SCRAM-SHA-256/EXTERNAL), proxy, client certificate
5. Save

### Client Certificate Authentication (SASL EXTERNAL)

AndroidIRCX supports passwordless authentication with X.509 client certificates:

1. **Generate** -- Settings -> Network -> SASL EXTERNAL -> Generate New (RSA-2048, SHA-256)
2. **Register** -- `/msg NickServ CERT ADD <fingerprint>` or use `/certadd`
3. **Connect** -- SASL EXTERNAL authenticates automatically

Commands: `/certfp` (view fingerprint), `/certadd [service]` (register with
NickServ/CertFP/HostServ)

### SCRAM-SHA-256 Authentication

For networks that support it, SCRAM-SHA-256 provides challenge-response authentication without
sending your password in cleartext. Configure SASL with mechanism "SCRAM-SHA-256" in network
settings.

---

## ⚙️ CI/CD

### Tests (on every push/PR)

GitHub Actions runs all 160 test files with coverage, uploaded to Codecov.

### Release Builds (Docker)

Automated Docker-based builds on push to master:

```
Dockerfile -> reactnativecommunity/react-native-android
           -> yarn install
           -> prepare-secrets.sh (inject signing keys)
           -> assembleRelease + bundleRelease (armeabi-v7a, arm64-v8a)
           -> upload artifacts
```

---

## 🤝 Contributing

AndroidIRCX is open source and contributions are welcome.

**Areas where you can help:**

- IRC protocol -- new IRCv3 capabilities, IRCd-specific features
- Testing -- more edge cases, integration tests
- Translations -- add or improve translations via Transifex
- UI/UX -- accessibility, new themes, layout improvements
- Documentation -- guides, tutorials, examples
- Security -- audit, improvements, new encryption features

**Before submitting a PR:**

```bash
yarn pre-push-check   # Must pass type-check + lint
yarn test             # Must pass all tests
```

---

## 🔐 Security

- **TLS/SSL** -- full encrypted connection support
- **SASL** -- PLAIN, SCRAM-SHA-256, EXTERNAL (client certificates)
- **E2E Encryption** -- libsodium XChaCha20-Poly1305 with context-bound AAD
- **Secure Storage** -- device Keychain for secrets (AsyncStorage fallback with warning)
- **App Lock** -- PIN and biometric with auto-lock on background/launch
- **Kill Switch** -- emergency disconnect and optional data wipe
- **Play Integrity** -- Google Play Integrity verification

---

## 📝 IRC Protocol Compliance

| Standard | Coverage                                       |
|----------|------------------------------------------------|
| RFC 1459 | Full compliance                                |
| RFC 2812 | Extended numeric support (390+ handlers)       |
| IRCv3    | 27 capabilities requested, full implementation |
| SASL     | PLAIN + SCRAM-SHA-256 (RFC 7677) + EXTERNAL    |
| DCC      | SEND, CHAT                                     |
| CTCP     | Full (VERSION, TIME, PING, ACTION, etc.)       |

---

## 🎨 Credits & Inspiration

**IRCap** (c) Carlos Esteve Cremades, 1997-2026 - the legendary mIRC script that inspired
AndroidIRCX's away system, protection features, writing styles, and the IRcap theme. If you used
mIRC in the 2000s, you probably know IRCap. Its futuristic design and complete feature set set the
bar for what an IRC experience should be.

**IRcap theme for AndroidIRCX** by ARGENTIN07, based on the original IRCap theme.

**Translations:** ARGENTIN07 and Cubanita83 (Spanish). See the full credits in the app's Credits
screen.

As an open-source creator, I deeply respect the work of **Linus Torvalds** and **Richard Stallman**
for the free/open-source software movement. Their vision and persistence were a direct inspiration
for building this app as open source.

[![Linux](https://img.shields.io/badge/Linux-Tux-FCC624?logo=linux&logoColor=black)](https://www.kernel.org/)
[![GNU](https://img.shields.io/badge/GNU-Project-A42E2B?logo=gnu&logoColor=white)](https://www.gnu.org/)

---

## 📄 License

**GNU General Public License v3.0 or later (GPL-3.0-or-later)**

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
AI is a tool -- no more, no less.

**AI did not build this project on its own.**
Every decision, architectural choice, security consideration, and final line of code was reviewed,
validated, and maintained by a human engineer with more than 25 years of professional experience.

AI did not replace engineering judgment; it accelerated routine work so more time could be spent on
architecture, quality, and usability.

If you prefer software created without automation or AI assistance, that choice is fully respected.
At the same time, refusing tools has never stopped progress -- it has only determined who
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

<p align="center">
  <a href="https://AndroidIRCx.com">
    <img src="https://AndroidIRCx.com/android-icon-192x192.webp" width="64" height="64" alt="AndroidIRCx">
  </a>
</p>

<p align="center">
  <b><a href="https://androidircx.com">AndroidIRCx.com</a></b>
</p>

---

*mIRC and IRCap set the standard. AndroidIRCX is the open-source platform that carries it forward.*
