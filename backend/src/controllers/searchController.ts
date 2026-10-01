import type { Request, Response } from 'express';
import { listCategories, suggestItems } from '../models_actions/catalogActions.js';
import { search } from '../services/searchService.js';
import { parseSearchQuery } from '../utils/parseSearchQuery.js';

// Express 5 forwards rejected promises to the error middleware, so no try/catch needed.
export async function getSearch(req: Request, res: Response): Promise<void> {
  const query = parseSearchQuery(req.query);
  res.json(await search(query));
}

export function getCategories(_req: Request, res: Response): void {
  // Categories only change with the catalog, so let the browser reuse them for 5 minutes.
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ categories: listCategories() });
}

export function getSuggestions(req: Request, res: Response): void {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
  // The catalog is static, so let the browser reuse suggestions for a minute.
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ suggestions: suggestItems(q, category) });
}
