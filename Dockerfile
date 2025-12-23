FROM reactnativecommunity/react-native-android:latest

WORKDIR /app

COPY package.json yarn.lock package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

WORKDIR /app/android

RUN chmod +x gradlew

CMD ["./gradlew", "clean", "assembleRelease", "bundleRelease"]