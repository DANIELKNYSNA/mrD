export const SORT_FIELDS = ['relevance', 'popularity', 'price'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock';

/** Outcome of upstream enrichment for an individual item. */
export type EnrichmentStatus = 'ok' | 'timeout' | 'error';
