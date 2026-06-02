module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // worklets: false — nativewind/babel adds react-native-worklets/plugin last.
      ['babel-preset-expo', { jsxImportSource: 'nativewind', worklets: false }],
      'nativewind/babel',
    ],
  };
};
