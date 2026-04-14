/**
 * Security feature 전용 Jest 설정
 * useESM: false — @side/jest-runtime CJS 호환
 */
const base = require("./jest.config.js");

module.exports = {
  ...base,
  transform: {
    "^.+\.tsx?$": [
      "ts-jest",
      {
        useESM: false,
      },
    ],
  },
  testMatch: ["<rootDir>/src/features/security/**/*.test.ts", "<rootDir>/src/common/security/**/*.test.ts"],
};
