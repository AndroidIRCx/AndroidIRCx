# Debug Notes - IRC Connection Issues

## Ako aplikacija pada pri konekciji

### 1. Rebuild aplikacije

Nakon instalacije `react-native-tcp-socket`, morate rebuild-ovati aplikaciju:

```bash
# Za Android
cd android
./gradlew clean
cd ..
npm run android

# Ili direktno
npx react-native run-android
```

### 2. Proverite logove

Koristite `adb logcat` da vidite detaljne greške:

```bash
adb logcat | grep -i "irc\|tcp\|socket\|error"

adb logcat *:E ReactNative:V ReactNativeJS:V AndroidRuntime:E
```

Ili u React Native debuggeru, otvorite Console da vidite `console.log` poruke.

### 3. Proverite dozvole

U `android/app/src/main/AndroidManifest.xml` mora biti:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

### 4. TLS problemi

Ako se konekcija ne uspostavi sa TLS:

- Proverite da li server podržava TLS na portu 6697
- Pokušajte sa `rejectUnauthorized: false` za testiranje
- Proverite sertifikat servera

### 5. Native modul linkovanje

`react-native-tcp-socket` se automatski linkuje u React Native 0.82+, ali ako imate problema:

```bash
# Proverite da li je modul instaliran
npm list react-native-tcp-socket

# Rebuild native modul
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

### 6. Test konekcije

Možete testirati konekciju sa:

```bash
# Test TLS konekcije
openssl s_client -connect irc.dbase.in.rs:6697
```

### 7. Česte greške

**"Module not found" ili "Cannot read property 'createConnection'":**

- Rebuild aplikacije
- Proverite da li je `react-native-tcp-socket` u `package.json`

**"Network request failed" ili "Connection refused":**

- Proverite internet konekciju
- Proverite da li server radi
- Proverite firewall

**"TLS handshake failed":**

- Proverite sertifikat servera
- Pokušajte sa `tlsCheckValidity: false` za testiranje
