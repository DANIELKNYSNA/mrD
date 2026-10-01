import { SORT_OPTIONS, type SortOption } from '@/utils/sortOptions'

export interface UrlState {
  q: string
  category: string
  /** Undefined when the URL doesn't specify a (valid) sort. */
  sortOption?: SortOption
}

const isSortOption = (value: string | null): value is SortOption =>
  SORT_OPTIONS.some((o) => o.value === value)

/** Reads search state from the current URL, e.g. ?q=pizza&category=Pizza&sort=price-asc */
export function readUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search)
  const sort = params.get('sort')
  return {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    sortOption: isSortOption(sort) ? sort : undefined,
  }
}

/**
 * Mirrors search state into the URL so it can be shared or bookmarked.
 * Uses replaceState: refining a search shouldn't fill the back button with every keystroke.
 */
export function writeUrlState({ q, category, sortOption }: UrlState): void {
  const url = new URL(window.location.href)
  const set = (key: string, value: string | undefined) =>
    value ? url.searchParams.set(key, value) : url.searchParams.delete(key)

  set('q', q.trim())
  set('category', category)
  set('sort', sortOption === 'relevance' ? undefined : sortOption)

  if (url.href !== window.location.href) window.history.replaceState(null, '', url)
}
