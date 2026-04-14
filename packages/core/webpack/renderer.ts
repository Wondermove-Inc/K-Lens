/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import CircularDependencyPlugin from "circular-dependency-plugin";
import ForkTsCheckerPlugin from "fork-ts-checker-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import path from "path";
import { DefinePlugin, optimize } from "webpack";
import nodeExternals from "webpack-node-externals";
import {
  getQuietModeProgressPlugins,
  getWebpackLoggingOptions,
  handlebarsWarningPattern,
} from "../../../webpack/logging";
import { buildDir, isDevelopment, postcssConfigPath } from "./vars";

import type webpack from "webpack";
import type { WebpackPluginInstance } from "webpack";

// 🎯 목적: 루트 node_modules를 강제로 바라보는 helper 함수 (CircularDependencyPlugin 순환 방지)
// 📝 효과: require.resolve가 webpack config 디렉토리 기준이 아닌 루트 node_modules 기준으로 실행
const rootNodeModules = path.resolve(__dirname, "..", "..", "..", "node_modules");

// React 패키지 디렉토리 찾기 (루트 node_modules 기준)
const reactPath = path.dirname(require.resolve("react/package.json", { paths: [rootNodeModules] }));
const reactDomPath = path.dirname(require.resolve("react-dom/package.json", { paths: [rootNodeModules] }));

const loggingOptions = getWebpackLoggingOptions();

export function webpackLensRenderer(): webpack.Configuration {
  return {
    target: "electron-renderer",
    name: "skuberplus-app-renderer",
    mode: isDevelopment ? "development" : "production",
    // https://webpack.js.org/configuration/devtool/ (see description of each option)
    // 🔒 보안: 프로덕션 빌드에서 소스맵 비활성화 (소스코드 보호)
    devtool: isDevelopment ? "cheap-module-source-map" : false,
    // 🎯 목적: 프로덕션 빌드에서도 캐시 활성화하여 재빌드 시간 단축
    // 📝 효과: 재빌드 시 60% 빌드 시간 단축 예상
    cache: {
      type: "filesystem",
      buildDependencies: {
        config: [__filename],
      },
    },
    entry: {
      // 🎯 목적: shadcn globals.css를 프로젝트 전체 스타일 기준으로 통합
      // 📝 주의: globals.css가 renderer보다 먼저 로드되어야 CSS 변수가 정상 작동
      // 경로: packages/core/webpack/ → packages/ → packages/storybook-shadcn/
      globals: path.resolve(__dirname, "..", "..", "storybook-shadcn", ".storybook", "globals.css"),
      renderer: path.resolve(__dirname, "..", "src", "renderer", "library.ts"),
    },
    output: {
      library: {
        type: "commonjs2",
      },
      path: path.resolve(buildDir, "library"),
    },
    watchOptions: {
      ignored: /node_modules/, // https://webpack.js.org/configuration/watch/
    },
    ignoreWarnings: [
      /Critical dependency: the request of a dependency is an expression/,
      handlebarsWarningPattern,
      /\[ReactRefreshPlugin] .*?HMR.*? is not enabled/, // enabled in webpack.dev-server
    ],
    infrastructureLogging: loggingOptions.infrastructureLogging,
    stats: loggingOptions.stats,
    resolve: {
      extensions: [".js", ".jsx", ".json", ".ts", ".tsx"],
      alias: {
        // 🎯 목적: @/ alias를 packages/core/src/renderer/로 설정 (tsconfig.json과 동일)
        // 📝 변경: storybook-shadcn 내부 컴포넌트를 로컬 복사본으로 사용하므로 core/src/renderer 기준
        "@": path.resolve(__dirname, "..", "src", "renderer"),
        // 🎯 React alias 제거 (commonjs external과 충돌 방지)
        // 📝 이유: React를 externals로 처리하여 Node CJS 단일 인스턴스 사용 (2025-10-21)
      },
    },
    /**
     * 🎯 목적: Renderer process에서 external 모듈 처리
     *
     * 📝 주의사항:
     * - @ogre-tools 패키지들은 externals로 처리하여 Main/Renderer가 동일 인스턴스 공유
     * - React/MobX 패밀리는 commonjs external로 처리하여 Node CJS 단일 인스턴스 사용
     * - tar, byline, js-yaml, rfc4648, isomorphic-ws, stream-buffers, request, tslib, lucide-react는 Renderer에서 번들에 포함되어야 함 (Node.js 모듈 또는 React 컴포넌트)
     * - Renderer process는 Node.js 모듈을 직접 require할 수 없으므로 번들링 필요
     *
     * 🔄 변경이력:
     * - 2025-01-14 - tar, byline, js-yaml을 allowlist에 추가하여 번들에 포함
     * - 2025-10-15 - rfc4648, isomorphic-ws, stream-buffers, request, tslib를 allowlist에 추가
     * - 2025-10-21 - React/MobX 패밀리를 commonjs external로 처리 (React 복제본 이중 로딩 방지)
     * - 2025-10-26 - lucide-react를 allowlist에 추가하여 번들에 포함 (Welcome 테이블 아이콘용)
     */
    externals: [
      {
        handlebars: "commonjs handlebars",
      },
      "@ogre-tools/injectable",
      "@ogre-tools/injectable-extension-for-mobx",
      "@ogre-tools/injectable-extension-for-auto-registration",
      // 🎯 React/MobX 패밀리를 commonjs external로 처리
      // 📝 이유: @ogre-tools/injectable-react와 mobx-react-lite가 Node CJS React를 사용하므로
      //          Renderer 번들도 동일한 React 인스턴스를 사용해야 함 (React 복제본 2개 존재 방지)
      ({ request }, callback) => {
        if (typeof request === "string") {
          // React 패밀리 (react, react-dom, react/jsx-runtime, react/jsx-dev-runtime)
          if (/^react(-dom)?(\/|$)/.test(request)) {
            return callback(null, `commonjs ${request}`);
          }
          // MobX 패밀리 (mobx, mobx-react, mobx-react-lite)
          if (/^mobx(-react(-lite)?)?$/.test(request)) {
            return callback(null, `commonjs ${request}`);
          }
        }
        // 나머지는 다음 externals 처리로 넘김
        return callback();
      },
      nodeExternals({
        modulesFromFile: true,
        allowlist: [
          "js-yaml",
          "tar",
          "byline",
          "rfc4648",
          "isomorphic-ws",
          "stream-buffers",
          "request",
          "tslib",
          "lucide-react",
          // 🎯 shadcn UI 의존성들 (React 컴포넌트이므로 번들에 포함 필요)
          /@radix-ui\//, // @radix-ui로 시작하는 모든 패키지
          /@tabler\//, // @tabler로 시작하는 모든 패키지
          /@hookform\//, // @hookform으로 시작하는 모든 패키지
          "class-variance-authority",
          "cmdk",
          "next-themes",
          "sonner",
          "vaul",
          "react-day-picker",
          "react-hook-form",
          "embla-carousel-react",
          "input-otp",
          "react-resizable-panels",
          "recharts",
          "tw-animate-css",
          "date-fns",
          "chrono-node",
        ],
      }),
    ],
    optimization: {
      minimize: false,
    },
    module: {
      parser: {
        javascript: {
          commonjsMagicComments: true,
        },
      },
      rules: [
        {
          test: /\.node$/,
          use: "node-loader",
        },
        {
          test: (modulePath) =>
            (modulePath.endsWith(".ts") && !modulePath.endsWith(".test.ts")) ||
            (modulePath.endsWith(".tsx") && !modulePath.endsWith(".test.tsx")), // 🎯 .test.ts/.test.tsx 파일 제외 (중요!)
          exclude: [/node_modules/, /vendor[\\/]shadcn/],
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              compilerOptions: {
                sourceMap: false,
              },
            },
          },
        },
        {
          test: /\.(yaml|yml)$/,
          type: "asset/source",
        },
        cssModulesWebpackRule(),
        ...iconsAndImagesWebpackRules(),
        ...fontsLoaderWebpackRules(),
      ],
    },

    plugins: [
      ...getQuietModeProgressPlugins("core-renderer"),
      new DefinePlugin({
        CONTEXT_MATCHER_FOR_NON_FEATURES: `/\\.injectable\\.tsx?$/`,
        CONTEXT_MATCHER_FOR_FEATURES: `/\\/(renderer|common)\\/.+\\.injectable\\.tsx?$/`,
      }),
      new ForkTsCheckerPlugin({
        typescript: {
          memoryLimit: 2048,
        },
      }),

      new CircularDependencyPlugin({
        cwd: __dirname,
        exclude: /node_modules/,
        failOnError: true,
      }) as unknown as WebpackPluginInstance,

      new MiniCssExtractPlugin({
        filename: "[name].css",
      }),

      new optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
    ],
  };
}

/**
 * Import icons and image files.
 * Read more about asset types: https://webpack.js.org/guides/asset-modules/
 */
export function iconsAndImagesWebpackRules(): webpack.RuleSetRule[] {
  return [
    {
      test: /\.svg$/,
      type: "asset/source", // exports the source code of the asset, so we get XML
    },
    {
      test: /\.(jpg|png|ico)$/,
      type: "asset/resource",
      generator: {
        filename: "images/[name][ext]",
      },
    },
  ];
}

/**
 * Import custom fonts as URL.
 */
export function fontsLoaderWebpackRules(): webpack.RuleSetRule[] {
  return [
    {
      test: /\.(ttf|eot|woff2?)$/,
      type: "asset/resource",
      generator: {
        filename: "fonts/[name][ext]",
      },
    },
  ];
}

export interface CssModulesWebpackRuleOptions {
  styleLoader?: string;
}

/**
 * Import CSS or SASS styles with modules support (*.module.scss)
 */
export function cssModulesWebpackRule({ styleLoader }: CssModulesWebpackRuleOptions = {}): webpack.RuleSetRule {
  styleLoader ??= MiniCssExtractPlugin.loader;

  return {
    test: /\.s?css$/,
    use: [
      styleLoader,
      {
        loader: "css-loader",
        options: {
          sourceMap: isDevelopment,
          modules: {
            auto: /\.module\./i, // https://github.com/webpack-contrib/css-loader#auto
            mode: "local", // :local(.selector) by default
            localIdentName: "[name]__[local]--[hash:base64:5]",
          },
        },
      },
      {
        loader: "postcss-loader",
        options: {
          sourceMap: isDevelopment,
          postcssOptions: {
            config: postcssConfigPath,
          },
        },
      },
      {
        loader: "sass-loader",
        options: {
          api: "modern",
          sourceMap: isDevelopment,
        },
      },
    ],
  };
}

export default webpackLensRenderer;
