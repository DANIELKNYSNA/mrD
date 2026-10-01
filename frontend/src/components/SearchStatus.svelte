<script lang="ts">
  import type { SearchState } from '@/store/search'

  interface Props {
    state: SearchState
    onretry: () => void
    onclearquery: () => void
    onallcategories: () => void
  }

  let { state, onretry, onclearquery, onallcategories }: Props = $props()

  const response = $derived(state.response)
  const unpriced = $derived(response?.items.filter((item) => item.offer === null).length ?? 0)
  const query = $derived(response?.query.q ?? '')
</script>

<!-- Polite live region so screen readers hear result counts and errors without stealing focus. -->
<div aria-live="polite" class="my-4 min-h-6 text-sm">
  {#if state.status === 'error'}
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
      <span><strong>Search failed.</strong> {state.error}</span>
      <button type="button" onclick={onretry} class="rounded-md border border-red-300 bg-white px-3 py-1 font-medium hover:bg-red-100">
        Try again
      </button>
    </div>
  {:else if state.status === 'loading' || state.status === 'idle'}
    <p class="flex items-center gap-2 text-gray-600">
      <!-- Spinner is decorative; the text carries the meaning for screen readers. -->
      <svg aria-hidden="true" class="h-4 w-4 text-red-600 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      </svg>
      Getting delicious results…
    </p>
  {:else if response && response.total === 0}
    {@const inCategory = response.query.category}
    <!-- Offer one-click ways out rather than clearing the user's input for them. -->
    <div class="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-gray-600">
      <p class="font-medium text-gray-800">
        No results{query ? ` for “${query}”` : ''}{inCategory ? ` in ${inCategory}` : ''}.
      </p>
      <div class="mt-3 flex flex-wrap justify-center gap-2">
        {#if inCategory}
          <button type="button" onclick={onallcategories} class="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700">
            Search all categories
          </button>
        {/if}
        {#if query}
          <button type="button" onclick={onclearquery} class="rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium hover:bg-gray-100">
            Clear search
          </button>
        {/if}
      </div>
    </div>
  {:else if response}
    <p class="text-gray-600">
      {response.total} {response.total === 1 ? 'result' : 'results'}{query ? ` for “${query}”` : ''}
      <span class="text-gray-400">· {response.tookMs} ms</span>
    </p>
    {#if response.partial}
      <div class="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
        <span>
          Live prices couldn't be loaded for {unpriced} {unpriced === 1 ? 'item' : 'items'}.
        </span>
        <button type="button" onclick={onretry} class="rounded-md border border-amber-300 bg-white px-3 py-1 font-medium hover:bg-amber-100">
          Refresh prices
        </button>
      </div>
    {/if}
  {/if}
</div>
