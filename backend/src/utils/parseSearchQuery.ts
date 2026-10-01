import type { Request } from 'express';
import type { ISearchQuery } from '../interfaces/ISearch.js';
import { SORT_FIELDS, SORT_ORDERS, type SortField, type SortOrder } from '../types/search.js';
import { AppError } from './AppError.js';

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

/** Validates and normalises the raw query string into a typed ISearchQuery. */
export function parseSearchQuery(query: Request['query']): ISearchQuery {
  const sort = asString(query.sort);
  if (sort !== undefined && !SORT_FIELDS.includes(sort as SortField)) {
    throw AppError.badRequest(`Invalid sort "${sort}"`, { allowed: SORT_FIELDS });
  }

  const order = asString(query.order);
  if (order !== undefined && !SORT_ORDERS.includes(order as SortOrder)) {
    throw AppError.badRequest(`Invalid order "${order}"`, { allowed: SORT_ORDERS });
  }

  const sortField = (sort as SortField | undefined) ?? 'relevance';

  return {
    q: asString(query.q) ?? '',
    category: asString(query.category),
    sort: sortField,
    // Cheapest-first is the natural default for price; most-first for everything else.
    order: (order as SortOrder | undefined) ?? (sortField === 'price' ? 'asc' : 'desc'),
  };
}
