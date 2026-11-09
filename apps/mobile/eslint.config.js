const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    files: ['scripts/**'],
    languageOptions: {
      globals: { __dirname: 'readonly', process: 'readonly', console: 'readonly' },
    },
  },
  { ignores: ['dist/*', 'dist-perf/*', 'coverage/*', '.expo/*', 'node_modules/*'] },
]);
