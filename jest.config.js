/**
 * One Jest config, two projects, one coverage number.
 *
 * The project previously had NO config at all: `npm test` ran bare `jest`, whose
 * default testMatch cannot match `*.e2e-spec.ts` (the character before `spec` is
 * `-`, not `.`), so it reported "499 files checked, 0 matches" and the suite was
 * in practice run by nobody — which is how a broken donation fixture survived
 * until T-11 tripped over it.
 *
 * T-12 fixed discovery. This is the follow-up (T-21): coverage was then measured
 * over the UNIT run only, so anything covered by an integration test read as
 * uncovered. Adding 19 integration tests made the headline number go *down*
 * (20.71% → 20.67%) — the opposite of the truth, and exactly the kind of metric
 * that teaches people to ignore metrics.
 *
 * Jest `projects` fixes it properly: both suites run under one invocation and
 * coverage is aggregated across them. They stay separable because the
 * integration project needs a PostgreSQL and the unit one must not:
 *
 *   npm test          → unit + e2e only, no database required
 *   npm run test:int  → integration only, DATABASE_URL required
 *   npm run test:cov  → BOTH, with a single merged coverage report
 */
const shared = {
  rootDir: __dirname,
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  // `uuid` v14 ships ESM only — no CJS build — so Jest's CommonJS runtime chokes
  // on `export {}` the moment a spec pulls in a service that imports it.
  transformIgnorePatterns: ['/node_modules/(?!(uuid)/)'],
};

module.exports = {
  projects: [
    {
      ...shared,
      displayName: 'unit',
      // `src/**/*.spec.ts` and `test/**/*.e2e-spec.ts`, but never `*.int-spec.ts`.
      testRegex: '\\.(spec|e2e-spec)\\.ts$',
      testPathIgnorePatterns: ['/node_modules/', '\\.int-spec\\.ts$'],
    },
    {
      ...shared,
      displayName: 'integration',
      testRegex: '\\.int-spec\\.ts$',
      // These talk to a real database: give them room, and no parallel workers
      // racing each other over the same rows.
      testTimeout: 30000,
      maxWorkers: 1,
    },
  ],

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
   * Thresholds are set at the CURRENT measured level of the MERGED run, not an
   * aspirational one. The point is a ratchet: coverage can rise, and a drop fails
   * the run instead of passing quietly.
   *
   * Note these now govern `test:cov`/`test:ci`, which include the integration
   * project — so they are only meaningful where a database is available. That is
   * true in CI, which is where the gate matters.
   */
  coverageThreshold: {
    global: {
      statements: 54,
      branches: 29,
      functions: 28,
      lines: 52,
    },
  },
};
