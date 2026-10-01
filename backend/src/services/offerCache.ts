import type { IOffer } from '../interfaces/IOffer.js';
import { config } from '../utils/config.js';
import { TtlCache } from '../utils/TtlCache.js';

/**
 * Short-lived cache of successful upstream offers, keyed by item id.
 * Only successes are cached, so a failed or slow item is retried on the next search.
 * Null when disabled (OFFER_CACHE_TTL_MS=0), so lookups aren't counted as misses.
 */
export const offerCache: TtlCache<IOffer> | null =
  config.offerCacheTtlMs > 0 ? new TtlCache<IOffer>(config.offerCacheTtlMs) : null;
