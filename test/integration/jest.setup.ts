/**
 * The integration project's per-test timeout.
 *
 * It lives here because `testTimeout` inside a `projects[]` entry is not part of
 * Jest's project config schema — it produced an "Unknown option" warning and was
 * silently dropped, so these suites were running against the 5s default while
 * the config claimed 30s.
 */
jest.setTimeout(30_000);
