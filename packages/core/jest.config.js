/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  collectCoverage: false,
  globalSetup: "<rootDir>/src/jest.timezone.ts",
  moduleNameMapper: {
    "^@skuberplus/tooltip$": "<rootDir>/node_modules/@skuberplus/tooltip/index.ts",
    "\\.(css|scss)$": "identity-obj-proxy",
    "\\.(svg|png|jpg|eot|woff2?|ttf|md)$": "<rootDir>/__mocks__/assetMock.ts",
    "^@/(.*)$": "<rootDir>/src/renderer/$1",
    "^react$": "<rootDir>/../../node_modules/react/index.js",
    "^react-dom$": "<rootDir>/../../node_modules/react-dom/index.js",
    "^@/components/(.*)$": "<rootDir>/src/renderer/components/$1",
    "^@/hooks/(.*)$": "<rootDir>/../storybook-shadcn/src/hooks/$1",
    "^@/lib/(.*)$": "<rootDir>/../storybook-shadcn/src/lib/$1",
  },
  modulePathIgnorePatterns: ["<rootDir>/dist", "<rootDir>/packages", "<rootDir>/static/build"],
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/benchmark/", "/__tests__/fixtures/", "/__tests__/helpers/"],
  resolver: "<rootDir>/src/jest-28-resolver.js",
  runtime: "@side/jest-runtime",
  setupFiles: ["<rootDir>/src/jest.setup.tsx", "jest-canvas-mock"],
  setupFilesAfterEnv: ["<rootDir>/src/jest-after-env.setup.ts"],
  testEnvironment: "jsdom",
  maxWorkers: 2,
  workerIdleMemoryLimit: "512MB",
  testTimeout: 15000,
  transform: {
    "^.+\\.[jt]sx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(node-fetch|p-limit|yocto-queue))/"],
  verbose: false,
};
