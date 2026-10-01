import type { ISearchQuery, ISearchResponse } from '../interfaces/ISearch.js';
import { findItems } from '../models_actions/catalogActions.js';
import { sortResults } from '../utils/sortResults.js';
import { enrichItems, type EnrichmentOptions } from './enrichmentService.js';
import { metrics } from './metricsService.js';

/**
 * Orchestrates a search: match and rank the catalog, enrich with live
 * offers, then apply the requested sort. Sorting happens last because
 * price is only known after enrichment.
 */
export async function search(query: ISearchQuery, enrichment: EnrichmentOptions = {}): Promise<ISearchResponse> {
  const started = performance.now();
  const matches = findItems(query.q, query.category);
  const enriched = await enrichItems(matches, enrichment);
  const items = sortResults(enriched, query.sort, query.order);
  const tookMs = Math.round(performance.now() - started);
  metrics.recordSearch(tookMs);

  return {
    query,
    total: items.length,
    items,
    partial: items.some((item) => item.enrichment !== 'ok'),
    tookMs,
  };
}
