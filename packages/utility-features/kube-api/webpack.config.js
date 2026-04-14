const baseConfig = require("@skuberplus/webpack").configForReact;
const nodeExternals = require("webpack-node-externals");

const REQUIRED_RENDERER_MODULES = ["byline", "rfc4648", "isomorphic-ws", "stream-buffers", "request", "tslib"];

// 🎯 목적: Renderer 번들에서 필수 Node 모듈을 외부 의존성 대신 포함하도록 강제
// 📝 배경: 2025-10-15 문제(`docs/problem/2025-10-15-webpack-renderer-module-bundling.md`)에서
//         byline/rfc4648/isomorphic-ws 모듈이 externals 처리되어 런타임에 `Cannot find module` 발생
// ⚠️ 주의: configForReact는 기본적으로 nodeExternals({ modulesFromFile: true })를 사용하므로
//         allowlist로 명시하지 않으면 해당 의존성이 번들에 포함되지 않음
baseConfig.externals = [
  nodeExternals({
    modulesFromFile: true,
    allowlist: REQUIRED_RENDERER_MODULES,
  }),
];

module.exports = baseConfig;
