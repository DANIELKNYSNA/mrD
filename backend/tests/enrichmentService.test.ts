import { describe, expect, it } from 'vitest';
import type { ICatalogItem } from '../src/interfaces/ICatalogItem.js';
import type { IOffer } from '../src/interfaces/IOffer.js';
import type { IOfferProvider } from '../src/interfaces/IOfferProvider.js';
import { enrichItems } from '../src/services/enrichmentService.js';
import { search } from '../src/services/searchService.js';
import { sleep } from '../src/utils/sleep.js';

const item = (id: string): ICatalogItem => ({
  id,
  name: `Item ${id}`,
  category: 'Test',
  description: '',
  tags: [],
  popularity: 50,
});

const offer = (itemId: string): IOffer => ({
  itemId,
  price: 10,
  currency: 'ZAR',
  availability: 'in_stock',
  deliveryEstimateMinutes: 30,
});

/** Fake upstream: 'slow' ids hang past the timeout, 'bad' ids reject, everything else succeeds. */
const fakeProvider: IOfferProvider = {
  async getOffer(itemId) {
    if (itemId === 'slow') {
      await sleep(200);
      return offer(itemId);
    }
    if (itemId === 'bad') throw new Error('upstream down');
    return offer(itemId);
  },
};

describe('enrichItems', () => {
  it('marks each item ok, timeout or error, preserving order', async () => {
    const result = await enrichItems([item('a'), item('slow'), item('bad')], {
      provider: fakeProvider,
      timeoutMs: 50,
    });

    expect(result.map((r) => [r.id, r.enrichment])).toEqual([
      ['a', 'ok'],
      ['slow', 'timeout'],
      ['bad', 'error'],
    ]);
    expect(result[0]!.offer).toEqual(offer('a'));
    expect(result[1]!.offer).toBeNull();
    expect(result[2]!.offer).toBeNull();
  });

  it('waits no longer than the timeout when some items are slow', async () => {
    const started = performance.now();
    await enrichItems([item('a'), item('slow')], { provider: fakeProvider, timeoutMs: 50 });
    expect(performance.now() - started).toBeLessThan(150);
  });
});

describe('search enrichment', () => {
  const query = { q: 'pizza', sort: 'relevance', order: 'desc' } as const;

  it('is not partial when every item is enriched', async () => {
    const res = await search(query, { provider: fakeProvider });
    expect(res.total).toBeGreaterThan(0);
    expect(res.partial).toBe(false);
    expect(res.items.every((i) => i.offer?.price === 10)).toBe(true);
  });

  it('is partial, but still returns all items, when the upstream fails', async () => {
    const failing: IOfferProvider = { getOffer: async () => { throw new Error('down'); } };
    const res = await search(query, { provider: failing });
    expect(res.total).toBeGreaterThan(0);
    expect(res.partial).toBe(true);
    expect(res.items.every((i) => i.enrichment === 'error' && i.offer === null)).toBe(true);
  });
});
