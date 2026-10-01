import { describe, expect, it } from 'vitest';
import { TtlCache } from '../src/utils/TtlCache.js';

describe('TtlCache', () => {
  it('returns values until they expire', () => {
    let now = 0;
    const cache = new TtlCache<string>(100, 10, () => now);
    cache.set('a', 'apple');

    now = 99;
    expect(cache.get('a')).toBe('apple');
    now = 100;
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0); // expired entry evicted on read
  });

  it('evicts the oldest entry when full', () => {
    const cache = new TtlCache<number>(1000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('caches nothing when the TTL is 0', () => {
    const cache = new TtlCache<number>(0);
    cache.set('a', 1);
    expect(cache.get('a')).toBeUndefined();
  });
});
