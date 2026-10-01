import ApiClient from '@/api/clients/ApiClient'
import type {
  CategoriesResponse,
  SearchParams,
  SearchResponse,
  SuggestionsResponse,
} from '@/interfaces/SearchInterfaces'

export default class ServiceSearchClient extends ApiClient {
  serviceName = '/api/'

  search(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
    return this.get('search', { ...params }, { signal })
  }

  getCategories(): Promise<CategoriesResponse> {
    return this.get('categories')
  }

  getSuggestions(q: string, category?: string, signal?: AbortSignal): Promise<SuggestionsResponse> {
    return this.get('suggestions', { q, category }, { signal })
  }
}
