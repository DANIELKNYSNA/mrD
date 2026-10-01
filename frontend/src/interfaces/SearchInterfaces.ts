// Mirrors backend/src/interfaces/ISearch.ts — keep the two in sync.

export type SortField = 'relevance' | 'popularity' | 'price'
export type SortOrder = 'asc' | 'desc'
export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock'
export type EnrichmentStatus = 'ok' | 'timeout' | 'error'

export interface SearchParams {
  q: string
  category?: string
  sort?: SortField
  order?: SortOrder
}

export interface Offer {
  itemId: string
  price: number
  currency: string
  availability: Availability
  deliveryEstimateMinutes: number
}

export interface SearchResultItem {
  id: string
  name: string
  category: string
  description: string
  tags: string[]
  popularity: number
  offer: Offer | null
  enrichment: EnrichmentStatus
}

export interface SearchResponse {
  query: Required<Omit<SearchParams, 'category'>> & Pick<SearchParams, 'category'>
  total: number
  items: SearchResultItem[]
  partial: boolean
  tookMs: number
}

export interface CategoriesResponse {
  categories: string[]
}

export interface Suggestion {
  id: string
  name: string
  category: string
}

export interface SuggestionsResponse {
  suggestions: Suggestion[]
}
