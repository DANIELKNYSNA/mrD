import type { ISearchResultItem } from '../interfaces/ISearch.js';
import type { SortField, SortOrder } from '../types/search.js';

/**
 * Sorts enriched results. Input is assumed to already be in relevance order,
 * and Array.prototype.sort is stable, so relevance is the tie-breaker for the
 * other sorts. For "relevance" the order param is ignored (ascending relevance
 * isn't useful). For "price", unpriced items always go last whatever the order,
 * since there's nothing meaningful to compare.
 */
export function sortResults(
  items: readonly ISearchResultItem[],
  sort: SortField,
  order: SortOrder,
): ISearchResultItem[] {
  const direction = order === 'asc' ? 1 : -1;
  const sorted = [...items];

  switch (sort) {
    case 'relevance':
      return sorted;
    case 'popularity':
      return sorted.sort((a, b) => (a.popularity - b.popularity) * direction);
    case 'price':
      return sorted.sort((a, b) => {
        if (!a.offer || !b.offer) return (a.offer ? 0 : 1) - (b.offer ? 0 : 1);
        return (a.offer.price - b.offer.price) * direction;
      });
  }
}
