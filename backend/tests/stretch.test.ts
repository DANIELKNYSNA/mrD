import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { ICatalogItem } from '../src/interfaces/ICatalogItem.js';
import type { IOffer } from '../src/interfaces/IOffer.js';
import type { IOfferProvider } from '../src/interfaces/IOfferProvider.js';
import { enrichItems } from '../src/services/enrichmentService.js';
import { metrics } from '../src/services/metricsService.js';
import { TtlCache } from '../src/utils/TtlCache.js';

const app = createApp();

const item = (id: string): ICatalogItem => ({ id, name: id, category: 'Test', description: '', tags: [], popularity: 50 });
const offer = (itemId: string): IOffer => ({
  itemId, price: 10, currency: 'ZAR', availability: 'in_stock', deliveryEstimateMinutes: 30,
});

/** Records calls; fails while `down` is true. */
function countingProvider() {
  const state = { calls: 0, down: false };
  const provider: IOfferProvider = {
    async getOffer(itemId) {
      state.calls += 1;
      if (state.down) throw new Error('down');
      return offer(itemId);
    },
  };
  return { provider, state };
}

describe('offer cache', () => {
  it('serves repeat lookups from cache and survives an upstream outage', async () => {
    const { provider, state } = countingProvider();
    const cache = new TtlCache<IOffer>(60_000);

    await enrichItems([item('a'), item('b')], { provider, cache });
    expect(state.calls).toBe(2);

    state.down = true;
    const second = await enrichItems([item('a'), item('b'), item('c')], { provider, cache });
    expect(state.calls).toBe(3); // only 'c' went upstream
    expect(second.map((r) => r.enrichment)).toEqual(['ok', 'ok', 'error']);
  });

  it('does not cache failures', async () => {
    const { provider, state } = countingProvider();
    const cache = new TtlCache<IOffer>(60_000);

    state.down = true;
    await enrichItems([item('a')], { provider, cache });
    state.down = false;
    const retry = await enrichItems([item('a')], { provider, cache });

    expect(state.calls).toBe(2);
    expect(retry[0]!.enrichment).toBe('ok');
  });
});

describe('metrics', () => {
  beforeEach(() => metrics.reset());

  it('counts requests, searches, upstream outcomes and cache lookups', async () => {
    const { provider, state } = countingProvider();
    const cache = new TtlCache<IOffer>(60_000);
    await enrichItems([item('a')], { provider, cache }); // miss → ok
    await enrichItems([item('a')], { provider, cache }); // hit
    state.down = true;
    await enrichItems([item('b')], { provider, cache }); // miss → error

    await request(app).get('/api/search').query({ q: 'pizza' });
    await request(app).get('/api/nope');

    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.requests).toMatchObject({ total: 2, byStatus: { '200': 1, '404': 1 } });
    expect(res.body.search.count).toBe(1);
    expect(res.body.offerCache).toMatchObject({ hits: 1, misses: 2 });
    // 1 ok + 1 error from the direct calls, plus 5 ok pizzas from the search (cache disabled in tests).
    expect(res.body.upstream).toMatchObject({ calls: 7, ok: 6, error: 1, timeout: 0 });
  });
});

describe('GET /api/suggestions', () => {
  it('returns up to 5 ranked suggestions without offers', async () => {
    const res = await request(app).get('/api/suggestions').query({ q: 'chick' });
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    expect(res.body.suggestions).toHaveLength(5);
    expect(Object.keys(res.body.suggestions[0]).sort()).toEqual(['category', 'id', 'name']);
  });

  it('honours the category filter', async () => {
    const res = await request(app).get('/api/suggestions').query({ q: 'chick', category: 'Burgers' });
    expect(res.body.suggestions.map((s: { name: string }) => s.name)).toEqual(['Crispy Chicken Burger']);
  });

  it('returns nothing for an empty or unmatched query', async () => {
    expect((await request(app).get('/api/suggestions')).body.suggestions).toEqual([]);
    expect((await request(app).get('/api/suggestions').query({ q: 'xyzzy' })).body.suggestions).toEqual([]);
  });
});
