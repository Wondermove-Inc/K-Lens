import path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";

import type { StorybookConfig } from "@storybook/react-vite";

// 🔧 ES Module 환경에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
  // 🎯 스토리 파일 경로 포함
  stories: ["../src/components/ui/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "storybook-addon-remix-react-router",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  viteFinal: async (config) => {
    const { mergeConfig } = await import("vite");

    // 🔧 vite-tsconfig-paths 플러그인 추가 (관련 없는 tsconfig 파싱 오류 무시)
    config.plugins?.push(
      tsconfigPaths({
        // ⚠️ Git Submodule 환경에서 test/ 및 dist/ 디렉토리의 tsconfig 파싱 오류 무시
        ignoreConfigErrors: true,
        // 🎯 현재 패키지 디렉토리로 스캔 범위 제한
        root: path.resolve(__dirname, ".."),
      }),
    );

    // 🎯 vite-tsconfig-paths 플러그인이 tsconfig.json의 paths를 자동으로 처리하므로
    //    별도의 alias 설정 불필요 (오히려 충돌 방지)
    return config;
  },
};

export default config;
