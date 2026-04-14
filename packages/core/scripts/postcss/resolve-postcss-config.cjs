const path = require("path");
const tailwindPath = require.resolve("@tailwindcss/postcss", { paths: [process.cwd()] });
const oklabPath = require.resolve("@csstools/postcss-oklab-function", { paths: [process.cwd()] });

module.exports = {
  plugins: [
    path.resolve(__dirname, "plugins", "resolve-global-selectors.cjs"),
    path.resolve(__dirname, "plugins", "remove-reference-at-rules.cjs"),
    path.resolve(__dirname, "plugins", "mask-css-modules-global.cjs"),
    [oklabPath, { preserve: true }], // 🎯 목적: oklch 색상 함수 지원 (storybook-shadcn globals.css 호환)
    tailwindPath,
    path.resolve(__dirname, "plugins", "unmask-css-modules-global.cjs"),
  ],
};
