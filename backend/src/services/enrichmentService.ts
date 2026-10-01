import type { ICatalogItem } from '../interfaces/ICatalogItem.js';
import type { IOffer } from '../interfaces/IOffer.js';
import type { IOfferProvider } from '../interfaces/IOfferProvider.js';
import type { ISearchResultItem } from '../interfaces/ISearch.js';
import { config } from '../utils/config.js';
import type { TtlCache } from '../utils/TtlCache.js';
import { TimeoutError, withTimeout } from '../utils/withTimeout.js';
import { metrics } from './metricsService.js';
import { offerCache } from './offerCache.js';
import { upstreamProvider } from './upstreamProvider.js';

export interface EnrichmentOptions {
  provider?: IOfferProvider;
  timeoutMs?: number;
  /** Pass null to bypass caching. */
  cache?: TtlCache<IOffer> | null;
}

/**
 * Prices every item in parallel, each with its own timeout. A slow or failing
 * item never fails the batch: it comes back with `offer: null` and a status
 * saying why, so the UI can still render the rest of the results.
 * Recently fetched offers are served from cache without calling the upstream.
 */
export async function enrichItems(
  items: readonly ICatalogItem[],
  { provider = upstreamProvider, timeoutMs = config.upstream.timeoutMs, cache = offerCache }: EnrichmentOptions = {},
): Promise<ISearchResultItem[]> {
  const fetchOffer = async (itemId: string): Promise<IOffer> => {
    const cached = cache?.get(itemId);
    if (cache) metrics.recordCacheLookup(cached !== undefined);
    if (cached) return cached;

    const offer = await withTimeout(provider.getOffer(itemId), timeoutMs);
    cache?.set(itemId, offer);
    metrics.recordEnrichment('ok');
    return offer;
  };

  const settled = await Promise.allSettled(items.map((item) => fetchOffer(item.id)));

  return items.map((item, i) => {
    const result = settled[i]!;
    if (result.status === 'fulfilled') {
      return { ...item, offer: result.value, enrichment: 'ok' };
    }
    const enrichment = result.reason instanceof TimeoutError ? 'timeout' : 'error';
    metrics.recordEnrichment(enrichment);
    return { ...item, offer: null, enrichment };
  });
}
