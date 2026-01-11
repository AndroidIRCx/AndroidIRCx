const plugins = ['react-native-reanimated/plugin'];

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins,
  env: {
    production: {
      plugins: ['transform-remove-console', ...plugins],
    },
  },
};
