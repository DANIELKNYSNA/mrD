import type { EnrichmentStatus, SortField, SortOrder } from '../types/search.js';
import type { ICatalogItem } from './ICatalogItem.js';
import type { IOffer } from './IOffer.js';

export interface ISearchQuery {
  q: string;
  category?: string;
  sort: SortField;
  order: SortOrder;
}

export interface ISearchResultItem extends ICatalogItem {
  offer: IOffer | null;
  enrichment: EnrichmentStatus;
}

export interface ISearchResponse {
  query: ISearchQuery;
  total: number;
  items: ISearchResultItem[];
  /** True when one or more items could not be enriched by the upstream provider. */
  partial: boolean;
  tookMs: number;
}
