const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: num(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  upstream: {
    minLatencyMs: num(process.env.UPSTREAM_MIN_LATENCY_MS, 80),
    maxLatencyMs: num(process.env.UPSTREAM_MAX_LATENCY_MS, 600),
    slowRate: num(process.env.UPSTREAM_SLOW_RATE, 0.1),
    slowLatencyMs: num(process.env.UPSTREAM_SLOW_LATENCY_MS, 2500),
    failureRate: num(process.env.UPSTREAM_FAILURE_RATE, 0.1),
    /** How long search waits for each item's offer before giving up on it. */
    timeoutMs: num(process.env.UPSTREAM_TIMEOUT_MS, 1000),
  },
  /** How long a successful upstream offer is reused. 0 disables the cache. */
  offerCacheTtlMs: num(process.env.OFFER_CACHE_TTL_MS, 30_000),
} as const;
