const { defaults } = require('jest-config');

const setupFilesAfterEnv = defaults.setupFilesAfterEnv || [];
setupFilesAfterEnv.push('<rootDir>/jest-sa11y-setup.js');

module.exports = {
  preset: '@lwc/jest-preset',
  moduleNameMapper: {
    '^snake/(.+)$': '<rootDir>/src/modules/snake/$1/$1'
  },
  globals: {
    'lwc-jest': {
      nativeShadow: true
    }
  },
  setupFilesAfterEnv,
  coverageReporters: ['clover', 'json', 'text', 'lcov', 'cobertura']
};
