const { createDefaultPreset } = require('ts-jest');

module.exports = {
  rootDir: '../..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/tools/poe-ninja-publisher/**/*.spec.ts'],
  transform: createDefaultPreset().transform,
};
