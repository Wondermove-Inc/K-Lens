// 🎯 kubectl-versions 패키지는 build/versions.json을 import하므로
// JSON 파일 resolve를 위해 webpack 설정을 커스터마이즈
const baseConfig = require("@skuberplus/webpack").configForNode;

module.exports = {
  ...baseConfig,
  resolve: {
    ...baseConfig.resolve,
    // JSON 파일도 resolve할 수 있도록 확장자 추가
    extensions: [...(baseConfig.resolve?.extensions || []), ".json"],
  },
};
