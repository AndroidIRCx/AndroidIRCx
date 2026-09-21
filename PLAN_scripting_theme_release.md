# Scripting, themes, release and context-menu plan

## Scope and order

1. Make scripting syntax highlighting readable against every built-in and custom theme.
2. Keep app version 1.9.55 and use versionCode 163 for the corrected Play build, keeping all release metadata in sync.
3. Apply the safe subset of PR #359: react-native-bootsplash 7.3.3, react-native-iap 16.6.1 and react-native-localize 3.7.2. Keep Babel 7.29.7 and TypeScript 6.0.3 pinned.
4. Audit theme text/background pairs and improve low-contrast or overly harsh combinations without flattening each palette's identity.
5. Keep NickContextMenu open while the user drags or scrolls inside it; close only for an intentional backdrop press, Android back, the Close button, or a completed action.

## Definition of done

- Syntax token colours meet WCAG AA (4.5:1) against the active editor background for every built-in theme.
- Version is 1.9.55 / 163 in package.json, app.json, Android Gradle config and Fastlane changelog.
- The approved PR #359 packages and safe PR #361 updates are reflected in package.json/yarn.lock; Babel and TypeScript remain unchanged.
- Theme readability is protected by automated contrast tests.
- Scrolling or dragging the context-menu content does not call onClose; an explicit backdrop press still does.
- Targeted Jest tests, TypeScript, lint/format checks and git diff checks pass. Because native dependencies change, a clean Android build is required before release.
