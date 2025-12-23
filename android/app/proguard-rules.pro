# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

########################################
# Firebase / Google Play Services
########################################

# Firebase App / App Check
-keep class com.google.firebase.appcheck.** { *; }
-keep class com.google.firebase.installations.** { *; }

# Play Integrity
-keep class com.google.android.play.core.integrity.** { *; }

# Firebase Messaging
-keep class com.google.firebase.messaging.** { *; }

# Firebase Crashlytics (OBAVEZNO)
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keep class com.google.firebase.crashlytics.** { *; }

# Firebase Analytics
-keep class com.google.firebase.analytics.** { *; }

# Google Play Services (Required for Firebase)
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Keep GMS measurement/analytics classes specifically
-keep class com.google.android.gms.measurement.** { *; }
-keep class com.google.android.gms.common.** { *; }

# Keep Parcelable classes and Creator fields
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# Keep Serializable classes
-keepnames class * implements java.io.Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep PackageInfo and SigningInfo classes
-keep class android.content.pm.PackageInfo { *; }
-keep class android.content.pm.SigningInfo { *; }
-keep class android.content.pm.SigningDetails { *; }

########################################
# Google Mobile Ads
########################################

-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

########################################
# Kotlin / Coroutines
########################################

-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

########################################
# React Native / Hermes safety
########################################

-keep class com.facebook.react.** { *; }
-dontwarn com.facebook.react.**

########################################
# OkHttp (used by Firebase)
########################################

-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

########################################
# General Android rules
########################################

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep R class and its inner classes
-keepclassmembers class **.R$* {
    public static <fields>;
}
