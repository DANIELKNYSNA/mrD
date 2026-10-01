import { describe, expect, it } from 'vitest';
import { CatalogModel } from '../src/models/CatalogModel.js';
import { PriceListModel } from '../src/models/PriceListModel.js';

describe('catalog data', () => {
  const items = CatalogModel.all();

  it('has 30–40 items across multiple categories', () => {
    expect(items.length).toBeGreaterThanOrEqual(30);
    expect(items.length).toBeLessThanOrEqual(40);
    expect(new Set(items.map((i) => i.category)).size).toBeGreaterThan(1);
  });

  it('has unique ids', () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('has an upstream price for every item', () => {
    const missing = items.filter((i) => !PriceListModel.get(i.id)).map((i) => i.id);
    expect(missing).toEqual([]);
  });
});
