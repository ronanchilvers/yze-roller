module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  plugins: ["react", "react-hooks", "jsx-a11y", "import"],
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
  ],
  rules: {
    "react/react-in-jsx-scope": "off",
    "import/extensions": [
      "error",
      "always",
      {
        js: "always",
        jsx: "always",
        ignorePackages: true,
      },
    ],
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.test.jsx", "**/test-helpers.js"],
      env: {
        node: true,
      },
    },
  ],
};