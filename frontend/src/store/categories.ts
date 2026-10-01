import { writable } from 'svelte/store'
import { apiClients } from '@/api/clients'

export interface CategoriesState {
  categories: string[]
  failed: boolean
}

const state = writable<CategoriesState>({ categories: [], failed: false })

let loaded = false
let pending: Promise<void> | null = null

/** Category list for the filter. Loads once; a failed load can be retried. */
export const categoriesStore = {
  subscribe: state.subscribe,

  load(): Promise<void> {
    if (loaded) return Promise.resolve()
    pending ??= apiClients.serviceSearch
      .getCategories()
      .then(({ categories }) => {
        loaded = true
        state.set({ categories, failed: false })
      })
      .catch(() => state.update((s) => ({ ...s, failed: true })))
      .finally(() => (pending = null))
    return pending
  },
}
