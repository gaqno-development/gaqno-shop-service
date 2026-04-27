const base = require('@gaqno-development/backcore/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    'src/main.ts',
    'src/database/migrate.ts',
    'src/database/migrations/',
  ],
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
};
