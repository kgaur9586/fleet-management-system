/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/**/*.test.ts'],
  verbose: true,
  forceExit: true,
  // In-memory MongoDB (and replica-set startup) can exceed the 5s default.
  testTimeout: 60000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
