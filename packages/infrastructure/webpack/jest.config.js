const {
  configForNode: { coverageThreshold, ...config },
} = require("@skuberplus/jest").monorepoPackageConfig(__dirname);

module.exports = config;
