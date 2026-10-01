import { get, writable } from 'svelte/store'
import { apiClients } from '@/api/clients'
import { ApiError } from '@/api/clients/ApiClient'
import type { SearchParams, SearchResponse } from '@/interfaces/SearchInterfaces'

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error'

export interface SearchState {
  status: SearchStatus
  /** Last successful response. Kept while a new search loads so the page doesn't blank out. */
  response: SearchResponse | null
  error: string | null
  /** Params of the most recent search, used by retry. */
  params: SearchParams | null
}

/** Give up client-side if the server hasn't answered by now. Server-side enrichment caps at ~1s. */
const CLIENT_TIMEOUT_MS = 8000

const state = writable<SearchState>({ status: 'idle', response: null, error: null, params: null })

let inFlight: AbortController | null = null
let currentKey: string | null = null

const normalise = (params: SearchParams): SearchParams => ({ ...params, q: params.q.trim() })

const keyOf = (params: SearchParams): string =>
  JSON.stringify([params.q.toLowerCase(), params.category ?? '', params.sort ?? '', params.order ?? ''])

/** Turn failures into something a customer can act on; raw status codes aren't useful to them. */
function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if ([502, 503, 504].includes(error.status)) return 'The search service is unavailable right now.'
    if (error.status >= 500) return 'Something went wrong on our side.'
    return error.message
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'The server is taking too long to respond.'
  }
  if (error instanceof TypeError) return "Can't reach the server. Check your connection."
  return 'Something went wrong.'
}

/**
 * Search state plus actions, Pinia-style. Guarantees only the latest search
 * can update state: each new search aborts the previous request, and a
 * search identical to the current one is skipped unless forced.
 */
export const searchStore = {
  subscribe: state.subscribe,

  async search(rawParams: SearchParams, { force = false } = {}): Promise<void> {
    const params = normalise(rawParams)
    const key = keyOf(params)
    if (!force && key === currentKey) return
    currentKey = key

    inFlight?.abort()
    const controller = new AbortController()
    inFlight = controller

    state.update((s) => ({ ...s, status: 'loading', error: null, params }))

    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(CLIENT_TIMEOUT_MS)])
      const response = await apiClients.serviceSearch.search(params, signal)
      if (controller.signal.aborted) return
      state.set({ status: 'success', response, error: null, params })
    } catch (error) {
      // Superseded by a newer search: that one owns the state now.
      if (controller.signal.aborted) return
      currentKey = null // let the same search be tried again
      state.update((s) => ({ ...s, status: 'error', error: errorMessage(error) }))
    } finally {
      if (inFlight === controller) inFlight = null
    }
  },

  retry(): void {
    const { params } = get(state)
    if (params) void searchStore.search(params, { force: true })
  },
}
