import path from "path";
import { DefinePlugin } from "webpack";
import nodeExternals from "webpack-node-externals";
import { getQuietModeProgressPlugins, getWebpackLoggingOptions, handlebarsWarningPattern } from "../../webpack/logging";
import { iconsAndImagesWebpackRules } from "./renderer";
import { buildDir, isDevelopment, mainDir } from "./vars";

import type webpack from "webpack";

const loggingOptions = getWebpackLoggingOptions();

const main: webpack.Configuration = {
  name: "skuberplus-app-main",
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
    main: path.resolve(mainDir, "index.ts"),
    "monitor-worker": path.resolve(mainDir, "monitor-worker.ts"),
  },
  output: {
    libraryTarget: "global",
    path: buildDir,
    filename: "[name].js", // 🎯 목적: entry name을 파일명으로 사용하여 main.js 생성, nodemon이 파일 감지하여 Electron 실행
  },
  optimization: {
    minimize: false,
  },
  ignoreWarnings: [handlebarsWarningPattern],
  infrastructureLogging: loggingOptions.infrastructureLogging,
  stats: loggingOptions.stats,
  // 🎯 목적: 자주 사용되는 확장자를 먼저 배치하여 파일 탐색 속도 향상
  resolve: {
    extensions: [".ts", ".js", ".json"],
  },
  externals: [
    {
      "utf-8-validate": "commonjs utf-8-validate",
      bufferutil: "commonjs bufferutil",
    },
    nodeExternals({
      modulesFromFile: true,
      allowlist: [
        // 🎯 External로 처리할 모듈들 제외 (나머지는 번들에 포함)
        // workspace 패키지들(@skuberplus/*)은 번들에 포함되어야 앱 실행 가능
        (moduleName: string) => {
          const externalModules = [
            "node-pty",
            "clipboard-files",
            "electron",
            "pnpm",
            "ws",
            "utf-8-validate",
            "bufferutil",
          ];
          return !externalModules.includes(moduleName);
        },
      ],
    }),
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
    ...getQuietModeProgressPlugins("skuberplus-main"),
    new DefinePlugin({
      CONTEXT_MATCHER_FOR_NON_FEATURES: `/\\.injectable\\.tsx?$/`,
      CONTEXT_MATCHER_FOR_FEATURES: `/\\/(renderer|common|main)\\/.+\\.injectable\\.tsx?$/`,
      "process.env.NODE_ENV": JSON.stringify(isDevelopment ? "development" : "production"),
    }),
  ],
};

export default main;
