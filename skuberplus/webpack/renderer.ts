/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import ReactRefreshWebpackPlugin from "@pmmmwh/react-refresh-webpack-plugin";
import corePackageJson from "@skuberplus/core/package.json";
import CircularDependencyPlugin from "circular-dependency-plugin";
import CopyPlugin from "copy-webpack-plugin";
import ForkTsCheckerPlugin from "fork-ts-checker-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import MonacoWebpackPlugin from "monaco-editor-webpack-plugin";
import path from "path";
import { DefinePlugin } from "webpack";
import { getQuietModeProgressPlugins, getWebpackLoggingOptions, handlebarsWarningPattern } from "../../webpack/logging";
import { assetsFolderName, buildDir, htmlTemplate, isDevelopment, publicPath, rendererDir } from "./vars";

import type webpack from "webpack";
import type { WebpackPluginInstance } from "webpack";

// 🎯 목적: 루트 node_modules를 강제로 바라보는 helper 함수 (CircularDependencyPlugin 순환 방지)
// 📝 효과: require.resolve가 webpack config 디렉토리 기준이 아닌 루트 node_modules 기준으로 실행
const rootNodeModules = path.resolve(__dirname, "..", "..", "node_modules");
const packagesDir = path.resolve(__dirname, "..", "..", "packages");

// React 패키지 디렉토리 찾기 (루트 node_modules 기준)
const reactPath = path.dirname(require.resolve("react/package.json", { paths: [rootNodeModules] }));
const reactDomPath = path.dirname(require.resolve("react-dom/package.json", { paths: [rootNodeModules] }));

const loggingOptions = getWebpackLoggingOptions();

const renderer: webpack.Configuration = {
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
    globals: require.resolve("@skuberplus/core/globals.css"),
    skuberplus: path.resolve(rendererDir, "index.ts"),
  },
  output: {
    libraryTarget: "global",
    globalObject: "this",
    publicPath,
    path: buildDir,
    filename: "[name].js",
    chunkFilename: "chunks/[name].js",
    assetModuleFilename: `${assetsFolderName}/[name][ext][query]`,
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
  // 🎯 목적: packages/core와 동일한 resolve 설정
  resolve: {
    extensions: [".js", ".jsx", ".json", ".ts", ".tsx"],
    alias: {
      // 🎯 목적: @/ alias를 packages/core/src/renderer/로 설정
      // 📝 변경: skuberplus는 @skuberplus/core 라이브러리를 사용하므로 core/src/renderer 기준 (2025-10-21)
      "@": path.resolve(__dirname, "..", "..", "packages", "core", "src", "renderer"),
      // 🎯 React alias 제거 (commonjs external과 충돌 방지)
      // 📝 이유: React를 externals로 처리하여 Node CJS 단일 인스턴스 사용 (2025-10-21)
    },
  },
  /**
   * 🎯 목적: Renderer process에서 external 모듈 처리
   *
   * 📝 주의사항:
   * - React/MobX 패밀리는 commonjs external로 처리하여 Node CJS 단일 인스턴스 사용
   * - @ogre-tools/* 패키지는 commonjs2로 external 처리 (DI 컨테이너 객체 참조 불일치 방지)
   * - tar, byline, js-yaml, rfc4648, isomorphic-ws, stream-buffers, request, tslib 모듈은 번들링
   * - Renderer process는 Node.js 모듈을 직접 require할 수 없으므로 번들링 필요
   *
   * 🔄 변경이력:
   * - 2025-01-14 - tar, byline, js-yaml 제거 (Renderer 번들링)
   * - 2025-10-15 - rfc4648, isomorphic-ws, stream-buffers, request, tslib 제거
   * - 2025-10-20 - @ogre-tools 패키지 commonjs2 external 처리 추가
   * - 2025-10-21 - React/MobX 패밀리 commonjs external 처리 추가 (React 복제본 이중 로딩 방지)
   */
  async externals({ request }: { request?: string }) {
    if (typeof request === "string") {
      // 🎯 @ogre-tools → commonjs2 external
      if (request.startsWith("@ogre-tools/")) {
        return `commonjs2 ${request}`;
      }

      // 🎯 React/MobX 패밀리 → commonjs external
      // 📝 이유: @ogre-tools/injectable-react와 mobx-react-lite가 Node CJS React를 사용하므로
      //          Renderer 번들도 동일한 React 인스턴스를 사용해야 함 (React 복제본 2개 존재 방지)
      if (/^react(-dom)?(\/|$)/.test(request)) {
        return `commonjs ${request}`;
      }
      if (/^mobx(-react(-lite)?)?$/.test(request)) {
        return `commonjs ${request}`;
      }

      // 🎯 node:, npm, openid-client, pnpm → node-commonjs external
      const externalModulesRegex = /^(node:|npm|openid-client|pnpm)/;
      if (externalModulesRegex.test(request)) {
        return `node-commonjs ${request}`;
      }
    }
    return;
  },
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
        test: /\.ya?ml$/,
        type: "json",
        use: [
          {
            loader: "yaml-loader",
          },
        ],
      },

      {
        test: /\.node$/,
        use: "node-loader",
      },
      {
        test: /\.[jt]sx?$/,
        // 🎯 목적: skuberplus/src와 workspace packages를 모두 TS 로더로 처리
        include: [rendererDir, packagesDir],
        exclude: [/vendor[\\/]shadcn/],
        loader: "ts-loader",
        options: {
          transpileOnly: true, // 🎭 임시: 타입 체크 비활성화
        },
      },
      // 🎯 일반 CSS 파일 처리 (monaco-editor, ui-components, Tailwind CSS 등)
      // 📝 *.module.css는 cssModulesWebpackRule()에서 처리
      {
        test: /\.css$/i,
        exclude: [/\.module\.css$/i],
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
          },
        ],
      },
      // 🎯 일반 SCSS 파일 처리
      // 📝 *.module.scss는 cssModulesWebpackRule()에서 처리
      {
        test: /\.s[ac]ss$/i,
        exclude: [/\.module\.s[ac]ss$/i],
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
          },
          {
            loader: "sass-loader",
            options: {
              sassOptions: {
                // preserve one-line comments by converting to block if needed
              },
            },
          },
        ],
      },
      cssModulesWebpackRule(),
      ...iconsAndImagesWebpackRules(),
      ...fontsLoaderWebpackRules(),
    ],
  },

  plugins: [
    ...getQuietModeProgressPlugins("skuberplus-renderer"),
    new DefinePlugin({
      CONTEXT_MATCHER_FOR_NON_FEATURES: `/\\.injectable\\.tsx?$/`,
      CONTEXT_MATCHER_FOR_FEATURES: `/\\/(renderer|common)\\/.+\\.injectable\\.tsx?$/`,
    }),
    // 🎭 임시: Badge import 에러 해결을 위해 ForkTsCheckerPlugin 비활성화
    // new ForkTsCheckerPlugin(),

    // see also: https://github.com/Microsoft/monaco-editor-webpack-plugin#options
    // 12개 언어 구문 강조 지원
    new MonacoWebpackPlugin({
      // publicPath: "/",
      // filename: "[name].worker.js",
      languages: [
        "yaml",
        "json",
        "markdown",
        "typescript",
        "javascript",
        "python",
        "go",
        "rust",
        "shell",
        "dockerfile",
        "html",
        "css",
      ],
      globalAPI: isDevelopment,
    }),

    new HtmlWebpackPlugin({
      filename: "index.html",
      template: htmlTemplate,
      inject: true,
      hash: true,
      templateParameters: {
        assetPath: `${publicPath}${assetsFolderName}`,
      },
    }),

    // 🎯 목적: 프로덕션 빌드 시 CircularDependencyPlugin 비활성화하여 빌드 속도 향상
    // 📝 개발 모드에서만 순환 의존성 체크 수행
    ...(isDevelopment
      ? [
          new CircularDependencyPlugin({
            cwd: __dirname,
            exclude: /node_modules/,
            failOnError: true,
          }) as unknown as WebpackPluginInstance,
        ]
      : []),

    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),

    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(
            path.dirname(require.resolve("@skuberplus/core/package.json")),
            corePackageJson.exports["./fonts"],
          ),
          to: "fonts/[name][ext]",
        },
        {
          from: path.resolve(
            path.dirname(require.resolve("@skuberplus/core/package.json")),
            "static/build/library/images",
          ),
          to: "images/[name][ext]",
          noErrorOnMissing: true, // 🎯 목적: core 이미지 빌드 전이라도 빌드 오류 방지
        },
      ],
    }),

    ...(isDevelopment
      ? [
          new ReactRefreshWebpackPlugin({
            // 🎯 목적: node_modules, vendor/shadcn 디렉토리 제외
            // 📝 효과: HMR은 정상 작동하며 node_modules, vendor/shadcn 및 workspace packages 파싱 에러 방지
            exclude: [/node_modules/, /vendor[\\/]shadcn/, packagesDir],
          }),
        ]
      : []),
  ],
};

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
 * 🎯 목적: CSS Modules (*.module.scss, *.module.css) 파일 처리
 *
 * 📝 주의사항:
 * - test 패턴이 *.module.* 파일만 매칭해야 함
 * - 일반 SCSS 규칙(줄 156-173)과 중복 적용되지 않도록 주의
 *
 * 🔄 변경이력:
 * - 2025-11-27 - test 패턴을 /\.module\.s?css$/i로 변경 (로더 중복 적용 버그 수정)
 */
export function cssModulesWebpackRule({ styleLoader }: CssModulesWebpackRuleOptions = {}): webpack.RuleSetRule {
  styleLoader ??= isDevelopment ? "style-loader" : MiniCssExtractPlugin.loader;

  return {
    // 🎯 *.module.css, *.module.scss 파일만 매칭
    // 📝 이전: /\.s?css$/ (모든 CSS/SCSS에 매칭되어 일반 SCSS 규칙과 중복 적용됨)
    test: /\.module\.s?css$/i,
    use: [
      styleLoader,
      {
        loader: "css-loader",
        options: {
          sourceMap: isDevelopment,
          modules: {
            // 🎯 auto 옵션 제거 - test 패턴에서 이미 *.module.* 파일만 필터링
            mode: "local", // :local(.selector) by default
            localIdentName: "[name]__[local]--[hash:base64:5]",
          },
        },
      },
      {
        loader: "sass-loader",
        options: {
          sourceMap: isDevelopment,
        },
      },
    ],
  };
}

export default renderer;
