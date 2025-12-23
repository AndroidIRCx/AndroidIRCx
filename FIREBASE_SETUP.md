# Firebase Cloud Messaging Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter project name (e.g., "AndroidIRCX")
   - Enable/disable Google Analytics (optional)
   - Click "Create project"

## Step 2: Add Android App to Firebase

1. In Firebase Console, click the Android icon (or "Add app" > Android)
2. Enter your app details:
   - **Android package name**: `com.androidircx`
   - **App nickname**: AndroidIRCX (optional)
   - **Debug signing certificate SHA-1**: (optional, for now)
3. Click "Register app"

## Step 3: Download google-services.json

1. After registering, Firebase will provide a `google-services.json` file
2. **IMPORTANT**: Download this file
3. Place it in: `secrets/google-services.json` (build copies it into `android/app/`)

```
   secrets/
   |-- google-services.json  <- Place it here
   android/
   |-- app/
       |-- build.gradle
       `-- src/
```

## Step 4: Enable Cloud Messaging API (HTTP v1)

**Important**: The legacy Cloud Messaging API is deprecated. You must use the new HTTP v1 API.

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Click on **Cloud Messaging** tab
3. Enable **Firebase Cloud Messaging API (v1)**:
   - If you see it disabled, click the three-dot menu (⋮) next to it
   - Select **"Manage API in Google Cloud Console"**
   - On the Google Cloud Console page, click **"Enable"**
4. **Note**: The legacy API is deprecated and will be removed. The new HTTP v1 API is what you need.

## Step 5: Get Service Account Key (Optional - for sending notifications from server)

If you want to send notifications from your own server using the new HTTP v1 API:

1. In Firebase Console, go to **Project Settings**
2. Click on **Service Accounts** tab
3. Click **"Generate New Private Key"**
4. Click **"Generate Key"** to download a JSON file
5. **Store this file securely** - it contains your service account credentials
6. Use this JSON file to authenticate with the HTTP v1 API (not the legacy server key)

**For client-side (app)**: `react-native-notifications` automatically handles FCM token generation using the `google-services.json` file. No additional setup needed on the client side.

## Step 6: Rebuild the App

After placing `secrets/google-services.json`:

```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

## Verification

After setup, the app should:

- ✅ Initialize Firebase without errors
- ✅ `react-native-notifications` should work with FCM
- ✅ You can receive push notifications

## Troubleshooting

### Error: "Default FirebaseApp is not initialized"

- Make sure `secrets/google-services.json` exists (the build copies it into `android/app/`)
- Make sure the package name in `google-services.json` matches `com.androidircx`
- Rebuild the app after adding the file

### Error: "google-services.json not found"

- Verify the file is at: `secrets/google-services.json`
- Check file permissions (should be readable)

### Error: "Package name mismatch"

- The package name in `google-services.json` must match `com.androidircx`
- Check `android/app/build.gradle` → `applicationId = "com.androidircx"`

## Next Steps

After Firebase is set up, you can:

- Send test notifications from Firebase Console (uses HTTP v1 API automatically)
- Implement server-side notification sending using HTTP v1 API
- Configure notification channels and priorities
- Set up notification topics for group messaging

## Important Notes

- **Client-side (React Native app)**: Works automatically with `react-native-notifications` and `google-services.json`. No migration needed.
- **Server-side**: If you're sending notifications from your server, you must use the HTTP v1 API with OAuth 2.0 access tokens (not the legacy server key).
- The legacy API is deprecated and will stop working after June 20, 2024.

