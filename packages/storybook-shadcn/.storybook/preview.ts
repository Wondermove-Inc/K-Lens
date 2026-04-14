import { withThemeByClassName } from "@storybook/addon-themes";

import type { Preview } from "@storybook/react-vite";

import "./globals.css";
import "./preview.css";

const preview: Preview = {
  parameters: {
    react: {
      rootSelector: "#root",
    },
    options: {
      storySort: {
        order: ["foundation", "design", "ui", "templates", "*"],
        method: "alphabetical",
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'error' - WCAG 2.1 AA compliance 준수 (접근성 위반 시 CI 실패)
      test: "error",
    },
    backgrounds: {
      disable: false,
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#0a0a0a" },
        { name: "gray", value: "#f5f5f5" },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: { width: "375px", height: "667px" },
          type: "mobile",
        },
        tablet: {
          name: "Tablet",
          styles: { width: "768px", height: "1024px" },
          type: "tablet",
        },
        desktop: {
          name: "Desktop",
          styles: { width: "1920px", height: "1080px" },
          type: "desktop",
        },
      },
      defaultViewport: "desktop",
    },
  },

  tags: ["autodocs"],
  decorators: [
    // 🎨 테마 및 모드 조합 선택 (7가지 색상 × 2가지 모드 = 14가지 조합)
    withThemeByClassName({
      themes: {
        "default-light": "theme-default-light",
        "default-dark": "theme-default-dark",
        "red-light": "theme-default-light theme-red-light",
        "red-dark": "theme-default-dark theme-red-dark",
        "orange-light": "theme-default-light theme-orange-light",
        "orange-dark": "theme-default-dark theme-orange-dark",
        "green-light": "theme-default-light theme-green-light",
        "green-dark": "theme-default-dark theme-green-dark",
        "blue-light": "theme-default-light theme-blue-light",
        "blue-dark": "theme-default-dark theme-blue-dark",
        "yellow-light": "theme-default-light theme-yellow-light",
        "yellow-dark": "theme-default-dark theme-yellow-dark",
        "violet-light": "theme-default-light theme-violet-light",
        "violet-dark": "theme-default-dark theme-violet-dark",
      },
      defaultTheme: "blue-light",
      parentSelector: "html",
    }),
  ],
};

export default preview;
