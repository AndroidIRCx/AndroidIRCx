# Settings Components

This directory contains all components related to the Settings screen, organized into reusable,
maintainable pieces.

## Architecture

The Settings screen has been refactored from a monolithic 4,861-line component into a modular
architecture:

- **Base Components**: Reusable setting UI components
- **Section Components**: Self-contained sections for different setting categories
- **Hooks**: State management hooks for settings
- **Utilities**: Helper functions for settings operations
- **Types**: TypeScript type definitions

## Directory Structure

```
src/components/settings/
├── SettingItem.tsx          # Generic wrapper for all setting items
├── SettingSwitch.tsx        # Switch/toggle setting component
├── SettingButton.tsx        # Button setting component
├── SettingInput.tsx         # Input field setting component
├── SettingSubmenu.tsx       # Submenu setting component
├── SettingsSectionHeader.tsx # Section header with expand/collapse
└── sections/                # Section components
    ├── AboutSection.tsx
    ├── AdvancedSection.tsx
    ├── AppearanceSection.tsx
    ├── BackgroundBatterySection.tsx
    ├── CommandsSection.tsx
    ├── ConnectionNetworkSection.tsx
    ├── DisplayUISection.tsx
    ├── HighlightingSection.tsx
    ├── MessageHistorySection.tsx
    ├── NotificationsSection.tsx
    ├── PremiumSection.tsx
    ├── PrivacyLegalSection.tsx
    ├── ScriptingAdsSection.tsx
    ├── SecurityQuickConnectSection.tsx
    ├── SecuritySection.tsx
    └── UsersServicesSection.tsx
```

## Base Components

### SettingItem

Generic wrapper component that renders different setting types based on the `SettingItem` type.

**Props:**

- `item: SettingItem` - The setting item configuration
- `icon?: SettingIcon` - Optional icon for the setting
- `colors` - Color theme object
- `styles` - StyleSheet styles
- `onPress?: (itemId: string) => void` - Callback for button/submenu presses
- `onValueChange?: (itemId: string, value: string | boolean) => void` - Callback for value changes

### SettingSwitch

Renders a switch/toggle setting.

**Props:**

- `item: SettingItem` (with `type: 'switch'`)
- `colors` - Color theme
- `styles` - Styles
- `onValueChange?: (value: boolean) => void`

### SettingButton

Renders a button setting.

**Props:**

- `item: SettingItem` (with `type: 'button'`)
- `colors` - Color theme
- `styles` - Styles
- `onPress?: () => void`

### SettingInput

Renders an input field setting.

**Props:**

- `item: SettingItem` (with `type: 'input'`)
- `colors` - Color theme
- `styles` - Styles
- `onValueChange?: (value: string) => void`
- `onPress?: () => void` - Called when input is submitted

### SettingSubmenu

Renders a submenu setting with expandable items.

**Props:**

- `item: SettingItem` (with `type: 'submenu'`)
- `colors` - Color theme
- `styles` - Styles
- `onPress?: (itemId: string) => void`

### SettingsSectionHeader

Renders a section header with icon, title, and expand/collapse functionality.

**Props:**

- `title: string` - Section title
- `icon?: SectionIcon` - Optional icon
- `isExpanded: boolean` - Whether section is expanded
- `onToggle: () => void` - Toggle callback
- `disabled?: boolean` - Whether toggle is disabled
- `colors` - Color theme
- `styles` - Styles

## Section Components

Each section component is self-contained and manages its own state. All section components follow a
similar pattern:

**Common Props:**

- `colors` - Color theme object
- `styles` - StyleSheet styles
- `settingIcons: Record<string, SettingIcon>` - Icon mappings
- Additional props specific to each section

### AboutSection

Displays app information, version, and links.

### AppearanceSection

Manages theme, language, and appearance settings.

**Uses:** `useSettingsAppearance` hook

### BackgroundBatterySection

Manages background connection and battery optimization settings.

**Uses:** `useSettingsNotifications` hook

### CommandsSection

Manages command history, aliases, and custom commands.

**State:**

- Command history
- Command aliases
- Custom commands
- Input states for adding new items

**Services:** `commandService`

### ConnectionNetworkSection

Comprehensive section for connection, network, channels, DCC, proxy, identity profiles, and password
locks.

**State:**

- Connection quality settings
- Auto-reconnect settings
- Channel favorites
- DCC settings
- Proxy configuration
- Identity profiles
- Password lock settings

**Services:** Multiple (connectionQualityService, autoReconnectService, channelFavoritesService,
etc.)

### DisplayUISection

Manages display and UI preferences.

### HighlightingSection

Manages highlight words for message highlighting.

**State:**

- Highlight words list
- New highlight word input

**Services:** `highlightService`

### MessageHistorySection

Manages message history settings and statistics.

**Services:** `messageHistoryService`

### NotificationsSection

Manages notification preferences.

**Uses:** `useSettingsNotifications` hook

### PremiumSection

Displays premium features and ad-related settings.

**Uses:** `useSettingsPremium` hook

### PrivacyLegalSection

Displays privacy and legal information.

### ScriptingAdsSection

Manages scripting and ad-related settings.

### SecurityQuickConnectSection

Manages security kill switch and quick connect settings.

**Uses:** `useSettingsSecurity` hook

### SecuritySection

Manages encryption keys, app lock, and key exchange settings.

**State:**

- QR/file/NFC exchange settings
- App lock settings (biometric & PIN)
- App lock modal state

**Services:** `settingsService`, `biometricAuthService`, `secureStorageService`

**Features:**

- Encryption key management
- Key migration
- App lock with biometric/PIN
- QR/file/NFC key exchange

### UsersServicesSection

Manages IRC services, user notes, and user aliases.

**State:**

- IRC services list
- User notes
- User aliases

**Services:** `settingsService`, `userManagementService`

## Usage Example

```tsx
import { AppearanceSection } from '../components/settings/sections';
import { useSettingsAppearance } from '../hooks/useSettingsAppearance';

function MySettingsScreen() {
  const appearanceSettings = useSettingsAppearance();
  const colors = { /* ... */ };
  const styles = { /* ... */ };

  return (
    <AppearanceSection
      colors={colors}
      styles={styles}
      settingIcons={SETTINGS_ICONS}
    />
  );
}
```

## Adding a New Section

1. Create a new file in `sections/` directory
2. Follow the pattern of existing sections:
    - Import necessary hooks/services
    - Define component props interface
    - Manage local state with `useState`
    - Load initial state with `useEffect`
    - Generate section data with `useMemo`
    - Render `SettingItem` components
3. Export from `sections/index.ts`
4. Add to `SettingsScreen.tsx`:
    - Import the component
    - Add placeholder in sections array
    - Add rendering logic in `renderSettingItem`

## Testing

Each section component should have corresponding tests in `__tests__/components/settings/`.

Test files:

- `HighlightingSection.test.tsx`
- `CommandsSection.test.tsx`
- `SecuritySection.test.tsx`
- (More tests to be added)

## Best Practices

1. **Self-contained**: Each section manages its own state
2. **Consistent Props**: Use the same props pattern (colors, styles, settingIcons)
3. **Type Safety**: Use TypeScript types from `types/settings.ts`
4. **Service Integration**: Use service classes for data operations
5. **Memoization**: Use `useMemo` for computed values
6. **Error Handling**: Handle errors gracefully with user feedback

## Related Files

- `src/hooks/useSettings*.ts` - State management hooks
- `src/utils/settingsHelpers.ts` - Utility functions
- `src/types/settings.ts` - Type definitions
- `src/config/settingsIcons.ts` - Icon mappings
- `src/screens/SettingsScreen.tsx` - Main settings screen
