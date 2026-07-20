const { createDefaultPreset } = require('ts-jest');

const tsJestTransformCfg = createDefaultPreset().transform;

module.exports = {
  projects: [
    {
      displayName: 'main',
      testEnvironment: 'node',
      testMatch: ['**/test/main/**/*.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
      transform: {
        ...tsJestTransformCfg,
      },
    },
  ],
};
