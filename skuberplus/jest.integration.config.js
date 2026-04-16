/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  collectCoverage: false,
  moduleNameMapper: {
    "\\.(css|scss)$": "identity-obj-proxy",
    "\\.(svg|png|jpg|eot|woff2?|ttf)$": "<rootDir>/__mocks__/assetMock.ts",
    "^uuid$": require.resolve("uuid"),
  },
  // @side/jest-runtime 제외 — ESM과 호환 안 됨
  testEnvironment: "node",
  testTimeout: 600000,
  testMatch: ["<rootDir>/integration/**/*.tests.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: false,
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
        },
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!(@skuberplus|@ogre-tools)/)"],
  verbose: true,
};
