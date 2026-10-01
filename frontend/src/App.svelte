<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import ResultsList from '@/components/ResultsList.svelte'
  import SearchControls from '@/components/SearchControls.svelte'
  import SearchStatus from '@/components/SearchStatus.svelte'
  import type { SearchParams } from '@/interfaces/SearchInterfaces'
  import { categoriesStore } from '@/store/categories'
  import { searchStore } from '@/store/search'
  import { addRecentQuery, searchPreferences, setSortOption } from '@/store/searchPreferences'
  import { toApiSort } from '@/utils/sortOptions'
  import { readUrlState, writeUrlState } from '@/utils/urlState'

  /** Wait for a pause in typing before searching. */
  const DEBOUNCE_MS = 250

  // A shared link wins over the saved sort preference.
  const initial = readUrlState()
  let q = $state(initial.q)
  let category = $state(initial.category)
  let sortOption = $state(initial.sortOption ?? get(searchPreferences).sortOption)

  const params = $derived<SearchParams>({
    q,
    category: category || undefined,
    ...toApiSort(sortOption),
  })

  // Rememberand store the sort choice across visits.
  $effect(() => {
    setSortOption(sortOption)
  })

  // Search whenever the inputs change, debounced, and keep the URL in step.
  // Identical searches are skipped by the store, so e.g. adding a trailing
  // space doesn't refetch.
  $effect(() => {
    const next = params
    const urlState = { q, category, sortOption }
    const timer = setTimeout(() => {
      writeUrlState(urlState)
      void searchStore.search(next)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  })

  // A link may use different casing (?category=pizza) or name a category that
  // doesn't exist: snap to the real name, or fall back to all categories.
  $effect(() => {
    const { categories } = $categoriesStore
    if (!category || categories.length === 0 || categories.includes(category)) return
    category = categories.find((c) => c.toLowerCase() === category.toLowerCase()) ?? ''
  })

  onMount(() => {
    void categoriesStore.load()
  })

  // Retry also recovers the category filter if it failed to load earlier.
  function retry() {
    searchStore.retry()
    void categoriesStore.load()
  }

  // Enter / Search button / choosing a suggestion: search now, and refresh
  // even if nothing changed. Only these deliberate searches are remembered as
  // recent, and only if they found something; the live search-as-you-type
  // would otherwise fill the list with fragments like "chi" and "chic".
  async function submit() {
    const submitted = params
    await searchStore.search(submitted, { force: true })
    const { response } = get(searchStore)
    if (response && response.total > 0 && response.query.q === submitted.q.trim()) {
      addRecentQuery(submitted.q)
    }
  }

  // Actions offered by the "No results" state. Changing either re-runs the search.
  const clearQuery = () => (q = '')
  const showAllCategories = () => (category = '')
</script>

<div class="min-h-screen bg-gray-50 text-gray-900">
  <main class="mx-auto max-w-5xl px-4 py-6 sm:px-6">
    <header class="mb-6">
      <h1 class="text-2xl font-bold"><span class="text-red-600">Mr D</span> Search</h1>
      <p class="text-sm text-gray-500">Find food and groceries with live prices and availability.</p>
    </header>

    <SearchControls bind:q bind:category bind:sort={sortOption} onsubmit={submit} />
    <SearchStatus
      state={$searchStore}
      onretry={retry}
      onclearquery={clearQuery}
      onallcategories={showAllCategories}
    />
    <ResultsList state={$searchStore} />
  </main>
</div>
