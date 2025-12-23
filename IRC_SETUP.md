# IRC Client Setup

## Installation

This project uses `react-native-tcp-socket` for TCP connections in React Native.

### Android

On Android, `react-native-tcp-socket` is autolinked. Verify that cleartext traffic is allowed in
`android/app/build.gradle` if you use non-TLS connections:

```gradle
android {
    defaultConfig {
        ...
        // For development only - remove in production
        usesCleartextTraffic true
    }
}
```

### iOS

On iOS, you may need to add permissions in `Info.plist`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

## TLS/SSL Support

`react-native-tcp-socket` supports TLS, but full TLS support may require additional setup. The
current implementation uses a basic TCP socket.

For full TLS support, consider:

1. Using native TLS modules
2. Using a WebSocket proxy server
3. Implementing a custom native module

## SASL Authentication

SASL authentication is implemented at a basic level. For full support, implement:

- SASL PLAIN mechanism
- SASL EXTERNAL mechanism (certs)
- CAP negotiation

## Usage

```typescript
import { ircService } from './src/services/IRCService';

// TLS connection
await ircService.connect({
  host: 'irc.freenode.net',
  port: 6697,
  nick: 'YourNick',
  username: 'yourusername',
  realname: 'Your Real Name',
  tls: true,
  sasl: {
    account: 'your_account',
    password: 'your_password',
  },
});

// Listen for messages
ircService.onMessage((message) => {
  console.log('New message:', message);
});

// Join a channel
ircService.joinChannel('#android');

// Send a message
ircService.sendMessage('#android', 'Hello!');
```
