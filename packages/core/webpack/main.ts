/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import ForkTsCheckerPlugin from "fork-ts-checker-webpack-plugin";
import path from "path";
import { DefinePlugin } from "webpack";
import nodeExternals from "webpack-node-externals";
import {
  getQuietModeProgressPlugins,
  getWebpackLoggingOptions,
  handlebarsWarningPattern,
} from "../../../webpack/logging";
import { iconsAndImagesWebpackRules } from "./renderer";
import { buildDir, isDevelopment } from "./vars";

import type webpack from "webpack";

const loggingOptions = getWebpackLoggingOptions();

const webpackLensMain = (): webpack.Configuration => {
  return {
    name: "core-library-main",
    context: __dirname,
    target: "electron-main",
    mode: isDevelopment ? "development" : "production",
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
      main: path.resolve(__dirname, "..", "src", "main", "library.ts"),
    },
    output: {
      library: {
        type: "commonjs2",
      },
      path: path.resolve(buildDir, "library"),
    },
    optimization: {
      minimize: false,
    },
    ignoreWarnings: [handlebarsWarningPattern],
    infrastructureLogging: loggingOptions.infrastructureLogging,
    stats: loggingOptions.stats,
    resolve: {
      extensions: [".json", ".js", ".ts"],
    },
    // 🎯 @ogre-tools 패키지들을 externals로 처리하여 Main process와 동일 인스턴스 공유
    externals: [
      {
        "utf-8-validate": "commonjs utf-8-validate",
        bufferutil: "commonjs bufferutil",
      },
      {
        handlebars: "commonjs handlebars",
      },
      "@ogre-tools/injectable",
      "@ogre-tools/injectable-extension-for-mobx",
      "@ogre-tools/injectable-extension-for-auto-registration",
      nodeExternals({ modulesFromFile: true }),
    ],
    module: {
      parser: {
        javascript: {
          commonjsMagicComments: true,
        },
      },
      rules: [
        {
          test: /\.md$/,
          type: "asset/source",
        },
        {
          test: /\.node$/,
          use: "node-loader",
        },
        {
          test: (modulePath) => modulePath.endsWith(".ts") && !modulePath.endsWith(".test.ts"), // 🎯 .test.ts 파일 제외 (중요!)
          exclude: /node_modules/,
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
        ...iconsAndImagesWebpackRules(),
      ],
    },
    plugins: [
      ...getQuietModeProgressPlugins("core-main"),
      new DefinePlugin({
        CONTEXT_MATCHER_FOR_NON_FEATURES: `/\\.injectable\\.tsx?$/`,
        CONTEXT_MATCHER_FOR_FEATURES: `/\\/(main|common)\\/.+\\.injectable\\.tsx?$/`,
      }),
      new ForkTsCheckerPlugin({
        typescript: {
          mode: "write-dts",
          memoryLimit: 2048,
          configOverwrite: {
            compilerOptions: {
              declaration: true,
            },
          },
        },
      }),
      // 🎯 목적: Webpack Core Library 빌드 완료 시 사용자에게 명확한 완료 메시지 출력
      // 📝 효과: 사용자가 Core 패키지 빌드 완료 시점을 알고 다음 단계 대기 가능
      {
        apply: (compiler: webpack.Compiler) => {
          compiler.hooks.done.tap("BuildCompletePlugin", (stats) => {
            const time = stats.endTime - stats.startTime;
            console.error(`\n✅ [core-library-main] 빌드 완료! (${(time / 1000).toFixed(1)}초)\n`);
          });
        },
      },
    ],
  };
};

export default webpackLensMain;
