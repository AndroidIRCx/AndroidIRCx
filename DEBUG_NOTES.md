# Debug Notes - IRC Connection Issues

## If the app crashes on connect

### 1. Rebuild the app

After installing `react-native-tcp-socket`, rebuild the app:

```bash
# Android
cd android
./gradlew clean
cd ..
npm run android

# Or directly
npx react-native run-android
```

### 2. Check logs

Use `adb logcat` to see detailed errors:

```bash
adb logcat | grep -i "irc\|tcp\|socket\|error"

adb logcat *:E ReactNative:V ReactNativeJS:V AndroidRuntime:E
```

Or in the React Native debugger, open the Console to see `console.log` output.

### 3. Check permissions

In `android/app/src/main/AndroidManifest.xml` you must have:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

### 4. TLS issues

If the connection does not establish with TLS:

- Check that the server supports TLS on port 6697
- Try `rejectUnauthorized: false` for testing
- Verify the server certificate

### 5. Native module linking

`react-native-tcp-socket` is autolinked in React Native 0.82+, but if you have issues:

```bash
# Verify the module is installed
npm list react-native-tcp-socket

# Rebuild the native module
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

### 6. Test connection

You can test the connection with:

```bash
# Test TLS connection
openssl s_client -connect irc.dbase.in.rs:6697
```

### 7. Common errors

**"Module not found" or "Cannot read property 'createConnection'":**

- Rebuild the app
- Check that `react-native-tcp-socket` is in `package.json`

**"Network request failed" or "Connection refused":**

- Check your internet connection
- Check that the server is online
- Check firewall rules

**"TLS handshake failed":**

- Verify the server certificate
- Try `tlsCheckValidity: false` for testing
