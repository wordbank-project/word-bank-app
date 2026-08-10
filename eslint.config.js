// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Every if/for/while body must be braced, even single-statement ones —
      // matches word-bank-server's convention, see AGENTS.md's "Code style".
      curly: ["error", "all"],
    },
  },
  {
    ignores: ["dist/*"],
  }
]);
