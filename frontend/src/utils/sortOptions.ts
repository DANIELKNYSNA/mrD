import type { SortField, SortOrder } from '@/interfaces/SearchInterfaces'

/** The UI exposes sort+order as a single choice; these map it to API params. */
export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Best match', sort: 'relevance', order: 'desc' },
  { value: 'popularity', label: 'Most popular', sort: 'popularity', order: 'desc' },
  { value: 'price-asc', label: 'Price: low to high', sort: 'price', order: 'asc' },
  { value: 'price-desc', label: 'Price: high to low', sort: 'price', order: 'desc' },
] as const satisfies readonly { value: string; label: string; sort: SortField; order: SortOrder }[]

export type SortOption = (typeof SORT_OPTIONS)[number]['value']

export function toApiSort(option: SortOption): { sort: SortField; order: SortOrder } {
  const match = SORT_OPTIONS.find((o) => o.value === option) ?? SORT_OPTIONS[0]
  return { sort: match.sort, order: match.order }
}
