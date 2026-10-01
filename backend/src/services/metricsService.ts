import type { EnrichmentStatus } from '../types/search.js';

interface Counters {
  startedAt: string;
  requests: { total: number; byStatus: Record<string, number> };
  search: { count: number; totalMs: number; maxMs: number };
  enrichment: Record<EnrichmentStatus, number>;
  offerCache: { hits: number; misses: number };
}

const fresh = (): Counters => ({
  startedAt: new Date().toISOString(),
  requests: { total: 0, byStatus: {} },
  search: { count: 0, totalMs: 0, maxMs: 0 },
  enrichment: { ok: 0, timeout: 0, error: 0 },
  offerCache: { hits: 0, misses: 0 },
});

let counters = fresh();

const ratio = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 1000;

/** In-process counters, reset on restart. Viewable at GET /api/metrics. */
export const metrics = {
  recordRequest(statusCode: number): void {
    counters.requests.total += 1;
    const key = String(statusCode);
    counters.requests.byStatus[key] = (counters.requests.byStatus[key] ?? 0) + 1;
  },

  recordSearch(tookMs: number): void {
    counters.search.count += 1;
    counters.search.totalMs += tookMs;
    counters.search.maxMs = Math.max(counters.search.maxMs, tookMs);
  },

  /** One upstream outcome. Cache hits are counted separately and aren't upstream calls. */
  recordEnrichment(status: EnrichmentStatus): void {
    counters.enrichment[status] += 1;
  },

  recordCacheLookup(hit: boolean): void {
    if (hit) counters.offerCache.hits += 1;
    else counters.offerCache.misses += 1;
  },

  snapshot() {
    const { search, enrichment, offerCache } = counters;
    const upstreamCalls = enrichment.ok + enrichment.timeout + enrichment.error;
    return {
      startedAt: counters.startedAt,
      requests: counters.requests,
      search: {
        count: search.count,
        avgMs: search.count === 0 ? null : Math.round(search.totalMs / search.count),
        maxMs: search.maxMs,
      },
      upstream: {
        calls: upstreamCalls,
        ...enrichment,
        successRate: ratio(enrichment.ok, upstreamCalls),
      },
      offerCache: {
        ...offerCache,
        hitRate: ratio(offerCache.hits, offerCache.hits + offerCache.misses),
      },
    };
  },

  reset(): void {
    counters = fresh();
  },
};
