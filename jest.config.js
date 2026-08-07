/**
 * Root Jest config — the project had NONE.
 *
 * `npm test` ran bare `jest`, whose default testMatch is
 * `**\/?(*.)+(spec|test).[tj]s?(x)`. Every spec here is named `*.e2e-spec.ts`,
 * and the segment before `spec` ends in `-` rather than `.`, so nothing matched:
 * "499 files checked, 0 matches". The suite could only ever be run by knowing to
 * type `--config ./test/jest-e2e.json`, so in practice it was run by nobody — which
 * is how a broken donation fixture sat unnoticed until T-11.
 *
 * This config discovers BOTH layouts, so new tests are found wherever they land:
 *   src/**\/*.spec.ts       — unit tests next to the code
 *   test/**\/*.e2e-spec.ts  — the existing suite
 */
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  testRegex: '\\.(spec|e2e-spec)\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },

  collectCoverageFrom: [
    'src/**/*.ts',
    // Wiring and generated surface, not logic worth a coverage number.
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov'],

  /*
   * Thresholds are set at the CURRENT measured level, not an aspirational one.
   * The point is a ratchet: coverage can rise, and a drop fails the run instead
   * of passing quietly. Raise these as tests are added — see qa REMAINING_TASKS T-12.
   */
  coverageThreshold: {
    global: {
      statements: 16,
      branches: 15,
      functions: 8,
      lines: 15,
    },
  },
};
