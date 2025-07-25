const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  // "<rootDir>/test/**/*.{spec,test}.{js,jsx,ts,tsx}"
  testMatch: ["**/test/**/*.spec.ts"],
  setupFilesAfterEnv: [
      "<rootDir>/src/setupTests.js"
  ],
  transform: {
    ...tsJestTransformCfg,
  },
};