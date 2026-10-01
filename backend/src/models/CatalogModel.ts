import type { ICatalogItem } from '../interfaces/ICatalogItem.js';
import catalogData from './catalog.json' with { type: 'json' };

// Loaded once at startup and treated as read-only; there is no database.
const catalog: readonly ICatalogItem[] = Object.freeze(catalogData as ICatalogItem[]);

export const CatalogModel = {
  all(): readonly ICatalogItem[] {
    return catalog;
  },
};
