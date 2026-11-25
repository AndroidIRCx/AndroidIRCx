const reactNativeConfig = require('@react-native/eslint-config/flat');
const { fixupPluginRules } = require('@eslint/compat');

const eslint10CompatibleReactNativeConfig = reactNativeConfig.map(config => {
  if (!config.rules) {
    return config;
  }

  const rules = { ...config.rules };
  const plugins = Object.fromEntries(
    Object.entries(config.plugins ?? {}).map(([name, plugin]) => [
      name,
      fixupPluginRules(plugin),
    ]),
  );
  delete rules['eslint-comments/no-aggregating-enable'];
  delete rules['eslint-comments/no-unlimited-disable'];
  delete rules['eslint-comments/no-unused-disable'];
  delete rules['eslint-comments/no-unused-enable'];

  const languageOptions = config.languageOptions
    ? config.languageOptions.parser?.meta?.name === '@babel/eslint-parser'
      ? { ...config.languageOptions, parser: undefined }
      : config.languageOptions
    : undefined;

  return {
    ...config,
    ...(languageOptions ? { languageOptions } : {}),
    ...(config.plugins ? { plugins } : {}),
    rules,
  };
});

module.exports = [
  {
    // vendor/bundle holds locally installed Ruby gems and secrets/ local notes
    // and fetched protocol specs (both gitignored), not app code.
    ignores: [
      '.eslintrc.js',
      'eslint.config.js',
      'coverage/**',
      'vendor/bundle/**',
      'secrets/**',
    ],
  },
  ...eslint10CompatibleReactNativeConfig,
  {
    settings: {
      react: {
        version: '19.2',
      },
    },
  },
  {
    files: ['**/*.js'],
    rules: {
      'ft-flow/define-flow-type': 'off',
      'ft-flow/use-flow-type': 'off',
    },
  },
  {
    files: ['__tests__/**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-shadow': 'off',
      'jest/no-disabled-tests': 'off',
      'jest/no-identical-title': 'off',
    },
  },
  {
    files: [
      'src/components/AppUnlockModal.tsx',
      'src/components/ChannelLogModal.tsx',
      'src/components/ChannelNoteModal.tsx',
      'src/components/NickContextMenu.tsx',
      'src/components/OptionsMenu.tsx',
      'src/components/ServiceSelector.tsx',
      'src/components/TabOptionsModal.tsx',
      'src/components/WebRTCCallModal.tsx',
      'src/components/settings/SettingButton.tsx',
      'src/components/settings/SettingSubmenu.tsx',
      'src/components/settings/SettingSwitch.tsx',
      'src/components/settings/sections/SecurityQuickConnectSection.tsx',
      'src/screens/BackupScreen.tsx',
      'src/screens/ConnectionProfilesScreen.tsx',
      'src/screens/DataPrivacyScreen.tsx',
      'src/screens/FirstRunSetupScreen.tsx',
      'src/screens/NetworkSettingsScreen.tsx',
      'src/screens/ServerSettingsScreen.tsx',
      'src/screens/SoundSettingsScreen.tsx',
    ],
    rules: {
      'react-native/no-inline-styles': 'off',
    },
  },
  {
    files: [
      'src/components/AppLayout.tsx',
      'src/components/AppModals.tsx',
      'src/components/MessageInput.tsx',
      'src/components/OptionsMenu.tsx',
      'src/components/UserList.tsx',
      'src/components/settings/ThemeSelectorWithSettings.tsx',
      'src/hooks/useConnectionHandler.ts',
      'src/hooks/useConnectionLifecycle.ts',
      'src/hooks/useDccNotifications.ts',
      'src/hooks/useDeepLinkHandler.ts',
      'src/hooks/useLazyMessageHistory.ts',
      'src/hooks/useTabContextMenu.ts',
      'src/screens/ScriptingScreen.tsx',
    ],
    rules: {
      '@typescript-eslint/no-shadow': 'off',
    },
  },
  {
    files: [
      '__tests__/services/STSService.test.ts',
      '__tests__/services/irc/ScramAuth.test.ts',
      '__tests__/services/irc/protocol/CTCPHandlers.test.ts',
      'src/components/MediaMessageDisplay.tsx',
      'src/components/MessageInput.tsx',
      'src/components/modals/CertificateFingerprintModal.tsx',
      'src/services/irc/sendCommands/QueryCommands.ts',
      'src/utils/DecorationFormatter.ts',
    ],
    rules: {
      'dot-notation': 'off',
      'no-bitwise': 'off',
      'no-control-regex': 'off',
      'no-catch-shadow': 'off',
      'react/no-unstable-nested-components': 'off',
      'no-useless-escape': 'off',
    },
  },
];
