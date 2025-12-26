# Android IRC Client - Project Documentation

**Last Updated:** 2025-12-23
**Version:** 1.3.1
**Status:** Active Development

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Key Services](#key-services)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [Tab System](#tab-system)
7. [Multi-Network Support](#multi-network-support)
8. [Storage & Persistence](#storage--persistence)
9. [Known Issues](#known-issues)
10. [Recent Changes](#recent-changes)
11. [File Structure](#file-structure)
12. [Development Guidelines](#development-guidelines)
13. [Patches (patch-package)](#patches-patch-package)
14. [AI Project Guide](#ai-project-guide)
15. [Quick Start for AI Assistants](#quick-start-for-ai-assistants)

---

## Project Overview

**Android IRC Client** is a React Native IRC (Internet Relay Chat) application for Android with
advanced features including:

- Multi-network connections (connect to multiple IRC servers simultaneously)
- End-to-end encryption for DMs and channels
- Proxy/Tor support
- Background service for persistent connections
- Channel and query management
- User lists, WHOIS, channel modes
- Layout customization (tabs + user list positions)
- App lock with quick lock action
- Picture-in-Picture mode (Android)
- Improved settings search behavior and submenu access
- Scrollable identity profile lists in connection profiles
- DCC file transfers
- Notifications
- Firebase Crashlytics integration
- Google Mobile Ads

### E2E Trust & Verification

End-to-end encryption is only as strong as the key exchange. AndroidIRCX uses TOFU
(trust on first use) and key pinning for DM bundles:

- First accepted key is pinned for that nick.
- Any later key change triggers a warning and must be explicitly accepted.
- Use out-of-band verification before marking a key as verified.

UI flow:

- User list -> E2E Encryption -> Verify DM Key
- Compare fingerprints out-of-band and mark the key verified.

Additional verification / exchange options:

- Fingerprint QR codes for out-of-band verification
- File export/import of DM key bundles
- NFC key exchange (when supported)

**Tech Stack:**

- React Native 0.83.1
- React 19.2.3
- TypeScript 5.9.3
- Native modules for sockets, encryption (libsodium)
- AsyncStorage for persistence
- Firebase (Crashlytics, App Check)

---

## Architecture

### High-Level Structure

```
App.tsx (Main UI Component)
    ├── Services Layer
    │   ├── ConnectionManager (manages multiple IRC connections)
    │   ├── IRCService (handles IRC protocol per connection)
    │   ├── TabService (tab persistence)
    │   ├── MessageHistoryService (message persistence)
    │   ├── SettingsService (network configs, app settings)
    │   ├── ChannelEncryptionService (encrypted channels)
    │   ├── EncryptedDMService (encrypted DMs)
    │   └── ... (many other specialized services)
    │
    ├── Components
    │   ├── ChannelTabs (horizontal tab bar)
    │   ├── MessageArea (message list display)
    │   ├── MessageInput (text input with commands)
    │   ├── UserList (channel users sidebar)
    │   └── ... (other UI components)
    │
    └── Native Modules
        ├── TcpSocketModule (custom TCP socket implementation)
        ├── Libsodium (encryption)
        └── BatteryOptimizationCheck
```

### Key Patterns

1. **Service-Oriented Architecture**: Business logic is separated into services
2. **Event Emitters**: Services use EventEmitter pattern for communication
3. **Connection Manager Pattern**: Central manager coordinates multiple IRC connections
4. **Tab-Based UI**: Each channel/query/server has its own tab
5. **AsyncStorage**: All persistence (settings, tabs, messages) uses AsyncStorage

---

## Key Services

### ConnectionManager (`src/services/ConnectionManager.ts`)

**Purpose:** Manages multiple simultaneous IRC server connections

**Key Methods:**

- `connect(networkId, networkConfig, connectionConfig)` - Create new connection
- `disconnect(networkId)` - Disconnect from network
- `getActiveConnection()` - Get currently focused connection
- `getAllConnections()` - Get all active connections
- `setActiveConnection(networkId)` - Switch active network

**Important Logic:**

- Maintains a Map of `networkId -> ConnectionContext`
- Each ConnectionContext contains: IRCService, ChannelManagementService, UserManagementService, etc.
- When disconnecting, if it's the active connection, switches to next available or null
- Supports multiple connections to same network (adds suffix like "DBase (2)")

### IRCService (`src/services/IRCService.ts`)

**Purpose:** Handles IRC protocol for a single connection

**Key Methods:**

- `connect(config)` - Connect to IRC server
- `disconnect(message?)` - Disconnect with optional quit message
- `sendRaw(command)` - Send raw IRC command
- `joinChannel(channel)` - Join a channel
- `partChannel(channel, message?)` - Leave channel
- `onMessage(callback)` - Listen for IRC messages
- `onConnectionChange(callback)` - Listen for connection state changes

**Important Logic:**

- Uses TcpSocketModule for native socket connection
- Parses IRC protocol messages
- Emits events for: messages, connection changes, channel joins/parts, user lists, etc.
- Handles PING/PONG keepalive
- Manages channel user lists

### TabService (`src/services/TabService.ts`)

**Purpose:** Persist and load tabs per network

**Storage Key Pattern:** `TABS_{networkId}`

**Key Methods:**

- `getTabs(network)` - Load tabs for a network from storage
- `saveTabs(network, tabs)` - Save tabs for a network
- `removeTab(network, tabId)` - Remove specific tab

**Important Logic:**

- Returns default server tab if no tabs stored:
  `[{ id: 'server::{network}', name: network, type: 'server', ... }]`
- Filters messages when loading/saving (only structure is persisted)
- **NEW:** Filters out any "Not connected" tabs (added 2025-12-16)

### MessageHistoryService (`src/services/MessageHistoryService.ts`)

**Purpose:** Persist message history per tab

**Storage Key Pattern:** `MESSAGES_{networkId}_{tabId}`

**Key Methods:**

- `saveMessages(networkId, tabId, messages)` - Save messages for tab
- `loadMessages(networkId, tabId)` - Load messages for tab
- `clearMessages(networkId, tabId)` - Clear message history

**Limits:** Keeps last 200 messages per tab

### SettingsService (`src/services/SettingsService.ts`)

**Purpose:** Manage network configurations and app settings

**Key Methods:**

- `loadNetworks()` - Load all saved network configs
- `saveNetwork(network)` - Save network config
- `getNetwork(name)` - Get specific network config
- `deleteNetwork(name)` - Delete network
- `loadSettings()` / `saveSettings()` - App-wide settings

**Network Config Structure:**

```typescript
{
  name: string;           // e.g., "DBase"
  servers: ServerConfig[];
  nick: string;
  username: string;
  realname: string;
  password?: string;
  nickservPassword?: string;
  autoConnect?: boolean;
  autoJoinChannels?: string[];
  // ... many other optional fields
}
```

---

## Core Components

### App.tsx

**The Main Component** - Coordinates all services and manages global state

**Key State:**

- `tabs: ChannelTab[]` - All open tabs across all networks
- `activeTabId: string` - Currently visible tab
- `networkName: string` - Current network name for UI display
- `activeConnectionId: string | null` - Current active connection from ConnectionManager
- `isConnected: boolean` - Any connection active
- `channelUsers: Map<string, UserInfo[]>` - Users per channel

**Important useEffects:**

- Initial data load (line ~680): Loads default network, tabs, message history
- Tab save (line ~732): Saves tabs whenever they change
- Connection listeners setup (line ~764): Sets up message/event listeners for all connections

**Tab Management:**

- Each tab has: `{ id, name, type, networkId, messages, hasActivity, isEncrypted, ... }`
- Tab types: `'server' | 'channel' | 'query' | 'notice'`
- Tab IDs follow pattern: `server::{network}`, `channel::{network}::{channelName}`,
  `query::{network}::{nick}`

### ChannelTabs (`src/components/ChannelTabs.tsx`)

**Purpose:** Scrollable tab bar (horizontal or vertical based on layout)

**Props:**

- `tabs: ChannelTab[]`
- `activeTabId: string`
- `onTabPress: (tabId) => void`
- `onTabLongPress: (tab) => void`

**Features:**

- Shows encryption indicators (🔒/🔓) for channels/queries
- Activity indicator (different color) for unread messages
- Active tab highlighted with accent color

### MessageArea (`src/components/MessageArea.tsx`)

**Purpose:** Displays message list for active tab

**Features:**

- FlatList with inverted scroll
- Different message types: chat, action, system, notice, error, raw
- Timestamp formatting
- User mentions highlighting
- Link detection
- Image/video/audio preview
- Encryption status display

### MessageInput (`src/components/MessageInput.tsx`)

**Purpose:** Text input for sending messages and commands

**Features:**

- Multi-line support
- Command detection (lines starting with `/`)
- Auto-complete for nicks (Tab key simulation)
- Emoji support
- Send button

---

## Data Flow

### Connecting to a Server

```
1. User taps "Connect" in settings
   ↓
2. App.tsx: handleConnect() called
   ↓
3. ConnectionManager.connect(networkId, networkConfig, ircConfig)
   ↓
4. Creates new IRCService instance
   ↓
5. IRCService.connect() → TcpSocketModule connects
   ↓
6. IRCService emits 'registered' event when connection succeeds
   ↓
7. App.tsx listener: loads tabs for network, adds server tab if missing
   ↓
8. Sets activeConnectionId, networkName, switches to server tab
```

### Receiving a Message

```
1. TcpSocketModule receives data from socket
   ↓
2. IRCService parses IRC message
   ↓
3. IRCService emits 'message' event with IRCMessage object
   ↓
4. App.tsx onMessage listener receives message
   ↓
5. Checks message.channel to determine which tab it belongs to
   ↓
6. Updates tabs state: adds message to corresponding tab
   ↓
7. React re-renders → MessageArea displays new message
   ↓
8. useEffect saves updated tab messages to MessageHistoryService
```

### Sending a Message

```
1. User types message, presses send
   ↓
2. MessageInput calls handleSendMessage()
   ↓
3. App.tsx: handleSendMessage() called
   ↓
4. Checks if message starts with '/' (command)
   ↓
5a. If command: CommandService processes it
5b. If message: IRCService.sendMessage() → sends PRIVMSG
   ↓
6. Message sent to server via TcpSocketModule
   ↓
7. Local echo: adds message to tab immediately (optimistic update)
```

### Disconnecting

```
1. User selects "Disconnect"
   ↓
2. ConnectionManager.disconnect(networkId)
   ↓
3. IRCService.disconnect() → sends QUIT, closes socket
   ↓
4. IRCService emits connectionChange(false)
   ↓
5. App.tsx onConnectionChange listener:
   - Sets isConnected = false
   - Clears channelUsers
   - DOES NOT change networkName (keeps current network name)
   - DOES NOT change tabs or activeTabId
   ↓
6. ConnectionManager removes connection from Map
   ↓
7. If no other connections, activeConnectionId becomes null
```

---

## Tab System

### Tab Structure

```typescript
interface ChannelTab {
  id: string;              // Unique ID (e.g., "channel::DBase::#help")
  name: string;            // Display name (e.g., "#help")
  type: 'server' | 'channel' | 'query' | 'notice';
  networkId: string;       // Network this tab belongs to
  messages: IRCMessage[];  // Message history (in memory only)
  hasActivity?: boolean;   // Unread messages indicator
  isEncrypted?: boolean;   // Encryption status
}
```

### Tab Creation

**Server Tab:** Created automatically when connecting to network

- ID: `server::{networkId}`
- Name: `{networkId}`
- Type: `server`

**Channel Tab:** Created when joining channel or receiving channel message

- ID: `channel::{networkId}::{channelName}`
- Name: `{channelName}` (e.g., "#help")
- Type: `channel`

**Query Tab:** Created when sending/receiving private message

- ID: `query::{networkId}::{nick}`
- Name: `{nick}`
- Type: `query`

### Tab Persistence

- Tabs are saved to AsyncStorage whenever `tabs` state changes
- Grouped by networkId: `TABS_{networkId}`
- Only tab structure saved (no messages - those are saved separately)
- On app load, tabs are restored for the initial network
- When connecting to a network, its tabs are loaded and merged

### Tab Switching

- `activeTabId` state determines which tab is visible
- When switching tabs:
    - `hasActivity` flag cleared for that tab
    - UserActivityService notified
    - If channel tab, request user list if not cached

---

## Multi-Network Support

### ConnectionManager Architecture

- Supports multiple simultaneous IRC connections
- Each connection is independent with its own IRCService and related services
- `activeConnectionId` tracks which connection is currently focused
- All connections receive messages, but only active one is displayed prominently

### Network Identification

- Each connection has unique `networkId`
- If connecting to same network multiple times, suffix added: `"DBase (2)"`, `"DBase (3)"`, etc.
- All tabs for a network have matching `networkId`

### Switching Networks

- User can switch active network via UI
- Sets `activeConnectionId` in ConnectionManager
- Updates `networkName` for UI display
- Switches to that network's server tab

### Tab Management Across Networks

- `tabs` state contains tabs from ALL networks
- Tabs are grouped by `networkId` for display
- Tab sorting can be alphabetical or grouped by network
- When disconnecting from a network, its tabs remain in state (not removed)

---

## Storage & Persistence

### Storage Backends

- **Secure storage (preferred):** Secrets (passwords, SASL, oper passwords, channel keys, DM keys)
  are stored in OS secure storage via `SecureStorageService` (Keychain when available).
- **AsyncStorage (non-secret):** General configs, tabs, messages, and non-secret profile fields
  remain in AsyncStorage.
- **Fallback warning:** If secure storage is unavailable, secrets fall back to AsyncStorage (less
  secure). The app should surface a warning to users in this case.

### AsyncStorage Keys (non-secret data)

| Key Pattern                    | Purpose                      | Example                                |
|--------------------------------|------------------------------|----------------------------------------|
| `TABS_{networkId}`             | Tab structure for network    | `TABS_DBase`                           |
| `MESSAGES_{networkId}_{tabId}` | Message history              | `MESSAGES_DBase_channel::DBase::#help` |
| `NETWORKS`                     | All network configs          | `NETWORKS`                             |
| `SETTINGS`                     | App settings                 | `SETTINGS`                             |
| `CHANNEL_NOTES_{networkId}`    | Channel bookmarks            | `CHANNEL_NOTES_DBase`                  |
| `ENCRYPTED_DM_BUNDLES`         | Encryption keys for DMs      | - (now stored in secure storage)       |
| `CHANNEL_KEYS`                 | Encryption keys for channels | - (now stored in secure storage)       |

### Data Retention

- **Tabs:** Persistent until manually closed
- **Messages:** Last 200 messages per tab
- **Network Configs:** Persistent until deleted (secrets stored separately in secure storage when
  available)
- **Settings:** Persistent

### Clearing Data

- User can clear all app data via Android settings (secure storage entries may also need clearing,
  depending on platform APIs)
- Individual tabs can be closed (removes from storage)
- Message history can be cleared per tab

---

## Known Issues

### ✅ FIXED: "Not connected" Tab Issue

**Status:** FIXED (2025-12-16)

**Problem:**
When disconnecting from a server, a tab named "Not connected" appears and persists until manually
closed.

**Root Cause:**
The `activeTab` derivation in App.tsx (lines 429 and 1646) had an unsafe fallback that would create
temporary tabs with invalid networkIds:

```javascript
// OLD CODE (BUGGY):
const activeTab = tabs.find(...) || tabs.find(...) || tabs[0] || makeServerTab(selectedNetworkName || networkName || 'default');
```

If `networkName` was invalid or `'default'`, this would create a tab that could accidentally get
added to state and persisted.

**Solution Implemented:**

1. **Replaced unsafe activeTab fallback with safe function** (App.tsx:429-452):
    - Created `getActiveTabSafe()` function that validates networkId before creating tabs
    - Never creates tabs with invalid networkIds ('Not connected', '', 'default', null)
    - Returns minimal safe fallback tab if no valid network exists
    - Prevents temporary tabs from polluting state

2. **Fixed handleSendMessage** (App.tsx:1669-1676):
    - Removed unsafe fallback that created temporary tabs
    - Added guard to prevent sending messages when no valid tab exists

3. **Added automatic cleanup** (App.tsx:770-793):
    - New useEffect detects and removes invalid tabs from state automatically
    - Filters out tabs with networkId: 'Not connected', '', 'default', or null
    - Logs warnings when invalid tabs are detected for debugging

4. **Enhanced tab save logic** (App.tsx:795-808):
    - Skip saving for invalid network IDs
    - Prevents invalid tabs from being persisted to storage

**Files Modified:**

- `App.tsx` lines 429-452, 1669-1676, 770-808
- `src/services/TabService.ts` (already had defensive filters)

**Testing:**

1. Disconnect from server → No "Not connected" tab appears
2. Switch between networks → Active tab remains valid
3. Close all tabs → Safe fallback tab used without persisting
4. App restart → No invalid tabs loaded from storage

**Prevention:**
The fix includes multiple layers of defense:

- Validation before tab creation
- Automatic cleanup of invalid tabs
- Filtering when loading from storage
- Filtering when saving to storage

### Security Gaps (Needs Attention)

- Secure storage fallback: When OS secure storage (Keychain) is unavailable, secrets fall back to
  AsyncStorage. This is weaker; surface a clear user warning when falling back.
- At-rest encryption: Non-secret app data in AsyncStorage is not encrypted. Plan to support
  full-store encryption with PIN/biometric wrapping.
- TLS warnings: Self-signed or expired certs are allowed; ensure the UI warns clearly but does not
  silently skip validation.

---

## Recent Changes

### Unreleased (2025-12-26)

- **Major dependency upgrade:**
    - Upgraded React Native from 0.82.1 to 0.83.1
    - Upgraded React from 19.1.1 to 19.2.3
    - Upgraded TypeScript from 5.8.3 to 5.9.3
    - Upgraded ESLint from 8.19.0 to 9.39.2
    - Upgraded all other dependencies to latest versions
- **Android 15 compatibility fixes:**
    - Fixed edge-to-edge API deprecation: Updated React Native patch to skip deprecated
      `Window.setStatusBarColor()` and `Window.setNavigationBarColor()` on Android 15+ (API 35+)
    - Fixed foreground service crash on Android 15: Changed service type from `connectedDevice` to
      `dataSync` and updated permission from `FOREGROUND_SERVICE_CONNECTIVITY` to
      `FOREGROUND_SERVICE_DATA_SYNC` (fixes SecurityException crash when connecting to IRC server)

### Unreleased (2025-12-23)

- Docs: translate markdown to English, add patch usage notes, and clarify AI onboarding

### v1.3.1 (2025-12-23)

- Auto-connect favorites servers on startup across multiple networks
- Identity profile list now scrolls in Connection Profiles
- Settings search no longer auto-opens submenus; submenu items remain clickable
- Tabs can be positioned top/bottom/left/right (vertical tabs for side layouts)
- User list can be docked left/right/top/bottom
- Header lock icon for quick app lock/unlock and manual lock action
- User list context menu grouped into sections and made scrollable
- WHOWAS supports bracketed nicks and adds clearer feedback on missing history

### v1.3.0

- Picture-in-Picture mode
- Connection/Identity Profiles fixes
- IRC color formatting fixed for RAWs and browse channels
- Settings menu sorted
- RAW categories extended
- Bouncer detection fixes
- ZNC and IRCop command aliases extended
- Secure storage for sensitive data with PIN/biometric protection
- Oper command/raw handling fixes
- Server tab context menu: close all channels/privates
- Encryption upgrades: key verification (fingerprints/QR), TOFU warnings, key pinning
- Offline key exchange: QR, file, NFC
- Transifex added for future localization

### v1.2.15

- Repeating /me (ACTION) bug fixed
- WHOWAS bug fixed
- CTCP replies bugs fixed
- Better formatting for unknown server responses
- Added missing RAWs for RFC 1459/2812 and other numerics

### v1.2.14

- Crashlytics WHOWAS error fix

### v1.2.13

- Scroll safety validation added to prevent crashes

### v1.2.12

- Main thread blocking eliminated (debouncing and memoization)
- RegExp creation reduced via precompilation
- Sorting optimized
- FlatList rendering performance improved

### v1.2.11

- Backup modal: copy to clipboard + save to file
- Backup flow refactored

### v1.2.10

- Crashlytics-driven bug fixes
- Resource management cleanup implementation

### v1.2.9

- Reconnect issue fixed

### v1.2.8

- Encryption fixes for multi-network
- Notifications bug fixed after multi-network work
- Double quit raw fixed
- Optional hiding of IRCService listener logs
- LUSERS raw fixed
- Chat scroll jump bug fixed
- Auto-connect favorite server fix
- Fabric crash fix with UI-ready delay
- Firebase deprecation fix
- 3-way button over TextInput fix

## File Structure

```
D:\AndroidProjects\androidircx\
├── android/                    # Android native code
│   ├── app/
│   │   ├── src/main/java/      # Native modules (TcpSocket, Libsodium, etc.)
│   │   └── build.gradle        # Android build config
│   └── build.gradle
│
├── src/
│   ├── components/             # React components
│   │   ├── ChannelTabs.tsx
│   │   ├── MessageArea.tsx
│   │   ├── MessageInput.tsx
│   │   ├── UserList.tsx
│   │   ├── HeaderBar.tsx
│   │   └── ...
│   │
│   ├── services/               # Business logic services
│   │   ├── IRCService.ts       # IRC protocol handler
│   │   ├── ConnectionManager.ts # Multi-connection manager
│   │   ├── TabService.ts       # Tab persistence
│   │   ├── MessageHistoryService.ts
│   │   ├── SettingsService.ts
│   │   ├── ChannelEncryptionService.ts
│   │   ├── EncryptedDMService.ts
│   │   ├── CommandService.ts
│   │   └── ... (50+ services)
│   │
│   ├── screens/                # Screen components
│   │   ├── SettingsScreen.tsx
│   │   ├── AboutScreen.tsx
│   │   └── ...
│   │
│   ├── hooks/                  # Custom React hooks
│   │   └── useTheme.ts
│   │
│   ├── types/                  # TypeScript types
│   │   └── index.ts
│   │
│   └── utils/                  # Utility functions
│
├── App.tsx                     # Main app component
├── package.json
├── tsconfig.json
├── metro.config.js
└── PROJECT.md                  # This file
```

---

## Development Guidelines

### When Adding New Features

1. **Create/Update Services:** Business logic goes in services, not components
2. **Update This Document:** Add new services, components to relevant sections
3. **Document Known Issues:** If introducing workarounds, document them
4. **Test Multi-Network:** Ensure new features work with multiple connections
5. **Consider Persistence:** Does data need to survive app restart?

### When Fixing Bugs

1. **Document in Known Issues:** Add bug description, investigation notes
2. **Update Recent Changes:** Log all fixes attempted
3. **Add Tests:** If possible, add test cases to prevent regression
4. **Update Relevant Sections:** If architecture changes, update docs

### Code Style

- TypeScript strict mode
- Services use EventEmitter pattern for async events
- React hooks for state management
- Functional components only
- AsyncStorage for general persistence; secrets go to secure storage when available (falls back to
  AsyncStorage with warning)

---

## Patches (patch-package)

This project uses `patch-package` to keep small vendor fixes in version control.

### Where patches live

- Patches are stored in `patches/` and are applied automatically by `yarn install` or
  `npm install` via the `postinstall` script in `package.json`.

### Current patched packages

- `react-native` (0.83.1) - Android 15 edge-to-edge API compatibility fix
- `react-native-libsodium` (1.5.0)
- `react-native-document-picker` (9.3.1)

### How to update or add a patch

1. Edit the installed package in `node_modules/`.
2. Run `npx patch-package <package-name>` to generate or update the patch file.
3. Commit the updated patch in `patches/`.

### When patches are used

- During local development and CI after dependencies are installed (`postinstall`).
- Required for native or JS fixes that are not yet published upstream.

---

## AI Project Guide

This section is the agents-style briefing for any AI working on this repo.

### Mission and scope

- Build and maintain a React Native IRC client with multi-network support and end-to-end encryption.
- Prioritize reliability, predictable state management, and safe persistence behavior.
- Security changes must consider key pinning/verification and secure storage fallbacks.

### Source of truth

- `App.tsx` orchestrates UI state, services, and data flow.
- Service layer in `src/services/` contains almost all business logic.
- Protocol behavior and events live in `src/services/IRCService.ts`.
- Multi-connection behavior lives in `src/services/ConnectionManager.ts`.

### Invariants to preserve

- Tabs are identified by `type::{networkId}::{name}` patterns and must always have valid
  `networkId` values.
- Secrets must not be stored in AsyncStorage unless secure storage is unavailable, and the UI must
  warn when fallback happens.
- Multiple connections to the same network must remain distinct (suffix naming like "DBase (2)").
- Services communicate through EventEmitter patterns; avoid cross-service direct mutation.

### High-risk areas

- Connection lifecycle edge cases (reconnect, disconnect, network switching).
- Tab persistence and cleanup; invalid tabs must not be persisted.
- Encryption UX flows (TOFU warnings, key verification, and key bundle import/export).

### Change checklist

1. Update or add service logic first, then UI wiring in `App.tsx`.
2. Check multi-network behavior (tabs, active connection, background events).
3. Confirm persistence updates are safe and storage keys remain consistent.
4. Update `PROJECT.md` and `README.md` when behavior or architecture changes.

---

## Quick Start for AI Assistants

**When asked to help with this project:**

1. **Read this entire document first** to understand architecture
2. **Check Known Issues section** - problem might be documented
3. **Check Recent Changes** - context for recent work
4. **Understand the service layer** - most logic is in services
5. **Respect the patterns** - ConnectionManager for multi-network, EventEmitters for events
6. **Update this doc** - add any new discoveries or fixes

**Key Files to Understand:**

- `App.tsx` - Main UI orchestrator
- `src/services/ConnectionManager.ts` - Connection management
- `src/services/IRCService.ts` - IRC protocol
- `src/services/TabService.ts` - Tab persistence

**Common Tasks:**

- Adding IRC command: Modify `CommandService.ts`
- Adding UI feature: Create component, integrate in `App.tsx`
- Fixing connection issue: Check `IRCService.ts` and `ConnectionManager.ts`
- Fixing persistence issue: Check `TabService.ts`, `MessageHistoryService.ts`, or
  `SettingsService.ts`

---

**End of Document**

*This document is maintained as a living reference. Update it whenever significant changes are made
to the project.*

