import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";

const reactHooksShim = {
  rules: {
    "exhaustive-deps": {
      meta: { type: "suggestion", schema: [] },
      create() {
        return {};
      },
    },
    "rules-of-hooks": {
      meta: { type: "problem", schema: [] },
      create() {
        return {};
      },
    },
  },
};

export default [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/node_modules/**",
      "server/dist/**",
      "src-tauri/target/**",
      "whisper.cpp/**",
      "yjs-sync/**",
      "browser_extension/**",
      "api/youtube/transcript.ts.bak",
      ".eslintcache",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksShim,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
      "no-undef": "off",
      "no-empty": "warn",
      "no-case-declarations": "warn",
      "no-constant-binary-expression": "warn",
      "no-useless-escape": "warn",
      "no-redeclare": "warn",
      "no-this-before-super": "warn",
      "no-dupe-else-if": "warn",
      "no-useless-catch": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];
