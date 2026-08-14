module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': '.',
            '@components': './components',
            '@services': './services',
            '@stores': './stores',
            '@utils': './utils',
            '@types': './types',
            '@constants': './constants',
          },
        },
      ],
    ],
  };
};
