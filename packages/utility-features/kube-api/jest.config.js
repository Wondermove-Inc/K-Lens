module.exports = {
  ...require("@skuberplus/jest").monorepoPackageConfig(__dirname).configForNode,
  moduleNameMapper: {
    "^@skuberplus/kube-api$": "<rootDir>/index.ts",
  },
};
