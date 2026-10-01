import type { ICatalogItem } from '../interfaces/ICatalogItem.js';
import { CatalogModel } from '../models/CatalogModel.js';

/** Lowercase, trim and strip accents so "Sautéed" matches "sauteed". */
const normalise = (value: string): string =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Naive plural stripping so "pizzas" finds "pizza" and "eggs" finds "Eggs". */
const stem = (word: string): string => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

const words = (value: string): string[] => normalise(value).split(/[^a-z0-9]+/).filter(Boolean);

export const tokenize = (q: string): string[] => words(q).map(stem);

/** Per-field weights: a hit in the name matters more than one buried in the description. */
const FIELD_WEIGHTS = { name: 10, category: 6, tags: 4, description: 2 } as const;
type Field = keyof typeof FIELD_WEIGHTS;

interface IndexedField {
  text: string;
  words: string[];
}

interface IndexedItem {
  item: ICatalogItem;
  category: string;
  fields: Record<Field, IndexedField>;
}

const indexField = (value: string): IndexedField => ({ text: normalise(value), words: words(value) });

// Pre-normalise the catalog once; it's read-only for the life of the process.
const index: IndexedItem[] = CatalogModel.all().map((item) => ({
  item,
  category: normalise(item.category),
  fields: {
    name: indexField(item.name),
    category: indexField(item.category),
    tags: indexField(item.tags.join(' ')),
    description: indexField(item.description),
  },
}));

/**
 * How well one query term matches one field, as a fraction of the field weight:
 * whole word 1.0, word prefix 0.8 (typeahead-friendly), substring 0.5.
 * Substring matching needs 3+ characters, otherwise "a" would match everything.
 */
function matchStrength(term: string, field: IndexedField): number {
  if (field.words.some((w) => w === term || stem(w) === term)) return 1;
  if (field.words.some((w) => w.startsWith(term))) return 0.8;
  if (term.length >= 3 && field.text.includes(term)) return 0.5;
  return 0;
}

/**
 * Scores an item against the query terms. Every term must match some field
 * (AND semantics), so "vegan burger" doesn't return every vegan item.
 * Returns 0 when the item doesn't match.
 */
function scoreItem(terms: string[], fields: Record<Field, IndexedField>): number {
  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const field of Object.keys(FIELD_WEIGHTS) as Field[]) {
      best = Math.max(best, FIELD_WEIGHTS[field] * matchStrength(term, fields[field]));
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

/**
 * Free-text search across name, category, tags and description, with an
 * optional exact (case-insensitive) category filter. Results are ranked by
 * relevance, then popularity; an empty query returns everything by popularity.
 */
export function findItems(q: string, category?: string): ICatalogItem[] {
  const terms = tokenize(q);
  const categoryFilter = category ? normalise(category) : undefined;

  const scored: { item: ICatalogItem; score: number }[] = [];
  for (const entry of index) {
    if (categoryFilter && entry.category !== categoryFilter) continue;
    const score = terms.length === 0 ? 0 : scoreItem(terms, entry.fields);
    if (terms.length > 0 && score === 0) continue;
    scored.push({ item: entry.item, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || b.item.popularity - a.item.popularity)
    .map(({ item }) => item);
}

/**
 * Top matches for typeahead: just enough to render a suggestion, no enrichment.
 * Honours the category filter so a suggestion never leads to an empty result.
 */
export function suggestItems(
  q: string,
  category?: string,
  limit = 5,
): Pick<ICatalogItem, 'id' | 'name' | 'category'>[] {
  if (tokenize(q).length === 0) return [];
  return findItems(q, category)
    .slice(0, limit)
    .map(({ id, name, category }) => ({ id, name, category }));
}

export function listCategories(): string[] {
  return [...new Set(CatalogModel.all().map((item) => item.category))].sort();
}
