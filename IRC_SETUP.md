# IRC Client Setup

## Instalacija

Projekat koristi `react-native-tcp-socket` za TCP konekcije u React Native okruženju.

### Android

Za Android, `react-native-tcp-socket` se automatski linkuje. Proverite da je u `android/app/build.gradle` dozvoljen cleartext traffic ako koristite ne-TLS konekcije:

```gradle
android {
    defaultConfig {
        ...
        // Za development - uklonite u production
        usesCleartextTraffic true
    }
}
```

### iOS

Za iOS, možda ćete morati da dodate dozvole u `Info.plist`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

## TLS/SSL Podrška

`react-native-tcp-socket` podržava TLS, ali za potpunu TLS podršku možda će biti potrebno dodatno podešavanje. Trenutna implementacija koristi osnovni TCP socket.

Za potpunu TLS podršku, razmotrite:
1. Korišćenje native modula za TLS
2. Korišćenje WebSocket proxy servera
3. Implementaciju custom native modula

## SASL Autentifikacija

SASL autentifikacija je implementirana osnovno. Za potpunu podršku, potrebno je implementirati:
- SASL PLAIN mehanizam
- SASL EXTERNAL mehanizam (za sertifikate)
- CAP negotiation

## Korišćenje

```typescript
import { ircService } from './src/services/IRCService';

// Konekcija sa TLS
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

// Slušanje poruka
ircService.onMessage((message) => {
  console.log('New message:', message);
});

// Pridruživanje kanalu
ircService.joinChannel('#android');

// Slanje poruke
ircService.sendMessage('#android', 'Hello!');
```

