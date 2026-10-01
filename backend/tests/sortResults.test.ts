import { describe, expect, it } from 'vitest';
import type { ISearchResultItem } from '../src/interfaces/ISearch.js';
import { sortResults } from '../src/utils/sortResults.js';

const result = (id: string, popularity: number, price: number | null): ISearchResultItem => ({
  id,
  name: id,
  category: 'Test',
  description: '',
  tags: [],
  popularity,
  offer:
    price === null
      ? null
      : { itemId: id, price, currency: 'ZAR', availability: 'in_stock', deliveryEstimateMinutes: 30 },
  enrichment: price === null ? 'error' : 'ok',
});

// Input order represents relevance order.
const items = [result('a', 50, 30), result('b', 90, null), result('c', 70, 10), result('d', 70, 20)];
const ids = (sorted: ISearchResultItem[]) => sorted.map((i) => i.id);

describe('sortResults', () => {
  it('keeps relevance order and ignores the order param', () => {
    expect(ids(sortResults(items, 'relevance', 'desc'))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(sortResults(items, 'relevance', 'asc'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sorts by popularity, using relevance to break ties', () => {
    expect(ids(sortResults(items, 'popularity', 'desc'))).toEqual(['b', 'c', 'd', 'a']);
    expect(ids(sortResults(items, 'popularity', 'asc'))).toEqual(['a', 'c', 'd', 'b']);
  });

  it('sorts by price with unpriced items last in both directions', () => {
    expect(ids(sortResults(items, 'price', 'asc'))).toEqual(['c', 'd', 'a', 'b']);
    expect(ids(sortResults(items, 'price', 'desc'))).toEqual(['a', 'd', 'c', 'b']);
  });

  it('does not mutate its input', () => {
    sortResults(items, 'price', 'asc');
    expect(ids(items)).toEqual(['a', 'b', 'c', 'd']);
  });
});
