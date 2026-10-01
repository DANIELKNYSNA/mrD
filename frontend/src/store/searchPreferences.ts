import { persisted } from 'svelte-persisted-store'
import { SORT_OPTIONS, type SortOption } from '@/utils/sortOptions'

export interface SearchPreferences {
  sortOption: SortOption
  /** Most recent first, case-insensitively unique. */
  recentQueries: string[]
}

const MAX_RECENT = 5

const defaults: SearchPreferences = { sortOption: 'relevance', recentQueries: [] }

/** Survives page reloads via localStorage (like a Pinia store with persistence). */
export const searchPreferences = persisted<SearchPreferences>('mrd:search-preferences', defaults, {
  // Validate field by field rather than trusting localStorage: it may hold an
  // older shape of this object, or have been edited by hand.
  beforeRead: (value) => ({
    sortOption: SORT_OPTIONS.some((o) => o.value === value?.sortOption) ? value.sortOption : defaults.sortOption,
    recentQueries: Array.isArray(value?.recentQueries)
      ? value.recentQueries.filter((q): q is string => typeof q === 'string').slice(0, MAX_RECENT)
      : [],
  }),
})

export function setSortOption(sortOption: SortOption): void {
  searchPreferences.update((prefs) => ({ ...prefs, sortOption }))
}

export function addRecentQuery(query: string): void {
  const q = query.trim()
  if (!q) return
  searchPreferences.update((prefs) => ({
    ...prefs,
    recentQueries: [q, ...prefs.recentQueries.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT),
  }))
}

export function clearRecentQueries(): void {
  searchPreferences.update((prefs) => ({ ...prefs, recentQueries: [] }))
}
