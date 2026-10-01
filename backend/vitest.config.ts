import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      // Entry point and type-only files have nothing to execute.
      exclude: ['src/server.ts', 'src/interfaces/**'],
    },
    // Make the default upstream instant and reliable so API tests are fast and deterministic.
    // Tests that exercise latency/failures configure their own provider.
    env: {
      UPSTREAM_MIN_LATENCY_MS: '0',
      UPSTREAM_MAX_LATENCY_MS: '0',
      UPSTREAM_SLOW_RATE: '0',
      UPSTREAM_FAILURE_RATE: '0',
      // Cached offers would leak between tests; cache tests pass their own instance.
      OFFER_CACHE_TTL_MS: '0',
    },
  },
});
