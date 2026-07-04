const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

module.exports = {
  projects: [
    {
      displayName: "main",
      testEnvironment: "node",
      testMatch: ["**/test/**/*.spec.ts"],
      setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],
      transform: {
        ...tsJestTransformCfg,
      },
    },
    {
      displayName: "renderer",
      testEnvironment: "jsdom",
      testMatch: ["**/test/renderer/**/*.spec.tsx"],
      setupFilesAfterEnv: ["<rootDir>/src/renderer/setupTests.js"],
      moduleNameMapper: {
        "^.+\\.(css|less|scss|sass)$": "<rootDir>/test/mocks/styleMock.js",
        "^.+\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp|ico)$": "<rootDir>/test/mocks/fileMock.js",
      },
      transform: {
        ...tsJestTransformCfg,
      },
    },
  ],
};
